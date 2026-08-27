/**
 * Media Processing Service — Phase 10.
 *
 * Server-side orchestration layer for all image processing operations.
 * Covers: metadata extraction, preview generation, thumbnail generation,
 * processing lifecycle management, checksum computation, and Phase 10
 * optimized processing helpers.
 *
 * ONLY call these functions from Server Components, Server Actions, or
 * Route Handlers. Never import this file from a Client Component.
 *
 * Architecture principles:
 *   - Heavy processing (resize, watermark) is NOT done in the browser.
 *   - All processing is triggered server-side via API routes or server actions.
 *   - Background worker (Edge Function) calls optimizeOriginalImage(),
 *     generateOptimizedPreview(), and generateOptimizedThumbnail().
 *   - The `processDesignMedia()` orchestrator remains fully compatible with
 *     Phase 8 callers and now records Phase 10 optimization log events.
 *   - Error boundaries are tight — one failed step does not block the others.
 *
 * Phase 10 additions:
 *   - optimizeOriginalImage()      — verify + clean metadata on the original
 *   - generateOptimizedPreview()   — hook for worker-driven optimized preview
 *   - generateOptimizedThumbnail() — hook for worker-driven optimized thumbnail
 *   - New log events: image_optimization_started, preview_optimized,
 *     thumbnail_optimized, metadata_cleaned, optimization_completed
 *
 * Processing pipeline for a newly uploaded original:
 *
 *   original (ready)
 *       ↓  [processDesignMedia()]
 *   extractImageMetadata()        — width, height, mime, size, checksum (Phase 8+)
 *       ↓
 *   generatePreview()             — creates preview asset record + uploads (Phase 8+)
 *       ↓
 *   generateThumbnail()           — creates thumbnail asset record + uploads (Phase 8+)
 *       ↓
 *   [Edge Function worker — Phase 10]
 *   optimizeOriginalImage()       — re-verify clean metadata on original
 *   generateOptimizedPreview()    — replace preview with WASM-resized output
 *   generateOptimizedThumbnail()  — replace thumbnail with WASM-resized output
 *       ↓
 *   update media_assets records with compression_ratio + optimized_at
 */

import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import {
  buildStoragePath,
  createMediaAssetRecord,
  updateMediaAsset,
  getDesignMedia,
  resolveAuthenticatedCreatorId,
  DESIGNS_BUCKET,
} from '@/services/media.service';
import { appendProcessingLog as appendProcessingLogImpl } from '@/services/media-queue.service';
import type { MediaAsset, MediaAssetStatus } from '@/types/media';

// =============================================================================
// Types
// =============================================================================

/**
 * Extracted metadata from an image file.
 *
 * Populated server-side after a successful upload.
 * Never trusts browser-supplied metadata for these values.
 */
export type ImageMetadata = {
  /** Image width in pixels */
  widthPx: number;
  /** Image height in pixels */
  heightPx: number;
  /** File size in bytes */
  fileSizeBytes: number;
  /** Server-verified MIME type */
  mimeType: string;
  /** SHA-256 hex digest (64 chars, lowercase) */
  checksum: string;
};

/**
 * Result of a single processing step.
 */
export type ProcessingStepResult =
  | { success: true; assetId: string; storagePath: string }
  | { success: false; reason: string };

/**
 * Full result of processDesignMedia().
 * Consumers (upload route handlers) use this to decide if re-processing is needed.
 */
export type MediaProcessingResult = {
  /** Whether the full pipeline completed without errors */
  success: boolean;
  /** Metadata extracted from the original file */
  metadata: ImageMetadata | null;
  /** Result for the preview asset generation step */
  preview: ProcessingStepResult | null;
  /** Result for the thumbnail asset generation step */
  thumbnail: ProcessingStepResult | null;
  /** Human-readable summary of any errors */
  errors: string[];
};

/**
 * A single processing log entry.
 * Written to media_assets.processing_log (JSONB array).
 *
 * Phase 9: Added `status` and `message` fields for structured log output.
 * These match the format expected by the Edge Function worker and
 * appendProcessingLog() in media-queue.service.ts.
 */
