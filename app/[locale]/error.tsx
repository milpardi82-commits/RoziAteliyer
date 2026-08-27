'use client';

/**
 * Locale-level error boundary.
 * Catches errors inside any [locale]/* route segment and renders
 * a localised error message without losing the RTL layout.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[LocaleError]', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle size={28} />
      </span>
      <div>
        <h1 className="font-display text-2xl font-medium">مشکلی پیش آمد</h1>
        <p className="mt-1 text-sm text-muted-foreground">Something went wrong. Please try again.</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <RefreshCw size={15} /> دوباره تلاش کنید
        </button>
        <Link href="/fa" className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
          بازگشت به خانه
        </Link>
      </div>
    </main>
  );
}
