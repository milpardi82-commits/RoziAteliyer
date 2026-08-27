'use client';

/**
 * DesignCard — reusable card component for displaying a single design.
 *
 * Renders the design thumbnail, title, creator link, rating, favourite button,
 * and featured badge. Used across: Home, Discover, Artist profile, Favorites.
 *
 * Must remain a Client Component because it handles the interactive favourite button.
 */
import Link from 'next/link';
import { Heart, Star } from 'lucide-react';
import { useLocale } from '@/components/locale-provider';
import { toPersianNumber } from '@/lib/i18n';
import type { Design } from '@/types/marketplace';

export interface DesignCardProps {
  design: Design;
  isFavorite: boolean;
  onFavorite: (id: string) => void;
  /** Load the image eagerly (above-the-fold cards) */
  priority?: boolean;
  base: string;
  /** Hide the creator link (e.g. on the artist profile page) */
  hideCreator?: boolean;
}

export function DesignCard({
  design,
  isFavorite,
  onFavorite,
  priority = false,
  base,
  hideCreator = false,
}: DesignCardProps) {
  const { dict, isRTL } = useLocale();

  return (
    <article className="group min-w-0">
      <DesignImage
        design={design}
        base={base}
        priority={priority}
        isFavorite={isFavorite}
        onFavorite={onFavorite}
        dict={dict}
      />
      <DesignMeta
        design={design}
        base={base}
        isRTL={isRTL}
        hideCreator={hideCreator}
      />
    </article>
  );
}

// ─── DesignImage ─────────────────────────────────────────────────────────────

interface DesignImageProps {
  design: Design;
  base: string;
  priority: boolean;
  isFavorite: boolean;
  onFavorite: (id: string) => void;
  dict: { design: { featured: string; addToFavorites: string; removeFromFavorites: string } };
}

export function DesignImage({
  design,
  base,
  priority,
  isFavorite,
  onFavorite,
  dict,
}: DesignImageProps) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
      <Link href={`${base}/designs/${design.slug}`}>
        <img
          src={design.image_url}
          alt={design.title}
          loading={priority ? 'eager' : 'lazy'}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </Link>

      <DesignActions
        designId={design.id}
        isFavorite={isFavorite}
        onFavorite={onFavorite}
        addLabel={dict.design.addToFavorites}
        removeLabel={dict.design.removeFromFavorites}
      />

      {design.is_featured && (
        <span className="absolute bottom-3 start-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground backdrop-blur">
          {dict.design.featured}
        </span>
      )}
    </div>
  );
}

// ─── DesignMeta ──────────────────────────────────────────────────────────────

interface DesignMetaProps {
  design: Design;
  base: string;
  isRTL: boolean;
  hideCreator?: boolean;
}

export function DesignMeta({ design, base, isRTL, hideCreator = false }: DesignMetaProps) {
  return (
    <div className="mt-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <Link
          href={`${base}/designs/${design.slug}`}
          className="block truncate text-sm font-semibold transition-colors hover:text-primary"
        >
          {design.title}
        </Link>
        {!hideCreator && design.creators && (
          <Link
            href={`${base}/artists/${design.creators.handle}`}
            className="mt-1 block truncate text-xs text-muted-foreground hover:text-foreground"
          >
            {design.creators.display_name}
          </Link>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 pt-0.5 text-xs text-muted-foreground">
        <Star size={12} fill="currentColor" className="text-accent" />
        {isRTL ? toPersianNumber(design.avg_rating.toFixed(1)) : design.avg_rating.toFixed(1)}
      </div>
    </div>
  );
}

// ─── DesignActions ────────────────────────────────────────────────────────────

interface DesignActionsProps {
  designId: string;
  isFavorite: boolean;
  onFavorite: (id: string) => void;
  addLabel: string;
  removeLabel: string;
}

export function DesignActions({
  designId,
  isFavorite,
  onFavorite,
  addLabel,
  removeLabel,
}: DesignActionsProps) {
  return (
    <button
      onClick={() => onFavorite(designId)}
      className={`absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-all hover:scale-105 ${
        isFavorite ? 'text-accent' : 'text-foreground/65'
      }`}
      aria-label={isFavorite ? removeLabel : addLabel}
    >
      {isFavorite ? <Heart size={17} fill="currentColor" /> : <Heart size={17} />}
    </button>
  );
}

// ─── DesignGrid ───────────────────────────────────────────────────────────────

interface DesignGridProps {
  designs: Design[];
  favorites: string[];
  onFavorite: (id: string) => void;
  base: string;
  priorityCount?: number;
  hideCreator?: boolean;
}

export function DesignGrid({
  designs,
  favorites,
  onFavorite,
  base,
  priorityCount = 4,
  hideCreator = false,
}: DesignGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {designs.map((design, index) => (
        <DesignCard
          key={design.id}
          design={design}
          isFavorite={favorites.includes(design.id)}
          onFavorite={onFavorite}
          priority={index < priorityCount}
          base={base}
          hideCreator={hideCreator}
        />
      ))}
    </div>
  );
}
