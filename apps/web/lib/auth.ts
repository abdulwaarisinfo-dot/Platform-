import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import * as argon2 from 'argon2';
import { clientPromise } from './mongodb';
import { users } from './mongodb/collections';
import type { NextAuthOptions } from 'next-auth';

const MONGODB_DB = process.env.MONGODB_DB_NAME ?? 'platform';

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise, { databaseName: MONGODB_DB }),

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const col = await users();
        const user = await col.findOne({ email: credentials.email.toLowerCase() });

        if (!user || !user.password_hash) return null;

        const valid = await argon2.verify(user.password_hash, credentials.password as string);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          email: user.email as string,
          name: (user.name as string) ?? null,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async signIn({ account }) {
      if (account?.provider === 'google') {
        // Provision profile + subscription on first Google sign-in
        // The MongoDBAdapter creates the user; we just need to ensure a usage record exists
        // This is handled lazily in the app routes
        return true;
      }
      return true;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
    verifyRequest: '/verify',
  },

  events: {
    async createUser({ user }) {
      // After account creation (email/password or OAuth), create starter subscription + usage record
      await provisionNewUser(user.id!);
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

async function provisionNewUser(userId: string) {
  const { subscriptions, usageRecords } = await import('./mongodb/collections');

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subCol = await subscriptions();
  const existing = await subCol.findOne({ user_id: userId });
  if (!existing) {
    const sub = await subCol.insertOne({
      user_id: userId,
      plan_id: 'starter',
      status: 'trialing',
      current_period_start: now,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      created_at: now,
      updated_at: now,
    });

    const usageCol = await usageRecords();
    await usageCol.insertOne({
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
}

const handler = NextAuth(authOptions);
export { handler };
