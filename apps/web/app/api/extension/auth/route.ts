import { NextRequest, NextResponse } from 'next/server';
import * as argon2 from 'argon2';
import { SignJWT } from 'jose';
import { users } from '@/lib/mongodb/collections';

function getSecret(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET environment variable is not configured');
  return new TextEncoder().encode(s);
}
const ACCESS_TTL = 60 * 60; // 1 hour in seconds
const REFRESH_TTL = 30 * 24 * 60 * 60; // 30 days

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  const col = await users();
  const user = await col.findOne({ email: email.trim().toLowerCase() });
  if (!user || !user.password_hash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await argon2.verify(user.password_hash as string, password);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const userId = user._id.toString();
  const now = Math.floor(Date.now() / 1000);

  const secret = getSecret();
  const access_token = await new SignJWT({ sub: userId, email: user.email, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL)
    .sign(secret);

  const refresh_token = await new SignJWT({ sub: userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TTL)
    .sign(secret);

  return NextResponse.json({
    access_token,
    refresh_token,
    expires_at: now + ACCESS_TTL,
    user: { id: userId, email: user.email },
  });
}
