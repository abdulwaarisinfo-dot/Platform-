import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';

function getSecret(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET environment variable is not configured');
  return new TextEncoder().encode(s);
}

const ACCESS_TTL = 60 * 60;
const REFRESH_TTL = 30 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  let body: { refresh_token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.refresh_token) {
    return NextResponse.json({ error: 'refresh_token required' }, { status: 400 });
  }

  const secret = getSecret();
  let payload: { sub?: string; type?: string };
  try {
    const { payload: p } = await jwtVerify(body.refresh_token, secret);
    payload = p as { sub?: string; type?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  if (payload.type !== 'refresh' || !payload.sub) {
    return NextResponse.json({ error: 'Invalid token type' }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);

  const access_token = await new SignJWT({ sub: payload.sub, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL)
    .sign(secret);

  const refresh_token = await new SignJWT({ sub: payload.sub, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TTL)
    .sign(secret);

  return NextResponse.json({
    access_token,
    refresh_token,
    expires_at: now + ACCESS_TTL,
  });
}
