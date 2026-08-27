'use client';

/**
 * Artist profile page — Client Component.
 *
 * Receives pre-fetched data from the Server Component.
 * Handles interactive state: follow toggle, favourite toggles.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Check, Globe, Heart, MapPin, Palette, Star, Users } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';
import { toPersianNumber } from '@/lib/i18n';
import { DesignGrid } from '@/components/design/DesignCard';
import type { Creator, Design } from '@/types/marketplace';

interface Props {
  creator: Creator;
  initialDesigns: Design[];
}

export function ArtistProfileClient({ creator, initialDesigns }: Props) {
  const { locale, dict, isRTL } = useLocale();
  const base = `/${locale}`;
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((f) => f !== id) : [...current, id]
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader favoriteCount={favorites.length} />

      {/* Banner */}
      <section className="relative h-56 overflow-hidden bg-[#e8f0eb] sm:h-64">
        {creator.banner_url && (
          <img src={creator.banner_url} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </section>

      {/* Creator header */}
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
                {creator.is_verified && <Check size={20} className="rounded-full bg-primary p-1 text-primary-foreground" />}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {creator.location && <span className="flex items-center gap-1"><MapPin size={14} /> {creator.location}</span>}
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

      {/* Designs grid */}
      <section className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-display text-2xl font-medium tracking-[-0.04em]">{dict.artist.allDesigns}</h2>
          <span className="text-sm text-muted-foreground">
            {isRTL ? toPersianNumber(initialDesigns.length) : initialDesigns.length} {dict.artist.works}
          </span>
        </div>

        {initialDesigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-semibold">{dict.artist.noDesigns}</p>
            <p className="mt-2 text-sm text-muted-foreground">{dict.artist.noDesignsDesc}</p>
          </div>
        ) : (
          <DesignGrid
            designs={initialDesigns}
            favorites={favorites}
            onFavorite={toggleFavorite}
            base={base}
            priorityCount={4}
            hideCreator
          />
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
