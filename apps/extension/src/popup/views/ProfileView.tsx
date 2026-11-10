import { useState } from 'react';
import { researchProspect, signOut } from '../../lib/api';

interface ProfileViewProps {
  linkedInUrl: string;
  creditsRemaining: number;
  onResearched: (prospectId: string) => void;
  onSignOut: () => void;
}

function extractHandle(url: string): string {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/);
  return m ? m[1] : url;
}

export function ProfileView({ linkedInUrl, creditsRemaining, onResearched, onSignOut }: ProfileViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleResearch() {
    if (creditsRemaining <= 0) return;
    setLoading(true);
    setError('');

    const { data, error: err } = await researchProspect(linkedInUrl);
    if (err || !data) {
      setError(err ?? 'Research failed');
      setLoading(false);
      return;
    }

    onResearched(data.prospect_id);
  }

  async function handleSignOut() {
    await signOut();
    onSignOut();
  }

  const handle = extractHandle(linkedInUrl);

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Flintel</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{creditsRemaining} credits</span>
      </div>

      {/* Detected profile */}
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 10,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
          LinkedIn profile detected
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1e3a8a', wordBreak: 'break-all' }}>
          {handle}
        </p>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 12, textAlign: 'center' }}>{error}</p>
      )}

      {creditsRemaining <= 0 ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>No credits remaining</p>
          <a
            href="https://flintel.app/pricing-upgrade"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}
          >
            Upgrade plan →
          </a>
        </div>
      ) : (
        <button
          onClick={handleResearch}
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px 16px',
            background: loading ? '#93c5fd' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: 12,
          }}
        >
          {loading ? 'Researching…' : 'Research this prospect'}
        </button>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <a
          href="https://flintel.app/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: '#2563eb' }}
        >
          Dashboard →
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
