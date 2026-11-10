export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-h1 text-[var(--color-text)]">Flintel</h1>
          <p className="mt-1 text-body-sm text-[var(--color-text-muted)]">
            AI-powered prospect intelligence
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
