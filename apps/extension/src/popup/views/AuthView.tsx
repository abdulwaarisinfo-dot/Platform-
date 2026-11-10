import { useState } from 'react';
import { signIn } from '../../lib/api';

interface AuthViewProps {
  onAuth: () => void;
}

export function AuthView({ onAuth }: AuthViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');

    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      onAuth();
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>Flintel</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Sign in to research prospects</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        {error && (
          <p style={{ fontSize: 12, color: '#dc2626', textAlign: 'center' }}>{error}</p>
        )}

        <button type="submit" disabled={loading} style={btnStyle(loading)}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 16 }}>
        No account?{' '}
        <a href="https://flintel.app/register" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
          Sign up free
        </a>
      </p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  width: '100%',
};

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '10px 16px',
  background: disabled ? '#93c5fd' : '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  width: '100%',
});
