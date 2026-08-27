/**
 * Public Collection page — loading skeleton.
 * Mirrors the layout structure of PublicCollectionClient.
 */
import { SiteHeader } from '@/components/site-nav';

export default function CollectionLoading() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero skeleton */}
      <section className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="mb-6 h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
            <div className="h-40 w-40 shrink-0 animate-pulse rounded-2xl bg-muted sm:h-48 sm:w-48" />
            <div className="flex-1 space-y-4">
              <div className="h-10 w-64 animate-pulse rounded bg-muted" />
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-16 w-full max-w-md animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      </section>

      {/* Grid skeleton */}
      <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12">
        <div className="mb-8 h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
