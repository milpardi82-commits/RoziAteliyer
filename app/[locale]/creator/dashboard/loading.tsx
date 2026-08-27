/**
 * Creator Dashboard loading skeleton.
 * Shown by Next.js while dashboard data is streaming.
 */
import { SiteHeader } from '@/components/site-nav';

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      {/* Header band skeleton */}
      <div className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12">
          <div className="mb-2 h-3 w-28 skeleton-shimmer rounded" />
          <div className="h-10 w-48 skeleton-shimmer rounded" />
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        {/* Nav skeleton */}
        <div className="mt-6 flex gap-4 border-b border-border pb-px">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-24 skeleton-shimmer rounded-t-lg" />
          ))}
        </div>

        {/* Stats grid skeleton */}
        <div className="py-8 space-y-8">
          <div className="rounded-2xl border border-border/60 bg-[#f7f6f2] p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-3 w-24 skeleton-shimmer rounded" />
                <div className="h-7 w-36 skeleton-shimmer rounded" />
                <div className="h-3 w-40 skeleton-shimmer rounded" />
              </div>
              <div className="h-14 w-14 skeleton-shimmer rounded-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border p-5">
                <div className="mb-2 h-3 w-20 skeleton-shimmer rounded" />
                <div className="h-8 w-14 skeleton-shimmer rounded" />
              </div>
            ))}
          </div>

          {/* Design rows skeleton */}
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="h-10 bg-[#f7f6f2] border-b border-border" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0">
                <div className="h-12 w-12 skeleton-shimmer rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/5 skeleton-shimmer rounded" />
                  <div className="h-3 w-1/4 skeleton-shimmer rounded" />
                </div>
                <div className="h-5 w-20 skeleton-shimmer rounded-full" />
                <div className="h-5 w-28 skeleton-shimmer rounded hidden sm:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
