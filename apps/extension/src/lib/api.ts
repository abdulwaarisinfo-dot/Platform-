declare const __APP_URL__: string;
const APP_URL = __APP_URL__;

type AuthState = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

async function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, (response: { auth: AuthState | null }) => {
      resolve(response?.auth?.access_token ?? null);
    });
  });
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null }> {
  const token = await getToken();
  if (!token) return { data: null, error: 'Not authenticated' };

  try {
    const res = await fetch(`${APP_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });

    if (res.status === 401) return { data: null, error: 'Session expired' };

    const json = await res.json() as T;
    if (!res.ok) return { data: null, error: (json as { error?: string }).error ?? 'Request failed' };

    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

export async function signIn(email: string, password: string) {
  const res = await fetch(`${APP_URL}/api/extension/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json() as AuthState & { error?: string };

  if (!res.ok) return { data: null, error: data.error ?? 'Sign in failed' };

  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage({ type: 'SET_AUTH', payload: data }, () => resolve());
  });

  return { data, error: null };
}

export async function signOut() {
  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage({ type: 'CLEAR_AUTH' }, () => resolve());
  });
}

export async function checkAuth() {
  return new Promise<AuthState | null>((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, (response: { auth: AuthState | null }) => {
      resolve(response?.auth ?? null);
    });
  });
}

export async function getCurrentLinkedInUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_URL' }, (response: { url: string | null }) => {
      resolve(response?.url ?? null);
    });
  });
}

type SyncData = {
  user: { id: string; email: string; full_name?: string };
  credits_remaining: number;
  recent_prospects: Array<{
    id: string;
    full_name: string;
    company_name: string;
    linkedin_url: string;
  }>;
};

export async function syncUser() {
  return request<SyncData>('/api/extension/sync');
}

type ResearchResponse = {
  prospect_id: string;
  full_name: string;
  job_title: string;
  company_name: string;
  opportunity_score: number;
  summary: string;
};

export async function researchProspect(linkedinUrl: string) {
  return request<ResearchResponse>('/api/prospects', {
    method: 'POST',
    body: JSON.stringify({ linkedin_url: linkedinUrl, source: 'extension' }),
  });
}

type MessagesResponse = {
  linkedin_dm: string;
  cold_email_subject: string;
  cold_email_body: string;
  follow_up: string;
};

export async function generateMessages(prospectId: string) {
  return request<MessagesResponse>(`/api/prospects/${prospectId}/messages`, {
    method: 'POST',
  });
}
