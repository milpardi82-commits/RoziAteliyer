/**
 * Server-side Supabase client — SSR-safe, cookie-aware.
 *
 * Use this in Server Components, Route Handlers, and Server Actions.
 * Reads and writes auth session cookies from the Next.js request context.
 *
 * Import: import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll called from a Server Component — cookies are read-only there.
          // The middleware handles cookie refresh so this is safe to ignore.
        }
      },
    },
  });
}
