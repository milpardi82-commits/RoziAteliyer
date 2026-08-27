'use client';

/**
 * Favorites page — Client Component.
 *
 * Favorites are ephemeral (client-side only) until auth is implemented.
 * This page shows designs the user has hearted in the current session.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Heart, Star } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';
import { toPersianNumber } from '@/lib/i18n';
import { supabaseClient } from '@/lib/supabase/client';
import type { Design } from '@/types/marketplace';

export function FavoritesClient() {
  const { locale, dict, isRTL } = useLocale();
  const base = `/${locale}`;
  const [designs, setDesigns] = useState<Design[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDesigns() {
      const { data } = await supabaseClient()
        .from('designs')
        .select('*, creators(*)')
        .eq('is_public', true)
        .order('favorite_count', { ascending: false })
        .limit(8);
      if (data) setDesigns(data as Design[]);
      setLoading(false);
    }
    loadDesigns();
  }, []);

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((f) => f !== id) : [...current, id]
    );
  }

  const favoritedDesigns = designs.filter((d) => favorites.includes(d.id));
  const savedCount = isRTL ? toPersianNumber(favoritedDesigns.length) : favoritedDesigns.length;

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader favoriteCount={favorites.length} />

      <section className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{dict.favorites.yourCollection}</p>
          <h1 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{dict.favorites.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {savedCount} {isRTL ? dict.favorites.savedCount.replace('{count}', '') : (favoritedDesigns.length === 1 ? "design you've saved" : "designs you've saved")}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
        {loading ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-square skeleton-shimmer rounded-2xl" />
                <div className="mt-3 h-4 w-2/3 skeleton-shimmer rounded" />
              </div>
            ))}
          </div>
        ) : favoritedDesigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-muted">
              <Heart size={28} className="text-muted-foreground" />
            </span>
            <p className="text-lg font-semibold">{dict.favorites.noFavorites}</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{dict.favorites.noFavoritesDesc}</p>
            <Link
              href={`${base}/discover`}
              className="group mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5"
            >
              {dict.favorites.discoverDesigns}
              {isRTL
                ? <ArrowRight size={16} className="transition-transform group-hover:-translate-x-1 rotate-180" />
                : <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              }
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {favoritedDesigns.map((design) => (
              <article key={design.id} className="group min-w-0">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                  <Link href={`${base}/designs/${design.slug}`}>
                    <img src={design.image_url} alt={design.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  </Link>
                  <button
                    onClick={() => toggleFavorite(design.id)}
                    className="absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-all hover:scale-105 text-accent"
                    aria-label={dict.design.removeFromFavorites}
                  >
                    <Heart size={17} fill="currentColor" />
                  </button>
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`${base}/designs/${design.slug}`} className="block truncate text-sm font-semibold transition-colors hover:text-primary">
                      {design.title}
                    </Link>
                    <Link href={`${base}/artists/${design.creators?.handle ?? ''}`} className="mt-1 block truncate text-xs text-muted-foreground hover:text-foreground">
                      {design.creators?.display_name}
                    </Link>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pt-0.5 text-xs text-muted-foreground">
                    <Star size={12} fill="currentColor" className="text-accent" />
                    {isRTL ? toPersianNumber(design.avg_rating.toFixed(1)) : design.avg_rating.toFixed(1)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