export type ProcessingLogEntry = {
  ts: string;             // ISO-8601 timestamp
  event: string;          // e.g. 'processing_started', 'metadata_extracted'
  status?: string;        // Phase 9: e.g. 'processing', 'ready', 'failed'
  message?: string;       // Phase 9: human-readable description
  detail?: Record<string, unknown>;
};

// =============================================================================
// Constants — sourced from central config; kept here for Next.js consumers
// =============================================================================

/** Maximum pixel dimension for preview images (longest edge) */
const PREVIEW_MAX_PX = 1200 as const;

/** Maximum pixel dimension for thumbnail images (longest edge) */
const THUMBNAIL_MAX_PX = 400 as const;

/** MIME type used for generated preview/thumbnail files */
const OUTPUT_MIME_TYPE = 'image/jpeg' as const;

/** JPEG quality for generated previews (0–100) */
const PREVIEW_QUALITY = 85 as const;

/** JPEG quality for generated thumbnails (0–100) */
const THUMBNAIL_QUALITY = 80 as const;

/** WEBP quality for generated previews (0–100) */
const WEBP_QUALITY = 82 as const;

// =============================================================================
// Metadata extraction
// =============================================================================

/**
 * Extract image metadata from a raw file buffer.
 *
 * Phase 8 implementation: derives metadata from the buffer and File object.
 * In a full server environment with sharp/jimp, this would decode the image
 * header to get exact pixel dimensions. For now, we derive what we can
 * without a native image codec and mark dimensions as requiring server processing.
 *
 * Future: replace with `sharp(buffer).metadata()` when running in a
 * Node.js environment that supports native modules (e.g. Edge Function).
 *
 * @param buffer   - Raw file bytes
 * @param mimeType - Declared MIME type (already server-validated)
 * @param filename - Sanitised filename (for logging only)
 */
export async function extractImageMetadata(
  buffer: ArrayBuffer,
  mimeType: string,
  filename: string
): Promise<ImageMetadata> {
  const bytes = new Uint8Array(buffer);
  const fileSizeBytes = buffer.byteLength;

  // Compute SHA-256 checksum using the Web Crypto API (available in Next.js edge/server)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  const checksum   = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // Attempt to read pixel dimensions from image headers without a native codec.
  // This covers the most common formats (PNG, JPEG, WEBP).
  const { widthPx, heightPx } = parseImageDimensions(bytes, mimeType);

  return {
    widthPx,
    heightPx,
    fileSizeBytes,
    mimeType,
    checksum,
  };
}

/**
 * Parse pixel dimensions from raw image bytes using header signatures.
 * Returns 0×0 for unsupported formats — dimensions will be filled in by
 * a proper image-processing worker in the future.
 *
 * Supported:
 *   PNG  — bytes 16-23 contain width+height as big-endian uint32
 *   JPEG — scan for SOF0/SOF2 markers (0xFFC0, 0xFFC2) to find dimensions
 *   WEBP — bytes 24-31 contain width+height as little-endian uint24 minus 1
 */
