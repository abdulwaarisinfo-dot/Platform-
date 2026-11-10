// MV3 service worker — no DOM access, no content_scripts
// LinkedIn detection via chrome.tabs.onUpdated reading browser-provided changeInfo.url

const LINKEDIN_PROFILE_RE = /^https?:\/\/(www\.)?linkedin\.com\/in\/([^/?#]+)\/?/;
const APP_URL = 'https://flintel.app'; // hardcoded — no dynamic config in MV3 service worker

type AuthState = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

async function getAuth(): Promise<AuthState | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['auth'], (result) => {
      resolve((result.auth as AuthState) ?? null);
    });
  });
}

async function setAuth(auth: AuthState): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ auth }, resolve);
  });
}

async function clearAuth(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['auth', 'currentProfile'], resolve);
  });
}

async function refreshTokenIfNeeded(auth: AuthState): Promise<AuthState | null> {
  const now = Math.floor(Date.now() / 1000);
  // Refresh 5 minutes before expiry
  if (auth.expires_at - now > 300) return auth;

  try {
    const res = await fetch(`${APP_URL}/api/extension/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refresh_token }),
    });

    if (!res.ok) {
      await clearAuth();
      return null;
    }

    const data = (await res.json()) as AuthState;
    await setAuth(data);
    return data;
  } catch {
    return null;
  }
}

// Store the current LinkedIn URL the popup should use
async function setCurrentLinkedInUrl(url: string | null): Promise<void> {
  return new Promise((resolve) => {
    if (url) {
      chrome.storage.local.set({ currentLinkedInUrl: url }, resolve);
    } else {
      chrome.storage.local.remove('currentLinkedInUrl', resolve);
    }
  });
}

// Detect LinkedIn profile navigation (including SPA pushState changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only act when the URL is known (fires on pushState too)
  const url = changeInfo.url ?? tab.url;
  if (!url) return;

  // Check if this is the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id !== tabId) return;

    if (LINKEDIN_PROFILE_RE.test(url)) {
      setCurrentLinkedInUrl(url);
    } else if (url.includes('linkedin.com')) {
      // On LinkedIn but not a profile page
      setCurrentLinkedInUrl(null);
    }
  });
});

// Clear profile URL when tab is closed or navigated away
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (!tab.url) return;
    if (!LINKEDIN_PROFILE_RE.test(tab.url)) {
      setCurrentLinkedInUrl(null);
    } else {
      setCurrentLinkedInUrl(tab.url);
    }
  });
});

// Proactive token refresh via alarm
chrome.alarms.create('token-refresh', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'token-refresh') return;

  const auth = await getAuth();
  if (auth) {
    await refreshTokenIfNeeded(auth);
  }
});

// Message handler — popup communicates via chrome.runtime.sendMessage
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message as unknown as Message)
    .then(sendResponse)
    .catch((err: unknown) => sendResponse({ error: String(err) }));
  return true; // keep channel open for async response
});

type Message =
  | { type: 'GET_AUTH' }
  | { type: 'SET_AUTH'; payload: AuthState }
  | { type: 'CLEAR_AUTH' }
  | { type: 'GET_CURRENT_URL' }
  | { type: 'REFRESH_TOKEN' };

async function handleMessage(message: Message) {
  switch (message.type) {
    case 'GET_AUTH': {
      const auth = await getAuth();
      if (!auth) return { auth: null };
      const refreshed = await refreshTokenIfNeeded(auth);
      return { auth: refreshed };
    }

    case 'SET_AUTH': {
      await setAuth(message.payload as AuthState);
      return { success: true };
    }

    case 'CLEAR_AUTH': {
      await clearAuth();
      return { success: true };
    }

    case 'GET_CURRENT_URL': {
      return new Promise((resolve) => {
        chrome.storage.local.get(['currentLinkedInUrl'], (result) => {
          resolve({ url: (result.currentLinkedInUrl as string) ?? null });
        });
      });
    }

    case 'REFRESH_TOKEN': {
      const auth = await getAuth();
      if (!auth) return { auth: null };
      const refreshed = await refreshTokenIfNeeded(auth);
      return { auth: refreshed };
    }

    default:
      return { error: 'Unknown message type' };
  }
}
