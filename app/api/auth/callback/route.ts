import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';

/**
 * Auth callback route handler.
 *
 * Supabase sends users here after email confirmation or OAuth.
 * We exchange the code for a session and redirect to the profile page.
 *
 * URL: /api/auth/callback?code=...&next=/fa/profile
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/fa/profile';

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      env.supabase.url,
      env.supabase.anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  // Code missing or exchange failed — redirect to login
  const locale = next.split('/')[1] ?? 'fa';
  return NextResponse.redirect(`${origin}/${locale}/auth/login?error=auth_callback_failed`);
}
