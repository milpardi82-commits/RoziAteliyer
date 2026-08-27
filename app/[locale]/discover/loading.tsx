/**
 * Discover loading skeleton.
 */
import { SiteHeader } from '@/components/site-nav';

export default function DiscoverLoading() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
          <div className="h-4 w-32 skeleton-shimmer rounded mb-4" />
          <div className="h-10 w-64 skeleton-shimmer rounded" />
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="h-14 border-b border-border skeleton-shimmer" />
        <div className="flex gap-8 py-8">
          <div className="hidden w-56 shrink-0 lg:block">
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-9 skeleton-shimmer rounded-lg" />)}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-square skeleton-shimmer rounded-2xl" />
                  <div className="mt-3 h-4 w-2/3 skeleton-shimmer rounded" />
                  <div className="mt-2 h-3 w-1/3 skeleton-shimmer rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
