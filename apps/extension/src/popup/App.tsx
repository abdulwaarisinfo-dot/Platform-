import { useEffect, useState } from 'react';
import { checkAuth, getCurrentLinkedInUrl, syncUser } from '../lib/api';
import { AuthView } from './views/AuthView';
import { IdleView } from './views/IdleView';
import { ProfileView } from './views/ProfileView';
import { ResearchView } from './views/ResearchView';

type View = 'loading' | 'auth' | 'idle' | 'profile' | 'research';

type SyncData = {
  user: { email: string; full_name?: string };
  credits_remaining: number;
  recent_prospects: Array<{
    id: string;
    full_name: string;
    company_name: string;
    linkedin_url: string;
  }>;
};

export default function App() {
  const [view, setView] = useState<View>('loading');
  const [linkedInUrl, setLinkedInUrl] = useState<string | null>(null);
  const [syncData, setSyncData] = useState<SyncData | null>(null);
  const [prospectId, setProspectId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth) {
        setView('auth');
        return;
      }

      const [urlResult, syncResult] = await Promise.all([
        getCurrentLinkedInUrl(),
        syncUser(),
      ]);

      setLinkedInUrl(urlResult);
      if (syncResult.data) setSyncData(syncResult.data);

      if (urlResult) {
        setView('profile');
      } else {
        setView('idle');
      }
    }

    init();
  }, []);

  if (view === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <Spinner />
      </div>
    );
  }

  if (view === 'auth') {
    return <AuthView onAuth={() => setView('idle')} />;
  }

  if (view === 'research' && prospectId) {
    return (
      <ResearchView
        prospectId={prospectId}
        onBack={() => setView('profile')}
      />
    );
  }

  if (view === 'profile' && linkedInUrl) {
    return (
      <ProfileView
        linkedInUrl={linkedInUrl}
        creditsRemaining={syncData?.credits_remaining ?? 0}
        onResearched={(id) => {
          setProspectId(id);
          setView('research');
        }}
        onSignOut={() => setView('auth')}
      />
    );
  }

  return (
    <IdleView
      syncData={syncData}
      onSignOut={() => setView('auth')}
    />
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        border: '2px solid #e5e7eb',
        borderTopColor: '#2563eb',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  );
}
