export const metadata = {
  title: 'Privacy Policy — Flintel',
  description: 'How Flintel collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mb-10 text-sm text-gray-500">Last updated: November 2024</p>

      <div className="prose prose-gray max-w-none">
        <h2>1. What we collect</h2>
        <p>
          We collect the information you provide when you register (email address, name) and
          information about how you use Flintel (feature usage, AI report requests). We do not
          collect payment card details — these are handled entirely by Paddle.
        </p>

        <h2>2. Prospect data and enrichment</h2>
        <p>
          When you research a prospect, Flintel queries third-party B2B data providers including
          People Data Labs (PDL) and web search APIs. The data returned is used solely to generate
          your research report and is stored associated with your account. PDL data is sourced from
          publicly available professional profiles and licensed business data.
        </p>
        <p>
          <strong>Freshness disclosure:</strong> Enrichment data from People Data Labs may not
          reflect the subject&apos;s current role, employer, or contact information. All PDL-sourced
          fields are marked with a data freshness indicator in the UI.
        </p>

        <h2>3. Chrome extension</h2>
        <p>
          The Flintel Chrome extension uses the <code>tabs</code> permission to read the URL of
          your active tab. This is used exclusively to detect when you are viewing a LinkedIn
          profile page (a URL matching <code>linkedin.com/in/</code>). The extension does not:
        </p>
        <ul>
          <li>Read or modify the content of any web page</li>
          <li>Access your LinkedIn session, cookies, or credentials</li>
          <li>Record your browsing history</li>
        </ul>
        <p>
          Your Flintel authentication token is stored in <code>chrome.storage.local</code>, which
          is encrypted on-device by Chrome. It is transmitted only to <code>flintel.app</code> over
          HTTPS.
        </p>

        <h2>4. How we use your data</h2>
        <ul>
          <li>To generate prospect intelligence reports you request</li>
          <li>To improve your Business Brain over time</li>
          <li>To send transactional emails (account confirmations, billing receipts)</li>
          <li>To provide customer support when you contact us</li>
        </ul>
        <p>We do not sell your data to third parties.</p>

        <h2>5. Data retention</h2>
        <p>
          Prospect research records are retained for the duration of your account. Cached research
          expires after 30 days and is refreshed on the next request. You may request deletion of
          your account and all associated data at any time by contacting support.
        </p>

        <h2>6. Third-party processors</h2>
        <ul>
          <li><strong>Supabase</strong> — database and authentication (EU/US regions)</li>
          <li><strong>Paddle</strong> — payment processing (Merchant of Record)</li>
          <li><strong>People Data Labs</strong> — professional enrichment data</li>
          <li><strong>Anthropic</strong> — AI synthesis and message generation</li>
          <li><strong>Vercel</strong> — web hosting</li>
          <li><strong>Sentry</strong> — error monitoring</li>
        </ul>

        <h2>7. Your rights (GDPR)</h2>
        <p>
          If you are located in the EU/EEA, you have the right to access, correct, and delete your
          personal data. To exercise these rights, contact us at{' '}
          <a href="mailto:privacy@flintel.app">privacy@flintel.app</a>.
        </p>

        <h2>8. Contact</h2>
        <p>
          For privacy inquiries, contact{' '}
          <a href="mailto:privacy@flintel.app">privacy@flintel.app</a>.
        </p>
      </div>
    </div>
  );
}
