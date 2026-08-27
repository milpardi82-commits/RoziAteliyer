/**
 * Environment configuration with validation.
 *
 * All environment variable access in the application MUST go through this
 * module. Never read process.env directly outside of this file.
 *
 * NEXT_PUBLIC_* variables are safe to ship to the browser.
 * Variables without the prefix are server-only and must never be sent to clients.
 */

const _supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const _supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const _siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

function requireEnv(value: string | undefined, key: string): string {
  if (!value) {
    // In test / build environments the variables may not be present.
    // We warn rather than throw so that `next build` does not crash when
    // the variables will be injected at runtime (e.g. Netlify env vars).
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
      console.warn(
        `[env] Missing required environment variable: ${key}. ` +
          `Ensure it is set in your deployment environment.`
      );
      return '';
    }
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Add it to your .env.local file (never commit secrets to source control).`
    );
  }
  return value;
}

function optionalEnv(value: string | undefined, fallback = ''): string {
  return value ?? fallback;
}

// ─── Supabase (public — safe in browser) ──────────────────────────────────────
export const env = {
  supabase: {
    url: requireEnv(_supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: requireEnv(_supabaseAnonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  },
  site: {
    url: optionalEnv(_siteUrl, 'https://roziatelye.com'),
  },
} as const;

export type Env = typeof env;
