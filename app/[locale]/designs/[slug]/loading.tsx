/**
 * Design detail loading skeleton.
 */
import { SiteHeader } from '@/components/site-nav';

export default function DesignLoading() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12">
        <div className="h-4 w-32 skeleton-shimmer rounded mb-8" />
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-square skeleton-shimmer rounded-2xl" />
          <div className="space-y-5">
            <div className="h-6 w-24 skeleton-shimmer rounded" />
            <div className="h-12 w-2/3 skeleton-shimmer rounded" />
            <div className="h-4 w-1/3 skeleton-shimmer rounded" />
            <div className="h-24 skeleton-shimmer rounded" />
            <div className="h-16 skeleton-shimmer rounded-2xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