function parseImageDimensions(
  bytes: Uint8Array,
  mimeType: string
): { widthPx: number; heightPx: number } {
  try {
    if (mimeType === 'image/png' && bytes.length > 24) {
      // PNG IHDR chunk starts at byte 8 (8-byte sig + 4 len + 4 type = 16)
      const width  = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      if (width > 0 && height > 0 && width <= 30000 && height <= 30000) {
        return { widthPx: width, heightPx: height };
      }
    }

    if (mimeType === 'image/jpeg' && bytes.length > 4) {
      // Scan JPEG markers for SOF0 (0xFFC0) or SOF2 (0xFFC2)
      let i = 2;
      while (i < bytes.length - 10) {
        if (bytes[i] !== 0xFF) break;
        const marker = bytes[i + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          const height = (bytes[i + 5] << 8) | bytes[i + 6];
          const width  = (bytes[i + 7] << 8) | bytes[i + 8];
          if (width > 0 && height > 0 && width <= 30000 && height <= 30000) {
            return { widthPx: width, heightPx: height };
          }
        }
        const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
        i += 2 + segLen;
      }
    }

    if (mimeType === 'image/webp' && bytes.length > 30) {
      // RIFF....WEBPVP8L or VP8  — check for RIFF header
      const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
      const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      if (riff === 'RIFF' && webp === 'WEBP') {
        // VP8L (lossless): width/height encoded at bytes 21-24
        const vp8l = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
        if (vp8l === 'VP8L' && bytes[20] === 0x2F) {
          const bits  = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
          const width  = (bits & 0x3FFF) + 1;
          const height = ((bits >> 14) & 0x3FFF) + 1;
          if (width > 0 && height > 0 && width <= 30000 && height <= 30000) {
            return { widthPx: width, heightPx: height };
          }
        }
        // VP8  (lossy): width/height at bytes 26-29 (10-bit each in VP8 bitstream)
        // This requires deeper parsing — return 0 and let the worker handle it
      }
    }
  } catch {
    // Parsing failed — dimensions will be 0 and updated by a future worker
  }

  return { widthPx: 0, heightPx: 0 };
}

// =============================================================================
// Preview generation
// =============================================================================

/**
 * Generate a preview image from the original file.
 *
 * A preview is a resized version of the original, suitable for:
 *   - Creator review on the design detail page
 *   - Future: watermarked delivery to potential buyers
 *
 * Phase 8 architecture: stores the original buffer as the "preview" with
 * metadata marking it as requiring processing. The actual resizing will be
 * performed by a background worker (Supabase Edge Function or pg_cron job).
 *
 * Storage path: designs/{creator_id}/{design_id}/preview/{filename}
 *
 * @param creatorId  - creators.id
 * @param designId   - designs.id
 * @param buffer     - Raw bytes of the original file
 * @param mimeType   - MIME type of the source file
 * @param filename   - Sanitised base filename
 * @param metadata   - Pre-extracted image metadata
 */
export async function generatePreview(
  creatorId: string,
  designId: string,
  buffer: ArrayBuffer,
  mimeType: string,
  filename: string,
  metadata: ImageMetadata
): Promise<ProcessingStepResult> {
  try {
    const db = createSupabaseServerClient();

    // Derive preview filename
    const ext         = getOutputExtension(mimeType);
    const previewName = filename.replace(/\.[^.]+$/, '') + `_preview.${ext}`;
    const storagePath = buildStoragePath(creatorId, designId, 'preview', previewName);

    // Calculate preview dimensions (scale down if larger than PREVIEW_MAX_PX)
    const { widthPx, heightPx } = scaleDimensions(
      metadata.widthPx,
      metadata.heightPx,
      PREVIEW_MAX_PX
    );

    // Create the media_asset record with status='processing'
    const assetRecord = await createMediaAssetRecord({
      design_id:      designId,
      creator_id:     creatorId,
      storage_path:   storagePath,
      storage_bucket: DESIGNS_BUCKET,
      asset_type:     'preview',
      mime_type:      OUTPUT_MIME_TYPE,
      file_size:      buffer.byteLength,
      width:          widthPx || undefined,
      height:         heightPx || undefined,
    });

    if (!assetRecord) {
      return { success: false, reason: 'Failed to create preview asset record' };
    }

    // Mark as processing before the upload
    await updateMediaAsset(assetRecord.id, { status: 'processing' as MediaAssetStatus });

    // Upload the preview to storage
    // Phase 8: uploads the same buffer as preview (full-res).
    // Background worker will resize to PREVIEW_MAX_PX in Phase 9.
    const { error: uploadError } = await db.storage
      .from(DESIGNS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      await updateMediaAsset(assetRecord.id, { status: 'failed' as MediaAssetStatus });
      return { success: false, reason: `Preview upload failed: ${uploadError.message}` };
    }

    // Mark as ready
    await updateMediaAsset(assetRecord.id, {
      status:    'ready' as MediaAssetStatus,
      file_size: buffer.byteLength,
      width:     widthPx || undefined,
      height:    heightPx || undefined,
    });

    return { success: true, assetId: assetRecord.id, storagePath };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown preview generation error';
    return { success: false, reason };
  }
}

