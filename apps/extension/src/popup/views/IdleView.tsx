import { signOut } from '../../lib/api';

interface IdleViewProps {
  syncData: {
    user: { email: string; full_name?: string };
    credits_remaining: number;
    recent_prospects: Array<{
      id: string;
      full_name: string;
      company_name: string;
    }>;
  } | null;
  onSignOut: () => void;
}

export function IdleView({ syncData, onSignOut }: IdleViewProps) {
  async function handleSignOut() {
    await signOut();
    onSignOut();
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Flintel</span>
        {syncData && (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {syncData.credits_remaining} credits left
          </span>
        )}
      </div>

      {/* Not on LinkedIn */}
      <div
        style={{
          background: '#f9fafb',
          border: '1px dashed #d1d5db',
          borderRadius: 10,
          padding: '20px 16px',
          textAlign: 'center',
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Navigate to a LinkedIn profile
        </p>
        <p style={{ fontSize: 12, color: '#9ca3af' }}>
          Flintel will detect the profile automatically.
        </p>
      </div>

      {/* Recent */}
      {syncData?.recent_prospects && syncData.recent_prospects.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Recent
          </p>
          {syncData.recent_prospects.map((p) => (
            <div
              key={p.id}
              style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{p.full_name}</p>
              <p style={{ fontSize: 11, color: '#6b7280' }}>{p.company_name}</p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a
          href="https://flintel.app/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: '#2563eb' }}
        >
          Open dashboard →
        </a>
        <button
          onClick={handleSignOut}
          style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
