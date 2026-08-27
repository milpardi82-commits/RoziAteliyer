'use client';

/**
 * Artist profile error boundary.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { SiteHeader } from '@/components/site-nav';

export default function ArtistError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error('[ArtistError]', error); }, [error]);
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
        <AlertTriangle size={32} className="text-destructive" />
        <p className="text-xl font-semibold">خطا در بارگذاری پروفایل</p>
        <p className="text-sm text-muted-foreground">Failed to load artist profile. Please try again.</p>
        <div className="flex gap-3 mt-2">
          <button onClick={reset} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            <RefreshCw size={15} /> Try again
          </button>
          <Link href="/fa/discover" className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
            Back to browse
          </Link>
        </div>
      </div>
    </main>
  );
}
