'use client';

/**
 * Global error boundary — shown when an unhandled error bubbles up from
 * any route segment. Next.js requires this to be a Client Component.
 *
 * Place additional route-level error.tsx files inside specific segments
 * to scope error handling to those routes.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service when one is configured.
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle size={28} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">مشکلی پیش آمد</h1>
            <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Please try again.</p>
            {error.digest && (
              <p className="mt-1 text-xs text-muted-foreground/60">Error ID: {error.digest}</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <RefreshCw size={15} /> Try again
            </button>
            <Link href="/fa" className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
