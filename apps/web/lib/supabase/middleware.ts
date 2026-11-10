// Supabase has been removed. Middleware now uses NextAuth JWT directly.
// This file must be deleted during migration cleanup.
export function updateSession(): never {
  throw new Error(
    'Supabase has been removed. Middleware uses getToken() from next-auth/jwt directly.',
  );
}
