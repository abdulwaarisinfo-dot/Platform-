import { NextResponse } from 'next/server';

// NextAuth handles OAuth callbacks at /api/auth/callback/<provider>.
// This legacy route redirects any stray hits to the dashboard.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/dashboard`);
}
