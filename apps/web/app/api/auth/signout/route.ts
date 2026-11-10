import { NextResponse } from 'next/server';

// NextAuth handles signout via POST /api/auth/signout automatically.
// This route exists for explicit server-side redirect behaviour.
export async function POST() {
  const url = new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
  return NextResponse.redirect(url, { status: 302 });
}
