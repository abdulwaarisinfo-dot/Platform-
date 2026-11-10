import { getAuthSession, type AppSession } from './session';
import { jwtVerify } from 'jose';

export async function getSession(request: Request): Promise<AppSession | null> {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
      const { payload } = await jwtVerify(token, secret);
      if (payload.type === 'access' && payload.sub && payload.email) {
        return {
          user: {
            id: payload.sub as string,
            email: payload.email as string,
            name: (payload.name as string) ?? null,
          },
        };
      }
    } catch {
      // fall through to cookie session
    }
  }
  return getAuthSession();
}
