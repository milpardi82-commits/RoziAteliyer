'use client';

/**
 * Thumbnail — smart thumbnail component for marketplace grid cards.
 *
 * Renders the best available image source:
 *   1. thumbnailSignedUrl (from media pipeline) — highest priority
 *   2. thumbnail_url (designs.thumbnail_url — seed data / fallback)
 *   3. image_url (designs.image_url — seed data / fallback)
 *   4. Placeholder skeleton — when no source is available
 *
 * RTL compatible: uses logical CSS properties (start/end) everywhere.
 * Loading state: renders a skeleton while src is loading.
 * Error state: falls back to the next available source automatically.
 * Empty state: renders a branded placeholder.
 *
 * Design principles:
 *   - NEVER receives storage paths — only signed URLs or public image URLs.
 *   - The priority cascade ensures marketplace cards always render something.
 *   - aspect-square enforces consistent grid layout across all card sizes.
 */

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface ThumbnailProps {
  /** Signed URL from the media pipeline (preferred — private storage) */
  thumbnailSignedUrl?: string | null;
  /** designs.thumbnail_url (seed data / fallback) */
  thumbnailUrl?: string | null;
  /** designs.image_url (seed data / ultimate fallback) */
  imageUrl?: string | null;
  /** Alt text for accessibility */
  alt: string;
  /** Load eagerly for above-the-fold items */
  priority?: boolean;
  /** Additional className for the container */
  className?: string;
  /** Size hint for the rendered image (CSS value, e.g. '400px', '(max-width: 640px) 100vw') */
  sizes?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Thumbnail — smart image component with source priority cascade and fallbacks.
 *
 * @example
 * // From media pipeline (new uploads)
 * <Thumbnail
 *   thumbnailSignedUrl={media.thumbnailSignedUrl}
 *   alt={design.title}
 *   priority
 * />
 *
 * // From seed data (legacy/public designs)
 * <Thumbnail
 *   thumbnailUrl={design.thumbnail_url}
 *   imageUrl={design.image_url}
 *   alt={design.title}
 * />
 */
export function Thumbnail({
  thumbnailSignedUrl,
  thumbnailUrl,
  imageUrl,
  alt,
  priority = false,
  className = '',
  sizes,
}: ThumbnailProps) {
  // Build priority cascade of available sources
  const sources = [
    thumbnailSignedUrl,
    thumbnailUrl,
    imageUrl,
  ].filter(Boolean) as string[];

  const [srcIndex, setSrcIndex] = useState(0);
  const [loaded, setLoaded]     = useState(false);
  const [failed, setFailed]     = useState(false);

  const currentSrc = sources[srcIndex];

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!currentSrc || failed) {
    return (
      <div
        className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-muted ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageIcon
          size={32}
          className="text-muted-foreground/40"
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-2xl bg-muted ${className}`}
    >
      {/* Skeleton shown until image loads */}
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse bg-muted"
          aria-hidden="true"
        />
      )}

      <img
        src={currentSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        sizes={sizes}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          // Try the next source in the cascade
          if (srcIndex < sources.length - 1) {
            setSrcIndex((i) => i + 1);
            setLoaded(false);
          } else {
            setFailed(true);
          }
        }}
      />
    </div>
  );
}

// =============================================================================
// Variant: ThumbnailCompact
// =============================================================================

/**
 * ThumbnailCompact — a smaller square thumbnail for list rows and sidebar previews.
 *
 * @example
 * <ThumbnailCompact
 *   imageUrl={design.image_url}
 *   alt={design.title}
 *   size={48}
 * />
 */
export function ThumbnailCompact({
  thumbnailSignedUrl,
  thumbnailUrl,
  imageUrl,
  alt,
  size = 48,
}: Omit<ThumbnailProps, 'priority' | 'className' | 'sizes'> & { size?: number }) {
  const sources = [thumbnailSignedUrl, thumbnailUrl, imageUrl].filter(Boolean) as string[];
  const [srcIndex, setSrcIndex] = useState(0);
  const [loaded, setLoaded]     = useState(false);
  const [failed, setFailed]     = useState(false);

  const currentSrc = sources[srcIndex];

  if (!currentSrc || failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex flex-none items-center justify-center rounded-lg bg-muted"
        role="img"
        aria-label={alt}
      >
        <ImageIcon size={size * 0.35} className="text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="relative flex-none overflow-hidden rounded-lg bg-muted"
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
      )}
      <img
        src={currentSrc}
        alt={alt}
        loading="lazy"
        width={size}
        height={size}
        className={`h-full w-full object-cover transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (srcIndex < sources.length - 1) {
            setSrcIndex((i) => i + 1);
            setLoaded(false);
          } else {
            setFailed(true);
          }
        }}
      />
    </div>
  );
}
