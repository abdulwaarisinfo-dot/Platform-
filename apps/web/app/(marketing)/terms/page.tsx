export const metadata = {
  title: 'Terms of Service — Flintel',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Terms of Service</h1>
      <p className="mb-10 text-sm text-gray-500">Last updated: November 2024</p>

      <div className="prose prose-gray max-w-none">
        <h2>1. Acceptance</h2>
        <p>
          By using Flintel you agree to these Terms. If you do not agree, do not use the service.
        </p>

        <h2>2. Permitted use</h2>
        <p>
          Flintel is a B2B prospect intelligence platform for professional sales and outreach. You
          may use Flintel only for lawful business purposes. You may not:
        </p>
        <ul>
          <li>Use Flintel for personal, non-commercial research on private individuals</li>
          <li>Attempt to circumvent credit limits through automated abuse</li>
          <li>Resell or redistribute Flintel-generated reports</li>
          <li>Use Flintel in a manner that violates applicable data protection laws</li>
        </ul>

        <h2>3. Prospect data</h2>
        <p>
          Prospect intelligence reports are generated from licensed B2B data and publicly available
          information. Data may not be fully accurate or current. You are responsible for verifying
          information before acting on it. Flintel is not liable for decisions made based on
          generated reports.
        </p>

        <h2>4. Payments and refunds</h2>
        <p>
          Subscriptions are billed monthly. All payments are handled by Paddle, our Merchant of
          Record. You may cancel at any time; cancellation takes effect at the end of the current
          billing period. Credits unused at period end do not roll over.
        </p>

        <h2>5. Service availability</h2>
        <p>
          We aim for high availability but do not guarantee uninterrupted service. We reserve the
          right to modify or discontinue features with reasonable notice.
        </p>

        <h2>6. Intellectual property</h2>
        <p>
          Generated reports and messages belong to you. The Flintel platform, codebase, and brand
          belong to us.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Flintel&apos;s liability is limited to the amount
          you paid in the 30 days preceding the claim.
        </p>

        <h2>8. Governing law</h2>
        <p>These Terms are governed by the laws of Pakistan.</p>

        <h2>9. Contact</h2>
        <p>
          For questions, contact <a href="mailto:support@flintel.app">support@flintel.app</a>.
        </p>
      </div>
    </div>
  );
}