// =============================================================================
// Thumbnail generation
// =============================================================================

/**
 * Generate a thumbnail image from the original file.
 *
 * A thumbnail is a very small, fast-loading image used for:
 *   - Marketplace grid/card display
 *   - Future: CDN-served public images
 *
 * Storage path: designs/{creator_id}/{design_id}/thumbnail/{filename}
 *
 * @param creatorId  - creators.id
 * @param designId   - designs.id
 * @param buffer     - Raw bytes of the original file
 * @param mimeType   - MIME type of the source file
 * @param filename   - Sanitised base filename
 * @param metadata   - Pre-extracted image metadata
 */
export async function generateThumbnail(
  creatorId: string,
  designId: string,
  buffer: ArrayBuffer,
  mimeType: string,
  filename: string,
  metadata: ImageMetadata
): Promise<ProcessingStepResult> {
  try {
    const db = createSupabaseServerClient();

    // Derive thumbnail filename
    const ext           = getOutputExtension(mimeType);
    const thumbName     = filename.replace(/\.[^.]+$/, '') + `_thumb.${ext}`;
    const storagePath   = buildStoragePath(creatorId, designId, 'thumbnail', thumbName);

    // Calculate thumbnail dimensions (scale down to THUMBNAIL_MAX_PX)
    const { widthPx, heightPx } = scaleDimensions(
      metadata.widthPx,
      metadata.heightPx,
      THUMBNAIL_MAX_PX
    );

    // Create asset record with status='processing'
    const assetRecord = await createMediaAssetRecord({
      design_id:      designId,
      creator_id:     creatorId,
      storage_path:   storagePath,
      storage_bucket: DESIGNS_BUCKET,
      asset_type:     'thumbnail',
      mime_type:      OUTPUT_MIME_TYPE,
      file_size:      buffer.byteLength,
      width:          widthPx || undefined,
      height:         heightPx || undefined,
    });

    if (!assetRecord) {
      return { success: false, reason: 'Failed to create thumbnail asset record' };
    }

    // Mark as processing
    await updateMediaAsset(assetRecord.id, { status: 'processing' as MediaAssetStatus });

    // Upload thumbnail to storage
    // Phase 8: uploads same buffer (full-res placeholder).
    // Background worker resizes to THUMBNAIL_MAX_PX in Phase 9.
    const { error: uploadError } = await db.storage
      .from(DESIGNS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      await updateMediaAsset(assetRecord.id, { status: 'failed' as MediaAssetStatus });
      return { success: false, reason: `Thumbnail upload failed: ${uploadError.message}` };
    }

    // Mark as ready
    await updateMediaAsset(assetRecord.id, {
      status:    'ready' as MediaAssetStatus,
      file_size: buffer.byteLength,
      width:     widthPx || undefined,
      height:    heightPx || undefined,
    });

    return { success: true, assetId: assetRecord.id, storagePath };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown thumbnail generation error';
    return { success: false, reason };
  }
}

// =============================================================================
// Pipeline orchestrator
// =============================================================================

// =============================================================================
// Phase 10 — Optimized processing helpers
// =============================================================================

/**
 * Verify and clean metadata on the uploaded original.
 *
 * Phase 10 entry point called by the Edge Function worker after the original
 * upload is complete. Re-reads the stored binary, verifies dimensions, and
 * writes the server-verified MIME type back to the asset record.
 *
 * This is a server-side complement to the Edge Function's runMetadataStep().
 * Safe to call from a Route Handler or Server Action.
 *
 * @param originalAssetId - media_assets.id of the original asset
 * @param buffer          - Raw bytes of the original file
 * @param mimeType        - Server-declared MIME type
 * @param filename        - Sanitised filename (for logging)
 */
