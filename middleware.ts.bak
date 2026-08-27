import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { locales, defaultLocale, type Locale } from '@/lib/i18n';

/**
 * Protected route patterns (must be authenticated).
 * Locale prefix will be stripped before matching.
 */
const PROTECTED_PATHS = ['/profile', '/become-creator', '/creator/dashboard'];

/**
 * Auth-only paths — redirect to home if already authenticated.
 */
const AUTH_ONLY_PATHS = ['/auth/login', '/auth/signup'];

function getLocaleFromPath(pathname: string): Locale | null {
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale;
    }
  }
  return null;
}

/**
 * Strips the locale prefix from a pathname.
 * e.g. /fa/profile → /profile
 */
function stripLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
    if (pathname === `/${locale}`) return '/';
  }
  return pathname;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and API routes (except auth API — handled separately)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/images') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ── 1. Locale redirect ───────────────────────────────────────────────────
  const localeInPath = getLocaleFromPath(pathname);
  if (!localeInPath) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  // ── 2. Supabase session refresh ──────────────────────────────────────────
  // We must call createServerClient here (in middleware) to refresh the
  // auth token and update session cookies on every request.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars missing (build time), skip auth logic
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Write refreshed cookies to both request and response
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // IMPORTANT: getUser() refreshes the session token if needed.
  // Do NOT use getSession() in middleware — use getUser() for security.
  const { data: { user } } = await supabase.auth.getUser();

  // ── 3. Route protection ──────────────────────────────────────────────────
  const pathWithoutLocale = stripLocale(pathname);

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`)
  );
  const isAuthOnly = AUTH_ONLY_PATHS.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`)
  );

  if (isProtected && !user) {
    // Not authenticated — redirect to login with return URL
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${localeInPath}/auth/login`;
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthOnly && user) {
    // Already authenticated — redirect away from login/signup
    const profileUrl = request.nextUrl.clone();
    profileUrl.pathname = `/${localeInPath}/profile`;
    profileUrl.searchParams.delete('next');
    return NextResponse.redirect(profileUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next|api|images).*)'],
};
