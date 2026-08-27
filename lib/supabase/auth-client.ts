/**
 * Browser (client-side) Supabase client — SSR-safe, session-aware.
 *
 * Use this inside Client Components ('use client') for auth operations.
 * Sessions are stored in cookies and persist across page reloads.
 *
 * Import: import { supabaseAuthClient } from '@/lib/supabase/auth-client';
 */
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

type SupabaseAuthClientType = SupabaseClient;

// Singleton — safe because module-level state in the browser is per-tab.
let clientInstance: SupabaseAuthClientType | null = null;

export function supabaseAuthClient(): SupabaseAuthClientType {
  if (!clientInstance) {
    clientInstance = createBrowserClient(
      env.supabase.url,
      env.supabase.anonKey
    ) as SupabaseAuthClientType;
  }
  return clientInstance;
}
