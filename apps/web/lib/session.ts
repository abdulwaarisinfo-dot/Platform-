/**
 * Server-side session helper.
 * Replaces the `createClient().auth.getUser()` Supabase pattern.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export type AppSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
};

export async function getAuthSession(): Promise<AppSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? '',
      name: session.user.name,
    },
  };
}
