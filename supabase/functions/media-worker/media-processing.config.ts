// supabase/functions/media-worker/media-processing.config.ts
//
// Phase 10 — Centralized image processing configuration.
//
// All dimension, quality, and format constants live here.
// No hardcoded values should appear inside the worker itself.
// Consumers import from this file only.

// ---------------------------------------------------------------------------
// Output dimensions (longest edge, px)
// ---------------------------------------------------------------------------

/** Maximum longest-edge pixel dimension for preview images */
export const PREVIEW_WIDTH = 1200 as const;

/** Maximum longest-edge pixel dimension for thumbnail images */
export const THUMBNAIL_WIDTH = 400 as const;

// ---------------------------------------------------------------------------
// Compression quality (0–100, higher = better quality / larger file)
// ---------------------------------------------------------------------------

/** JPEG output quality for preview images */
export const JPEG_QUALITY = 85 as const;

/** WEBP output quality for preview images */
export const WEBP_QUALITY = 82 as const;

/** JPEG output quality for thumbnail images (slightly lower for speed) */
export const THUMBNAIL_JPEG_QUALITY = 80 as const;

/** WEBP output quality for thumbnail images */
export const THUMBNAIL_WEBP_QUALITY = 78 as const;

// ---------------------------------------------------------------------------
// Output format
// ---------------------------------------------------------------------------

/** Default MIME type used for all derived (preview/thumbnail) outputs */
export const OUTPUT_MIME = 'image/jpeg' as const;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** Supabase Storage bucket that holds all design media (private) */
export const DESIGNS_BUCKET = 'designs-private' as const;

/** Supabase Storage bucket for publicly CDN-delivered thumbnails and previews (Phase 11) */
export const PUBLIC_BUCKET = 'designs-public' as const;

// ---------------------------------------------------------------------------
// Worker runtime
// ---------------------------------------------------------------------------

/** Maximum jobs processed in a single worker invocation */
export const BATCH_SIZE = 5 as const;

/** Maximum retry attempts before permanently marking a job failed */
export const MAX_ATTEMPTS = 3 as const;

/** Maximum retained entries in media_assets.processing_log per asset */
export const MAX_LOG_ENTRIES = 100 as const;

// ---------------------------------------------------------------------------
// Memory / safety limits
// ---------------------------------------------------------------------------

/**
 * Maximum raw file size (in bytes) the worker will process in-memory.
 * Files larger than this are rejected with a clear error rather than OOM.
 * 50 MB matches the Storage bucket upload limit.
 */
export const MAX_PROCESS_BYTES = 52_428_800 as const; // 50 MB

/**
 * Maximum acceptable pixel dimension on any single axis.
 * Prevents decompression bombs (e.g. a 1-byte PNG that decodes to 30 000 × 30 000).
 */
export const MAX_DIMENSION_PX = 30_000 as const;
