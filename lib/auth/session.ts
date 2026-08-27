/**
 * Auth session helpers — server-side.
 *
 * These functions run in Server Components, Route Handlers, and Server Actions.
 * They use the cookie-aware Supabase client to read the current session.
 */
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import type { User } from '@supabase/supabase-js';

/**
 * Returns the currently authenticated user, or null if not logged in.
 * Safe to call from any Server Component.
 */
export async function getServerUser(): Promise<User | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the current session, or null if not logged in.
 */
export async function getServerSession() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session ?? null;
  } catch {
    return null;
  }
}
