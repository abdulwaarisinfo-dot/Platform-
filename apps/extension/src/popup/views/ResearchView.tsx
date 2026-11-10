import { useEffect, useState } from 'react';
import { generateMessages } from '../../lib/api';

interface ResearchViewProps {
  prospectId: string;
  onBack: () => void;
}

type Messages = {
  linkedin_dm: string;
  cold_email_subject: string;
  cold_email_body: string;
  follow_up: string;
};

export function ResearchView({ prospectId, onBack }: ResearchViewProps) {
  const [messages, setMessages] = useState<Messages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    generateMessages(prospectId).then(({ data, error: err }) => {
      if (err || !data) {
        setError(err ?? 'Failed to generate messages');
      } else {
        setMessages(data);
      }
      setLoading(false);
    });
  }, [prospectId]);

  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <Spinner />
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>Generating messages…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 12 }}>{error}</p>
        <button onClick={onBack} style={backBtnStyle}>← Back</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onBack} style={{ ...backBtnStyle, marginBottom: 12 }}>← Back</button>

      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>AI Messages Ready</h2>

      {messages && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MessageBlock
            label="LinkedIn DM"
            text={messages.linkedin_dm}
            id="dm"
            copied={copied}
            onCopy={copyToClipboard}
          />
          <MessageBlock
            label="Cold Email"
            text={`Subject: ${messages.cold_email_subject}\n\n${messages.cold_email_body}`}
            id="email"
            copied={copied}
            onCopy={copyToClipboard}
          />
          <MessageBlock
            label="Follow-up"
            text={messages.follow_up}
            id="followup"
            copied={copied}
            onCopy={copyToClipboard}
          />
        </div>
      )}

      <a
        href={`https://flintel.app/prospects/${prospectId}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'block', textAlign: 'center', marginTop: 14, fontSize: 12, color: '#2563eb' }}
      >
        View full report →
      </a>
    </div>
  );
}

function MessageBlock({
  label,
  text,
  id,
  copied,
  onCopy,
}: {
  label: string;
  text: string;
  id: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
          {label}
        </span>
        <button
          onClick={() => onCopy(text, id)}
          style={{
            fontSize: 11,
            color: copied === id ? '#16a34a' : '#2563eb',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {copied === id ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>
        {text}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        display: 'inline-block',
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

const backBtnStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
};
