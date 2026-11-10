import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Verify email" };

export default function VerifyPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          A confirmation link has been sent to your email address.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-body-sm text-[var(--color-text-muted)]">
          Click the link in the email to activate your account. If you don&apos;t see it, check your spam folder.
        </p>
        <p className="mt-4 text-[13px] text-[var(--color-text-muted)]">
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
