'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Check, Globe, Heart, MapPin, Palette, Star, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Creator, Design } from '@/lib/types';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';
import { toPersianNumber } from '@/lib/i18n';

export default function CreatorProfilePage() {
  const { locale, dict, isRTL } = useLocale();
  const base = `/${locale}`;
  const params = useParams();
  const handle = params.handle as string;

  const [creator, setCreator] = useState<Creator | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    async function loadCreator() {
      const { data: creatorData } = await supabase
        .from('creators')
        .select('*')
        .eq('handle', handle)
        .maybeSingle();

      if (creatorData) {
        setCreator(creatorData as Creator);
        const { data: designData } = await supabase
          .from('designs')
          .select('*, creators(*)')
          .eq('creator_id', (creatorData as Creator).id)
          .eq('is_public', true)
          .order('published_at', { ascending: false });
        if (designData) setDesigns(designData as Design[]);
      }
      setLoading(false);
    }
    if (handle) loadCreator();
  }, [handle]);

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((f) => f !== id) : [...current, id]
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <SiteHeader />
        <div className="h-48 skeleton-shimmer" />
        <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12">
          <div className="h-20 w-20 skeleton-shimmer rounded-full" />
          <div className="mt-4 h-8 w-1/3 skeleton-shimmer rounded" />
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square skeleton-shimmer rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!creator) {
    return (
      <main className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <p className="text-2xl font-semibold">{dict.artist.notFound}</p>
          <Link href={`${base}/discover`} className="mt-4 text-sm font-semibold text-primary">
            {dict.discover.allDesigns}
          </Link>
        </div>
        <SiteFooter />
      </main>
    );
  }

  const localeCode = isRTL ? 'fa-IR' : 'en-US';

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader favoriteCount={favorites.length} />

      <section className="relative h-56 overflow-hidden bg-[#e8f0eb] sm:h-64">
        {creator.banner_url && (
          <img src={creator.banner_url} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </section>

      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="-mt-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-5">
            <span className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-lg sm:h-28 sm:w-28">
              {creator.avatar_url && (
                <img src={creator.avatar_url} alt={creator.display_name} className="h-full w-full object-cover" />
              )}
            </span>
            <div className="pb-1">
              <h1 className="flex items-center gap-2 font-display text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
                {creator.display_name}
                {creator.is_verified && (
                  <Check size={20} className="rounded-full bg-primary p-1 text-primary-foreground" />
                )}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin size={14} /> {creator.location}</span>
                <span className="flex items-center gap-1"><Palette size={14} /> {isRTL ? toPersianNumber(creator.design_count) : creator.design_count} {dict.artist.designs}</span>
                <span className="flex items-center gap-1"><Users size={14} /> {isRTL ? toPersianNumber(creator.follower_count.toLocaleString()) : creator.follower_count.toLocaleString()} {dict.artist.followers}</span>
                {creator.website_url && (
                  <a href={creator.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <Globe size={14} /> {dict.artist.website}
                  </a>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsFollowing((f) => !f)}
            className={`flex w-fit items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all ${
              isFollowing
                ? 'border border-border text-muted-foreground hover:border-destructive hover:text-destructive'
                : 'bg-primary text-primary-foreground shadow-lg shadow-primary/15 hover:-translate-y-0.5'
            }`}
          >
            <Heart size={16} fill={isFollowing ? 'currentColor' : 'none'} />
            {isFollowing ? dict.artist.following : dict.artist.follow}
          </button>
        </div>

        {creator.bio && (
          <p className="mt-6 max-w-2xl text-[15px] leading-7 text-muted-foreground">{creator.bio}</p>
        )}
      </div>

      <section className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-display text-2xl font-medium tracking-[-0.04em]">{dict.artist.allDesigns}</h2>
          <span className="text-sm text-muted-foreground">{isRTL ? toPersianNumber(designs.length) : designs.length} {designs.length === 1 ? dict.artist.works : dict.artist.works}</span>
        </div>

        {designs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-semibold">{dict.artist.noDesigns}</p>
            <p className="mt-2 text-sm text-muted-foreground">{dict.artist.noDesignsDesc}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {designs.map((design, index) => (
              <DesignCard
                key={design.id}
                design={design}
                isFavorite={favorites.includes(design.id)}
                onFavorite={toggleFavorite}
                priority={index < 4}
                base={base}
              />
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}

function DesignCard({
  design,
  isFavorite,
  onFavorite,
  priority,
  base,
}: {
  design: Design;
  isFavorite: boolean;
  onFavorite: (id: string) => void;
  priority?: boolean;
  base: string;
}) {
  const { dict, isRTL } = useLocale();
  return (
    <article className="group min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
        <Link href={`${base}/designs/${design.slug}`}>
          <img
            src={design.image_url}
            alt={design.title}
            loading={priority ? 'eager' : 'lazy'}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </Link>
        <button
          onClick={() => onFavorite(design.id)}
          className={`absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-all hover:scale-105 ${
            isFavorite ? 'text-accent' : 'text-foreground/65'
          }`}
          aria-label={isFavorite ? dict.design.removeFromFavorites : dict.design.addToFavorites}
        >
          {isFavorite ? <Heart size={17} fill="currentColor" /> : <Heart size={17} />}
        </button>
        {design.is_featured && (
          <span className="absolute bottom-3 start-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] backdrop-blur">
            {dict.design.featured}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`${base}/designs/${design.slug}`}
            className="block truncate text-sm font-semibold transition-colors hover:text-primary"
          >
            {design.title}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-0.5 text-xs text-muted-foreground">
          <Star size={12} fill="currentColor" className="text-accent" />
          {isRTL ? toPersianNumber(design.avg_rating.toFixed(1)) : design.avg_rating.toFixed(1)}
        </div>
      </div>
    </article>
  );
}
