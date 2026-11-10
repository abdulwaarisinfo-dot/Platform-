import { NextResponse } from 'next/server';
import * as argon2 from 'argon2';
import { users } from '@/lib/mongodb/collections';
import crypto from 'crypto';

export async function POST(request: Request) {
  let body: { fullName?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { fullName, email, password } = body;

  if (!email?.trim() || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const col = await users();
  const existing = await col.findOne({ email: emailLower });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const now = new Date();

  const result = await col.insertOne({
    email: emailLower,
    name: fullName?.trim() ?? null,
    password_hash: passwordHash,
    email_verified: null,
    email_verification_token: verificationToken,
    image: null,
    onboarding_completed_at: null,
    created_at: now,
    updated_at: now,
  });

  // Provision subscription for new user
  await provisionNewUser(result.insertedId.toString());

  // In production: send verification email here using your email provider
  // For now we return 201 and the UI shows the "check your email" state
  // The token would be emailed as: /api/auth/verify?token=<verificationToken>

  return NextResponse.json({ success: true }, { status: 201 });
}

async function provisionNewUser(userId: string) {
  const { subscriptions, usageRecords } = await import('@/lib/mongodb/collections');

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const sub = await (await subscriptions()).insertOne({
    user_id: userId,
    plan_id: 'starter',
    status: 'trialing',
    current_period_start: now,
    current_period_end: periodEnd,
    cancel_at_period_end: false,
    created_at: now,
    updated_at: now,
  });

  await (await usageRecords()).insertOne({
    user_id: userId,
    subscription_id: sub.insertedId.toString(),
    period_start: now,
    period_end: periodEnd,
    prospect_research_used: 0,
    prospect_research_limit: 30,
    messages_generated_used: 0,
    messages_generated_limit: 90,
    created_at: now,
    updated_at: now,
  });
}
