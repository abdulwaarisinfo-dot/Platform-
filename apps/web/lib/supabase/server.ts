// Supabase has been removed. Import from @/lib/session instead.
// This file must be deleted during migration cleanup.
export function createServerClient(): never {
  throw new Error(
    'Supabase has been removed. Use getAuthSession() from @/lib/session instead.',
  );
}
export { createServerClient as createClient };
