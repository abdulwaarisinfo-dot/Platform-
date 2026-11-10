import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { users, passwordResetTokens } from '@/lib/mongodb/collections';

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email } = body;
  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();

  // Always return 200 to prevent email enumeration
  const userCol = await users();
  const user = await userCol.findOne({ email: emailLower });

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Invalidate any existing tokens for this user
    const tokenCol = await passwordResetTokens();
    await tokenCol.deleteMany({ user_id: user._id.toString() });
    await tokenCol.insertOne({
      token,
      user_id: user._id.toString(),
      expires_at: expiresAt,
      created_at: new Date(),
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

    // Send email via Resend if configured
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(resendApiKey);
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@flintel.io',
          to: emailLower,
          subject: 'Reset your Flintel password',
          html: `
            <p>You requested a password reset for your Flintel account.</p>
            <p><a href="${resetUrl}">Click here to reset your password</a></p>
            <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
          `,
        });
      } catch (err) {
        console.error('[reset-password] Failed to send email:', err);
        // Don't surface email errors to prevent enumeration
      }
    } else {
      // Development fallback: log reset URL
      console.log(`[reset-password] Token for ${emailLower}: ${resetUrl}`);
    }
  }

  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token, password } = body;
  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const tokenCol = await passwordResetTokens();
  const record = await tokenCol.findOne({
    token,
    expires_at: { $gt: new Date() },
  });

  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
  }

  const argon2 = await import('argon2');
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const userCol = await users();
  await userCol.updateOne(
    { _id: new ObjectId(record.user_id as string) },
    { $set: { password_hash: passwordHash, updated_at: new Date() } },
  );

  // Consume the token
  await tokenCol.deleteOne({ _id: record._id });

  return NextResponse.json({ success: true });
}
