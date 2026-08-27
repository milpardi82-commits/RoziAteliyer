/**
 * Artist profile loading skeleton.
 */
import { SiteHeader } from '@/components/site-nav';

export default function ArtistLoading() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="h-56 skeleton-shimmer sm:h-64" />
      <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12">
        <div className="flex items-end gap-5">
          <div className="h-24 w-24 skeleton-shimmer rounded-2xl sm:h-28 sm:w-28" />
          <div className="pb-1 space-y-3">
            <div className="h-8 w-48 skeleton-shimmer rounded" />
            <div className="h-4 w-32 skeleton-shimmer rounded" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-square skeleton-shimmer rounded-2xl" />
              <div className="mt-3 h-4 w-2/3 skeleton-shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
