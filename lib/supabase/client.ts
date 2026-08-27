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

// Lazy singleton — created on first call so that build-time module evaluation
// never triggers createClient with an empty URL (e.g. GitHub Pages CI).
let _client: ReturnType<typeof createClient> | null = null;

export function supabaseClient() {
  if (!_client) {
    _client = createClient(env.supabase.url, env.supabase.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}
