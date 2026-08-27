'use client';

/**
 * Signup form — Client Component.
 *
 * Creates a new Supabase auth user.
 * After successful signup, shows email confirmation notice.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Leaf, Eye, EyeOff } from 'lucide-react';
import { useLocale } from '@/components/locale-provider';
import { supabaseAuthClient } from '@/lib/supabase/auth-client';

export function SignupForm() {
  const { locale, dict, isRTL } = useLocale();
  const base = `/${locale}`;

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validation
    if (!email) { setError(dict.auth.emailRequired); return; }
    if (!password) { setError(dict.auth.passwordRequired); return; }
    if (password.length < 8) { setError(dict.auth.passwordMinLength); return; }
    if (password !== confirmPassword) { setError(dict.auth.passwordsMustMatch); return; }

    setLoading(true);
    const supabase = supabaseAuthClient();

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim() || email.split('@')[0],
        },
      },
    });

    if (authError) {
      setError(dict.auth.signupError);
      setLoading(false);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Link href={base} className="mb-8 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Leaf size={19} strokeWidth={2.5} />
          </span>
          <span className="font-display text-[26px] font-semibold tracking-[-0.04em]">{dict.brandName}</span>
        </Link>
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Leaf size={24} className="text-primary" />
          </div>
          <h1 className="text-lg font-semibold">{dict.auth.checkEmail}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{email}</p>
          <Link href={`${base}/auth/login`} className="mt-6 block text-sm font-medium text-primary hover:underline">
            {dict.auth.login}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Link href={base} className="mb-8 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Leaf size={19} strokeWidth={2.5} />
        </span>
        <span className="font-display text-[26px] font-semibold tracking-[-0.04em]">{dict.brandName}</span>
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">{dict.auth.signupTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dict.auth.signupSubtitle}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="displayName">
              {dict.auth.displayName}
            </label>
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder={isRTL ? 'نام شما' : 'Your name'}
            />
          </div>

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
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="you@example.com"
              dir="ltr"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
              {dict.auth.password}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${isRTL ? 'left-3' : 'right-3'}`}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="confirmPassword">
              {dict.auth.confirmPassword}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? dict.auth.signingUp : dict.auth.signup}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {dict.auth.hasAccount}{' '}
          <Link href={`${base}/auth/login`} className="font-medium text-primary hover:underline">
            {dict.auth.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
