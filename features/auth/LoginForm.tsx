'use client';

/**
 * Login form — Client Component.
 *
 * Uses the SSR-safe Supabase auth client.
 * After successful login, redirects to the profile page (or next param).
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Leaf, Eye, EyeOff } from 'lucide-react';
import { useLocale } from '@/components/locale-provider';
import { supabaseAuthClient } from '@/lib/supabase/auth-client';

export function LoginForm() {
  const { locale, dict, isRTL } = useLocale();
  const base = `/${locale}`;
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || `${base}/profile`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!email) { setError(dict.auth.emailRequired); return; }
    if (!password) { setError(dict.auth.passwordRequired); return; }

    setLoading(true);
    const supabase = supabaseAuthClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(dict.auth.loginError);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Brand */}
      <Link href={base} className="mb-8 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Leaf size={19} strokeWidth={2.5} />
        </span>
        <span className="font-display text-[26px] font-semibold tracking-[-0.04em]">{dict.brandName}</span>
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">{dict.auth.loginTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dict.auth.loginSubtitle}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
              {dict.auth.email}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
              placeholder="you@example.com"
              dir="ltr"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium" htmlFor="password">
                {dict.auth.password}
              </label>
              <button type="button" className="text-xs text-muted-foreground hover:text-primary">
                {dict.auth.forgotPassword}
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${isRTL ? 'left-3' : 'right-3'}`}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? dict.auth.loggingIn : dict.auth.login}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {dict.auth.noAccount}{' '}
          <Link href={`${base}/auth/signup`} className="font-medium text-primary hover:underline">
            {dict.auth.signup}
          </Link>
        </p>
      </div>
    </div>
  );
}
