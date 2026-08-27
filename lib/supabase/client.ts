/**
 * Browser (client-side) Supabase instance.
 *
 * Use this ONLY inside Client Components ('use client') for DATA queries
 * (not auth — use @/lib/supabase/auth-client for auth operations).
 *
 * Import: import { supabaseClient } from '@/lib/supabase/client';
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// Singleton — safe because module-level state in the browser is per-tab.
// persistSession: true so the anon client can also benefit from auth state
// when used for data reads after login.
export const supabaseClient = createClient(env.supabase.url, env.supabase.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
