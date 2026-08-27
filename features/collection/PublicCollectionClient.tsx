'use client';

/**
 * PublicCollectionClient — Client Component for the public collection page.
 *
 * Receives all data pre-fetched by the Server Component.
 * Handles the interactive favourite toggle state (ephemeral, pre-auth).
 *
 * Renders:
 *   - Collection hero (cover, title, description, creator identity)
 *   - Designs grid using existing DesignCard/Thumbnail infrastructure
 *   - Empty state for published collections with zero public designs
 *
 * Uses the existing marketplace visual language (SiteHeader, SiteFooter,
 * DesignGrid, Thumbnail). No new design system introduced.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, ImageIcon, Layers } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';
import { toPersianNumber } from '@/lib/i18n';
import { Thumbnail } from '@/components/media/Thumbnail';
import { DesignCard } from '@/components/design/DesignCard';
import type { PublicCollectionResult } from '@/services/collection.service';
import type { DesignPublicMedia } from '@/types/media';

// =============================================================================
// Types
// =============================================================================

interface Props {
  result: PublicCollectionResult;
  /** Batch CDN media map from batchGetDesignPublicMedia() */
  mediaMap: Record<string, DesignPublicMedia>;
}

// =============================================================================
// Component
// =============================================================================

export function PublicCollectionClient({ result, mediaMap }: Props) {
  const { locale, dict, isRTL } = useLocale();
  const base = `/${locale}`;
  const [favorites, setFavorites] = useState<string[]>([]);

  const { collection, creator, designs } = result;

  function toggleFavorite(id: string) {
    setFavorites((curr) =>
      curr.includes(id) ? curr.filter((f) => f !== id) : [...curr, id]
    );
  }

  const designCount = isRTL
    ? toPersianNumber(designs.length)
    : designs.length;

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader favoriteCount={favorites.length} />

      {/* ── Collection Hero ── */}
      <section className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">

          {/* Back to artist */}
          {creator && (
            <Link
              href={`${base}/artists/${creator.handle}`}
              className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {isRTL
                ? <ArrowRight size={14} />
                : <ArrowLeft size={14} />
              }
              {dict.collection.backToArtist}
            </Link>
          )}

          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
            {/* Cover image */}
            <div className="h-40 w-40 shrink-0 overflow-hidden rounded-2xl bg-muted sm:h-48 sm:w-48">
              {collection.cover_image_url ? (
                <img
                  src={collection.cover_image_url}
                  alt={collection.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Layers size={40} className="text-muted-foreground/30" aria-hidden="true" />
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
                {collection.name}
              </h1>

              {/* Creator identity */}
              {creator && (
                <Link
                  href={`${base}/artists/${creator.handle}`}
                  className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {creator.avatar_url ? (
                    <img
                      src={creator.avatar_url}
                      alt={creator.display_name}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-muted" />
                  )}
                  <span className="font-medium text-foreground">{creator.display_name}</span>
                  {creator.is_verified && (
                    <Check size={13} className="rounded-full bg-primary p-0.5 text-primary-foreground" />
                  )}
                </Link>
              )}

              {collection.description && (
                <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
                  {collection.description}
                </p>
              )}

              <p className="mt-4 text-sm text-muted-foreground">
                {designCount} {dict.collection.designsCount.replace('{count}', '')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Designs Grid ── */}
      <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12">
        <h2 className="mb-8 font-display text-2xl font-medium tracking-[-0.04em]">
          {dict.collection.collectionDesigns}
        </h2>

        {designs.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-[#f7f6f2] px-8 py-24 text-center">
            <ImageIcon size={40} className="mb-4 text-muted-foreground/30" />
            <p className="text-lg font-semibold">{dict.collection.noDesigns}</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{dict.collection.noDesignsDesc}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {designs.map((design, index) => {
              const media = mediaMap[design.id];
              // Build a Design-compatible object for DesignCard.
              // Uses public CDN URL from mediaMap with fallback to existing image fields.
              const cardDesign = {
                ...design,
                description:   null,
                thumbnail_url: media?.thumbnailCdnUrl ?? design.thumbnail_url,
                image_url:     design.image_url,
                is_public: true,
                is_featured: false,
                status: 'published' as const,
                view_count: 0,
                favorite_count: 0,
                review_count: 0,
                avg_rating: design.avg_rating,
                published_at: null,
                creator_id: creator?.id ?? '',
                shop_id: null,
                colors: [],
                width_px: 0,
                height_px: 0,
                dpi: 0,
                created_at: '',
                updated_at: '',
                creators: design.creators
                  ? { ...design.creators, id: '', user_id: null, bio: null, location: null, avatar_url: null, banner_url: null, website_url: null, is_verified: false, design_count: 0, follower_count: 0, created_at: '', updated_at: '' }
                  : undefined,
              };

              return (
                <DesignCard
                  key={design.id}
                  design={cardDesign}
                  isFavorite={favorites.includes(design.id)}
                  onFavorite={toggleFavorite}
                  priority={index < 4}
                  base={base}
                />
              );
            })}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
