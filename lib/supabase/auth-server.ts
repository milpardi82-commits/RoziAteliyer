/**
 * Server-side Supabase client — SSR-safe, cookie-aware.
 *
 * Use this in Server Components, Route Handlers, and Server Actions.
 * Reads and writes auth session cookies from the Next.js request context.
 *
 * Import: import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
 */
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';

export function createSupabaseServerClient() {
  // During static export (output: 'export') or when Supabase env vars are
  // not set, return a minimal no-op client to avoid build-time crashes.
  // The real client is used at runtime when cookies and env vars are available.
  if (!env.supabase.url || !env.supabase.anonKey) {
    const { createClient } = require('@supabase/supabase-js');
    return createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // Dynamic import of cookies() to avoid crashing static-export builds
  // where next/headers is not available at build time.
  let cookieStore: ReturnType<typeof import('next/headers')['cookies']> | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cookies } = require('next/headers') as typeof import('next/headers');
    cookieStore = cookies();
  } catch {
    // static export / build environment — cookies not available
  }

  return createServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore?.getAll() ?? [];
      },
      setAll(cookiesToSet) {
        if (!cookieStore) return;
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            (cookieStore as any).set(name, value, options);
          });
        } catch {
          // setAll called from a Server Component — cookies are read-only there.
        }
      },
    },
  });
}