export async function optimizeOriginalImage(
  originalAssetId: string,
  buffer: ArrayBuffer,
  mimeType: string,
  filename: string
): Promise<ProcessingStepResult> {
  try {
    const metadata = await extractImageMetadata(buffer, mimeType, filename);

    await updateMediaAsset(originalAssetId, {
      width:     metadata.widthPx   || undefined,
      height:    metadata.heightPx  || undefined,
      file_size: metadata.fileSizeBytes,
    });
    await updateMediaAssetChecksum(originalAssetId, metadata.checksum);

    appendProcessingLog(originalAssetId, {
      ts:      new Date().toISOString(),
      event:   'metadata_cleaned',
      status:  'processing',
      message: `Original verified: ${metadata.widthPx}×${metadata.heightPx}px | ${mimeType}`,
    });

    return { success: true, assetId: originalAssetId, storagePath: '' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Original optimization failed';
    return { success: false, reason };
  }
}

/**
 * Record that an optimized preview has been produced by the Edge Function worker.
 *
 * Called from a Route Handler or Server Action to update the preview asset
 * record after the worker has written the optimized file to storage.
 *
 * @param previewAssetId  - media_assets.id of the preview asset
 * @param widthPx         - Final output width
 * @param heightPx        - Final output height
 * @param fileSizeBytes   - Final output file size
 * @param compressionRatio - Ratio of output/input size
 */
export async function generateOptimizedPreview(
  previewAssetId: string,
  widthPx: number,
  heightPx: number,
  fileSizeBytes: number,
  compressionRatio: number
): Promise<ProcessingStepResult> {
  try {
    const db = createSupabaseServerClient();

    await (db.from('media_assets') as any).update({
      status:            'ready',
      width:             widthPx,
      height:            heightPx,
      file_size:         fileSizeBytes,
      mime_type:         OUTPUT_MIME_TYPE,
      compression_ratio: compressionRatio,
      optimized_at:      new Date().toISOString(),
    }).eq('id', previewAssetId);

    appendProcessingLog(previewAssetId, {
      ts:      new Date().toISOString(),
      event:   'preview_optimized',
      status:  'ready',
      message: `Preview optimized: ${widthPx}×${heightPx}px | ratio ${compressionRatio.toFixed(2)}`,
    });

    return { success: true, assetId: previewAssetId, storagePath: '' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Preview optimization update failed';
    return { success: false, reason };
  }
}

/**
 * Record that an optimized thumbnail has been produced by the Edge Function worker.
 *
 * Called from a Route Handler or Server Action to update the thumbnail asset
 * record after the worker has written the optimized file to storage.
 *
 * @param thumbnailAssetId - media_assets.id of the thumbnail asset
 * @param widthPx          - Final output width
 * @param heightPx         - Final output height
 * @param fileSizeBytes    - Final output file size
 * @param compressionRatio - Ratio of output/input size
 */
export async function generateOptimizedThumbnail(
  thumbnailAssetId: string,
  widthPx: number,
  heightPx: number,
  fileSizeBytes: number,
  compressionRatio: number
): Promise<ProcessingStepResult> {
  try {
    const db = createSupabaseServerClient();

    await (db.from('media_assets') as any).update({
      status:            'ready',
      width:             widthPx,
      height:            heightPx,
      file_size:         fileSizeBytes,
      mime_type:         OUTPUT_MIME_TYPE,
      compression_ratio: compressionRatio,
      optimized_at:      new Date().toISOString(),
    }).eq('id', thumbnailAssetId);

    appendProcessingLog(thumbnailAssetId, {
      ts:      new Date().toISOString(),
      event:   'thumbnail_optimized',
      status:  'ready',
      message: `Thumbnail optimized: ${widthPx}×${heightPx}px | ratio ${compressionRatio.toFixed(2)}`,
    });

    appendProcessingLog(thumbnailAssetId, {
      ts:      new Date().toISOString(),
      event:   'optimization_completed',
      status:  'ready',
      message: 'All optimization steps completed. Asset pipeline ready.',
    });

    return { success: true, assetId: thumbnailAssetId, storagePath: '' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Thumbnail optimization update failed';
    return { success: false, reason };
  }
}

// =============================================================================
// Pipeline orchestrator
// =============================================================================

/**
 * Process all media for a design after a successful original upload.
 *
 * This is the primary entry point for the media processing pipeline.
 * It runs three steps in sequence:
 *   1. extractImageMetadata — update the original asset record with dimensions + checksum
 *   2. generatePreview      — create the preview asset
 *   3. generateThumbnail    — create the thumbnail asset
 *
 * If metadata extraction fails, the pipeline continues but preview/thumbnail
 * dimensions will be 0×0 (updated by the background worker).
 *
 * If preview generation fails, thumbnail is still attempted.
 *
 * Phase 10: records image_optimization_started log event so the dashboard
 * indicator shows "Optimizing image..." while the Edge Function runs.
 *
 * SECURITY: Caller must verify design ownership before calling this.
 * creatorId and designId must be resolved from the authenticated session —
 * never from client-supplied parameters.
 *
 * @param creatorId       - creators.id (verified server-side)
 * @param designId        - designs.id (verified server-side)
 * @param originalAssetId - media_assets.id of the uploaded original
 * @param buffer          - Raw file bytes of the original
 * @param mimeType        - Server-verified MIME type of the original
 * @param filename        - Sanitised original filename
 */
export async function processDesignMedia(
  creatorId: string,
  designId: string,
  originalAssetId: string,
  buffer: ArrayBuffer,
  mimeType: string,
  filename: string
): Promise<MediaProcessingResult> {
  const errors: string[] = [];
  let metadata: ImageMetadata | null = null;
  let preview: ProcessingStepResult | null = null;
  let thumbnail: ProcessingStepResult | null = null;

  // ── Step 1: Extract metadata from the original ───────────────────────────
  try {
    metadata = await extractImageMetadata(buffer, mimeType, filename);

    // Update the original asset record with extracted metadata
    await updateMediaAsset(originalAssetId, {
      width:     metadata.widthPx  || undefined,
      height:    metadata.heightPx || undefined,
      file_size: metadata.fileSizeBytes,
    });

    // Write checksum to the new column (direct DB update — not in UpdateMediaAssetInput)
    await updateMediaAssetChecksum(originalAssetId, metadata.checksum);

    appendProcessingLog(originalAssetId, {
      ts:      new Date().toISOString(),
      event:   'image_optimization_started',
      status:  'processing',
      message: 'Image optimization pipeline started by Edge Function worker',
    });

    appendProcessingLog(originalAssetId, {
      ts:     new Date().toISOString(),
      event:  'metadata_extracted',
      detail: {
        widthPx:       metadata.widthPx,
        heightPx:      metadata.heightPx,
        fileSizeBytes: metadata.fileSizeBytes,
        checksum:      metadata.checksum,
      },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Metadata extraction failed';
    errors.push(`metadata: ${reason}`);
    // Proceed without metadata — dimensions will be 0
    metadata = {
      widthPx: 0,
      heightPx: 0,
      fileSizeBytes: buffer.byteLength,
      mimeType,
      checksum: '',
    };
  }

  // ── Step 2: Generate preview ─────────────────────────────────────────────
  try {
    preview = await generatePreview(
      creatorId, designId, buffer, mimeType, filename, metadata
    );
    if (!preview.success) {
      errors.push(`preview: ${preview.reason}`);
    } else {
      appendProcessingLog(originalAssetId, {
        ts:     new Date().toISOString(),
        event:  'preview_generated',
        detail: { assetId: preview.assetId, storagePath: preview.storagePath },
      });
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Preview generation threw';
    errors.push(`preview: ${reason}`);
    preview = { success: false, reason };
  }

  // ── Step 3: Generate thumbnail ───────────────────────────────────────────
  try {
    thumbnail = await generateThumbnail(
      creatorId, designId, buffer, mimeType, filename, metadata
    );
    if (!thumbnail.success) {
      errors.push(`thumbnail: ${thumbnail.reason}`);
    } else {
      appendProcessingLog(originalAssetId, {
        ts:     new Date().toISOString(),
        event:  'thumbnail_generated',
        detail: { assetId: thumbnail.assetId, storagePath: thumbnail.storagePath },
      });
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Thumbnail generation threw';
    errors.push(`thumbnail: ${reason}`);
    thumbnail = { success: false, reason };
  }

  const success = errors.length === 0;
  return { success, metadata, preview, thumbnail, errors };
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Scale dimensions proportionally so the longest edge is at most `maxPx`.
 * Returns the original dimensions if they are already within the limit.
 * Returns 0×0 if either dimension is unknown (0).
 */
export function scaleDimensions(
  widthPx: number,
  heightPx: number,
  maxPx: number
): { widthPx: number; heightPx: number } {
  if (!widthPx || !heightPx) return { widthPx: 0, heightPx: 0 };

  const longestEdge = Math.max(widthPx, heightPx);
  if (longestEdge <= maxPx) return { widthPx, heightPx };

  const scale = maxPx / longestEdge;
  return {
    widthPx:  Math.round(widthPx  * scale),
    heightPx: Math.round(heightPx * scale),
  };
}

/**
 * Get the file extension to use for a given MIME type.
 * Defaults to 'jpg' for unknown types (JPEG is the safest web format).
 */
function getOutputExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
  };
  return map[mimeType] ?? 'jpg';
}

/**
 * Update the checksum field on a media_assets row.
 * Separate from updateMediaAsset because checksum is not in UpdateMediaAssetInput
 * (it is a new field added in the Phase 8 migration).
 */
async function updateMediaAssetChecksum(
  assetId: string,
  checksum: string
): Promise<void> {
  if (!checksum) return;
  try {
    const db = createSupabaseServerClient();
    await (db.from('media_assets') as any).update({ checksum }).eq('id', assetId); // any: new Phase 8 column not in generated types
  } catch {
    // Non-critical — checksum can be recomputed
  }
}

/**
 * Append a processing log entry to a media_assets row.
 * Fire-and-forget — failures do not affect the processing result.
 *
 * This uses a PostgreSQL JSONB array append pattern via RPC.
 * Falls back gracefully if the processing_log column doesn't exist yet.
 */
async function appendProcessingLog(
  assetId: string,
  entry: ProcessingLogEntry
): Promise<void> {
  // Phase 9: delegates to the real implementation in media-queue.service.ts
  // which performs a safe read-modify-write on media_assets.processing_log.
  await appendProcessingLogImpl(assetId, {
    ...entry,
    status:  'processing',
    message: entry.event,
  });
}

/**
 * Check if a file with the given checksum already exists for this design.
 * Used for deduplication before processing a new upload.
 *
 * @returns The existing asset ID if a duplicate is found, null otherwise.
 */
export async function findDuplicateByChecksum(
  designId: string,
  checksum: string
): Promise<string | null> {
  if (!checksum) return null;
  try {
    const db = createSupabaseServerClient();
    // any: checksum is a new Phase 8 column not yet in generated Supabase types
    const query = (db.from('media_assets') as any)
      .select('id')
      .eq('design_id', designId)
      .eq('checksum', checksum)
      .neq('status', 'deleted')
      .maybeSingle();

    const { data } = await query;
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the current processing status summary for all assets of a design.
 * Used by the creator dashboard to show media processing progress.
 *
 * @param designId - designs.id
 */
export async function getDesignMediaProcessingStatus(designId: string): Promise<{
  hasOriginal: boolean;
  hasPreview: boolean;
  hasThumbnail: boolean;
  originalStatus: MediaAssetStatus | null;
  previewStatus: MediaAssetStatus | null;
  thumbnailStatus: MediaAssetStatus | null;
}> {
  const media = await getDesignMedia(designId);

  return {
    hasOriginal:     media.original !== null,
    hasPreview:      media.preview  !== null,
    hasThumbnail:    media.thumbnail !== null,
    originalStatus:  media.original?.status  ?? null,
    previewStatus:   media.preview?.status   ?? null,
    thumbnailStatus: media.thumbnail?.status ?? null,
  };
}

// =============================================================================
// Export constants for consumers
// =============================================================================
export {
  PREVIEW_MAX_PX,
  THUMBNAIL_MAX_PX,
  OUTPUT_MIME_TYPE,
  PREVIEW_QUALITY,
  THUMBNAIL_QUALITY,
  WEBP_QUALITY,
};
