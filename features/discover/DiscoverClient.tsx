'use client';

/**
 * Discover page — Client Component.
 *
 * Receives server-fetched initial data. Handles all interactive state:
 * search, category filter, sort order.
 */
import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { Heart, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';
import { toPersianNumber } from '@/lib/i18n';
import { supabaseClient } from '@/lib/supabase/client';
import { DesignGrid } from '@/components/design/DesignCard';
import type { Category, Design, DesignSortOption } from '@/types/marketplace';

interface Props {
  initialDesigns: Design[];
  categories: Category[];
}

export function DiscoverClient({ initialDesigns, categories }: Props) {
  const { locale, dict, isRTL } = useLocale();
  const base = `/${locale}`;

  const [designs, setDesigns] = useState<Design[]>(initialDesigns);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sort, setSort] = useState<DesignSortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadByCategory = useCallback(async (category: string) => {
    setLoading(true);
    try {
      if (category === 'all') {
        const { data } = await supabaseClient
          .from('designs')
          .select('*, creators(*)')
          .eq('is_public', true)
          .order('published_at', { ascending: false })
          .limit(48);
        setDesigns((data as Design[]) ?? initialDesigns);
      } else {
        const catId = categories.find((c) => c.slug === category)?.id;
        if (catId) {
          const { data } = await supabaseClient
            .from('design_categories')
            .select('designs!inner(*, creators(*))')
            .eq('category_id', catId);
          if (data) setDesigns(data.map((row: any) => row.designs) as Design[]);
          else setDesigns([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [categories, initialDesigns]);

  function handleCategoryChange(slug: string) {
    setActiveCategory(slug);
    setShowFilters(false);
    loadByCategory(slug);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((f) => f !== id) : [...current, id]
    );
  }

  const filtered = useMemo(() => {
    let result = [...designs];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) => d.title.toLowerCase().includes(q) || (d.creators?.display_name ?? '').toLowerCase().includes(q)
      );
    }
    switch (sort) {
      case 'popular':   result.sort((a, b) => b.view_count - a.view_count); break;
      case 'rating':    result.sort((a, b) => b.avg_rating - a.avg_rating); break;
      case 'favorites': result.sort((a, b) => b.favorite_count - a.favorite_count); break;
      default:          result.sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime());
    }
    return result;
  }, [designs, search, sort]);

  const countLabel = isRTL
    ? toPersianNumber(filtered.length) + ' ' + dict.discover.designsUnit
    : `${filtered.length} ${filtered.length === 1 ? 'design' : 'designs'}`;

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader favoriteCount={favorites.length} />

      <section className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{dict.discover.browseMarketplace}</p>
          <h1 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">
            {activeCategory === 'all'
              ? dict.discover.allDesigns
              : categories.find((c) => c.slug === activeCategory)?.name ?? dict.discover.allDesigns}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{countLabel}</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        {/* Search + Sort bar */}
        <div className="flex items-center gap-3 border-b border-border py-4">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
            <Search size={17} className="text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={dict.discover.searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((o) => !o)}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted lg:hidden"
          >
            <SlidersHorizontal size={16} /> {dict.discover.filters}
          </button>
          <div className="hidden items-center gap-2 lg:flex">
            <span className="text-sm text-muted-foreground">{dict.discover.sortBy}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as DesignSortOption)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-muted"
            >
              <option value="newest">{dict.discover.sortNewest}</option>
              <option value="popular">{dict.discover.sortPopular}</option>
              <option value="rating">{dict.discover.sortRating}</option>
              <option value="favorites">{dict.discover.sortFavorites}</option>
            </select>
          </div>
        </div>

        <div className="flex gap-8 py-8">
          {/* Sidebar filters */}
          <aside className={`${showFilters ? 'block' : 'hidden'} w-56 shrink-0 lg:block`}>
            <div className="sticky top-24 space-y-6">
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">{dict.discover.categories}</h3>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleCategoryChange('all')}
                    className={`rounded-lg px-3 py-2 text-start text-sm transition-colors ${activeCategory === 'all' ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                  >
                    {dict.discover.allDesigns}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.slug)}
                      className={`rounded-lg px-3 py-2 text-start text-sm transition-colors ${activeCategory === cat.slug ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    >
                      {cat.name}
                      <span className="ms-2 text-xs text-muted-foreground/70">
                        {isRTL ? toPersianNumber(cat.design_count) : cat.design_count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Designs grid */}
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i}>
                    <div className="aspect-square skeleton-shimmer rounded-2xl" />
                    <div className="mt-3 h-4 w-2/3 skeleton-shimmer rounded" />
                    <div className="mt-2 h-3 w-1/3 skeleton-shimmer rounded" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-lg font-semibold">{dict.discover.noDesigns}</p>
                <p className="mt-2 text-sm text-muted-foreground">{dict.discover.noDesignsDesc}</p>
              </div>
            ) : (
              <DesignGrid
                designs={filtered}
                favorites={favorites}
                onFavorite={toggleFavorite}
                base={base}
                priorityCount={4}
              />
            )}
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
