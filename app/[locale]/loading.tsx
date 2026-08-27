/**
 * Locale-level loading skeleton.
 * Shown by Next.js while any [locale]/* page is streaming.
 * Provides an instant visual shell that matches the page structure.
 */
export default function LocaleLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="sticky top-0 z-50 h-[72px] border-b border-border/70 bg-background/90" />

      {/* Hero skeleton */}
      <div className="border-b border-border/60 bg-[#e8f0eb]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12">
          <div className="h-4 w-32 skeleton-shimmer rounded mb-6" />
          <div className="h-16 w-2/3 skeleton-shimmer rounded mb-4" />
          <div className="h-16 w-1/2 skeleton-shimmer rounded mb-6" />
          <div className="h-5 w-full max-w-md skeleton-shimmer rounded" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12">
        <div className="mb-10 h-8 w-48 skeleton-shimmer rounded" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-square skeleton-shimmer rounded-2xl" />
              <div className="mt-3 h-4 w-2/3 skeleton-shimmer rounded" />
              <div className="mt-2 h-3 w-1/3 skeleton-shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
