'use client';

/**
 * MediaPreview — displays a design's preview or original image in the
 * creator's design editor and design detail view.
 *
 * Renders the best available image for creator review:
 *   1. previewSignedUrl  (signed URL from media pipeline — highest priority)
 *   2. originalSignedUrl (signed URL, only for the owning creator)
 *   3. imageUrl          (designs.image_url — seed/fallback)
 *   4. Loading skeleton  (while signed URLs are being fetched)
 *   5. Error state       (when all sources have failed)
 *   6. Empty state       (when no image has been uploaded yet)
 *
 * RTL compatible: uses start/end logical properties.
 * Never receives a storage_path — only opaque signed URL strings.
 *
 * Used by:
 *   - features/creator/design-editor: upload progress + preview
 *   - future: design detail page media viewer
 */

import { useState, useEffect } from 'react';
import { ImageIcon, RefreshCw, AlertTriangle } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface MediaPreviewProps {
  /** Signed preview URL (from media pipeline) */
  previewSignedUrl?: string | null;
  /** Signed original URL (owner only) */
  originalSignedUrl?: string | null;
  /** Fallback public image URL (seed data or placeholder) */
  imageUrl?: string | null;
  /** Alt text for accessibility */
  alt: string;
  /** Show a loading skeleton (e.g. while the upload Route Handler is running) */
  loading?: boolean;
  /** Aspect ratio for the container — default 'square' */
  aspect?: 'square' | 'video' | 'auto';
  /** Additional class names for the container */
  className?: string;
  /** Called when the user wants to replace the image (shows re-upload hint) */
  onReplace?: () => void;
  /** Whether to show the "Replace" overlay button */
  showReplace?: boolean;
}

// =============================================================================
// Component
// =============================================================================

/**
 * MediaPreview — shows the design's preview image with state management.
 *
 * @example
 * // Creator editor (after upload)
 * <MediaPreview
 *   previewSignedUrl={urls.preview?.signedUrl}
 *   originalSignedUrl={urls.original?.signedUrl}
 *   alt={design.title}
 *   showReplace
 *   onReplace={() => setUploadMode(true)}
 * />
 *
 * // Design detail page (public)
 * <MediaPreview
 *   imageUrl={design.image_url}
 *   alt={design.title}
 *   aspect="square"
 * />
 *
 * // Uploading state
 * <MediaPreview alt="Uploading..." loading />
 */
export function MediaPreview({
  previewSignedUrl,
  originalSignedUrl,
  imageUrl,
  alt,
  loading = false,
  aspect = 'square',
  className = '',
  onReplace,
  showReplace = false,
}: MediaPreviewProps) {
  // Priority cascade of image sources
  const sources = [
    previewSignedUrl,
    originalSignedUrl,
    imageUrl,
  ].filter(Boolean) as string[];

  const [srcIndex, setSrcIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError]   = useState(false);

  // Reset when sources change (e.g. after upload completes)
  useEffect(() => {
    setSrcIndex(0);
    setImgLoaded(false);
    setImgError(false);
  }, [previewSignedUrl, originalSignedUrl, imageUrl]);

  const currentSrc = sources[srcIndex];

  const aspectClass = {
    square: 'aspect-square',
    video:  'aspect-video',
    auto:   '',
  }[aspect];

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className={`relative w-full overflow-hidden rounded-2xl bg-muted ${aspectClass} ${className}`}
        role="status"
        aria-label="Loading preview"
      >
        <div className="absolute inset-0 animate-pulse bg-muted" />
        <div className="absolute inset-0 flex items-center justify-center">
          <RefreshCw
            size={24}
            className="animate-spin text-muted-foreground/40"
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }

  // ── Error / empty state ───────────────────────────────────────────────────
  if (!currentSrc || imgError) {
    return (
      <div
        className={`relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/50 ${aspectClass} ${className}`}
        role="img"
        aria-label={alt || 'No image uploaded'}
      >
        {imgError ? (
          <>
            <AlertTriangle size={28} className="text-muted-foreground/50" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">Image could not be loaded</p>
          </>
        ) : (
          <>
            <ImageIcon size={32} className="text-muted-foreground/40" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">No image uploaded yet</p>
          </>
        )}

        {showReplace && onReplace && (
          <button
            type="button"
            onClick={onReplace}
            className="mt-2 rounded-lg bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-muted"
          >
            Upload image
          </button>
        )}
      </div>
    );
  }

  // ── Normal state ──────────────────────────────────────────────────────────
  return (
    <div
      className={`group relative w-full overflow-hidden rounded-2xl bg-muted ${aspectClass} ${className}`}
    >
      {/* Skeleton while image loads */}
      {!imgLoaded && (
        <div
          className="absolute inset-0 animate-pulse bg-muted"
          aria-hidden="true"
        />
      )}

      <img
        src={currentSrc}
        alt={alt}
        loading="lazy"
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          imgLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setImgLoaded(true)}
        onError={() => {
          if (srcIndex < sources.length - 1) {
            setSrcIndex((i) => i + 1);
            setImgLoaded(false);
          } else {
            setImgError(true);
          }
        }}
      />

      {/* Optional replace overlay */}
      {showReplace && onReplace && imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100">
          <button
            type="button"
            onClick={onReplace}
            className="rounded-xl bg-white/95 px-4 py-2 text-sm font-semibold text-foreground shadow backdrop-blur hover:bg-white"
          >
            Replace image
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Variant: MediaPreviewCompact
// =============================================================================

/**
 * MediaPreviewCompact — a small, square preview for use in list rows and
 * dashboard design cards.
 *
 * @example
 * <MediaPreviewCompact
 *   imageUrl={design.image_url}
 *   alt={design.title}
 *   size={64}
 * />
 */
export function MediaPreviewCompact({
  previewSignedUrl,
  originalSignedUrl,
  imageUrl,
  alt,
  size = 64,
  loading = false,
}: Pick<MediaPreviewProps, 'previewSignedUrl' | 'originalSignedUrl' | 'imageUrl' | 'alt' | 'loading'> & {
  size?: number;
}) {
  const sources = [previewSignedUrl, originalSignedUrl, imageUrl].filter(Boolean) as string[];
  const [srcIndex, setSrcIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError]   = useState(false);

  const currentSrc = sources[srcIndex];

  if (loading) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex-none animate-pulse rounded-xl bg-muted"
        role="status"
        aria-label="Loading"
      />
    );
  }

  if (!currentSrc || imgError) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex flex-none items-center justify-center rounded-xl bg-muted"
        role="img"
        aria-label={alt}
      >
        <ImageIcon size={size * 0.33} className="text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="relative flex-none overflow-hidden rounded-xl bg-muted"
    >
      {!imgLoaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
      )}
      <img
        src={currentSrc}
        alt={alt}
        loading="lazy"
        width={size}
        height={size}
        className={`h-full w-full object-cover transition-opacity duration-200 ${
          imgLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setImgLoaded(true)}
        onError={() => {
          if (srcIndex < sources.length - 1) {
            setSrcIndex((i) => i + 1);
            setImgLoaded(false);
          } else {
            setImgError(true);
          }
        }}
      />
    </div>
  );
}
