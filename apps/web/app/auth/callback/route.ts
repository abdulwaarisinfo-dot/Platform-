import { type NextRequest, NextResponse } from 'next/server';

// NextAuth handles OAuth callbacks at /api/auth/callback/google.
// This route exists only for backward compatibility with any old links/bookmarks.
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const next = new URL(request.url).searchParams.get('next') ?? '/dashboard';
  return NextResponse.redirect(`${origin}${next}`);
}
