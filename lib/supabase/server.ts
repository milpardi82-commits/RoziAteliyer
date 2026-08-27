/**
 * Server-side Supabase instance.
 *
 * Use this ONLY inside Server Components, Server Actions, and Route Handlers.
 * This file should NEVER be imported from a Client Component.
 *
 * Import: import { supabaseServer } from '@/lib/supabase/server';
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * Returns a fresh Supabase client for each server request.
 * Call this as a function — do NOT share an instance across requests.
 */
export function supabaseServer() {
  return createClient(env.supabase.url, env.supabase.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
