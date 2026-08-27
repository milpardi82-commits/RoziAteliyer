/**
 * Media domain types — Phase 5.
 *
 * These types mirror the `media_assets` table schema and define the full
 * media/storage model for the Morrow Marketplace.
 *
 * Design principle:
 *   - A MediaAsset is the authoritative record for a physical file in Storage.
 *   - A Design can have multiple MediaAssets (original, preview, thumbnail).
 *   - Ownership flows: auth.users → creators → designs → media_assets → Storage path.
 *   - Storage paths are deterministic and server-generated — never client-supplied.
 */

// =============================================================================
// Enumeration types
// =============================================================================

/**
 * The logical role of a media asset within a design.
 *
 * original   — The full-resolution file as uploaded by the creator.
 *              Always private. Never delivered directly to buyers.
 *
 * preview    — A processed, watermarked or resized version for the design
 *              detail page. Publicly accessible once the design is published.
 *
 * thumbnail  — A small, fast-loading image for grid/card display.
 *              Publicly accessible once the design is published.
 */
export type MediaAssetType = 'original' | 'preview' | 'thumbnail';

/**
 * Lifecycle status of a media asset.
 *
 * pending    — Record created; file upload has not started or is in progress.
 * processing — File uploaded; server-side processing (resize, watermark) running.
 * ready      — File is fully processed and available for serving.
 * failed     — Upload or processing failed; creator should retry or delete.
 * deleted    — Logically deleted; physical file may still exist pending cleanup.
 */
export type MediaAssetStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'deleted';

/**
 * Which image variant to use in a given context.
 *
 * card      — Marketplace grid cards → thumbnail
 * detail    — Design detail page hero → preview
 * download  — Creator downloads their own work → original (private)
 */
export type MediaVariant = 'card' | 'detail' | 'download';

// =============================================================================
// Core entity type
// =============================================================================

/**
 * Full media_assets row as stored in the database.
 *
 * NOTE: `creator_id` is `creators.id` (standalone UUID), NOT `auth.users.id`.
 * Ownership verification always goes through `creators.user_id = auth.uid()`.
 *
 * `storage_path` follows the convention:
 *   designs/{creator_id}/{design_id}/{asset_type}/{filename}
 *
 * `storage_bucket` is always 'designs-private' for private assets.
 * Phase 11 introduced `designs-public` for CDN-delivered thumbnails/previews.
 */
export type MediaAsset = {
  /** Standalone UUID PK */
  id: string;
  /** FK → designs.id — cascade deletes this asset when the design is deleted */
  design_id: string;
  /** FK → creators.id — cascade deletes when creator is deleted */
  creator_id: string;
  /** Deterministic storage path: designs/{creator_id}/{design_id}/{asset_type}/{filename} */
  storage_path: string;
  /** Storage bucket name — 'designs-private' for originals/unprocessed assets */
  storage_bucket: string;
  /** Logical role of this file in the design's media set */
  asset_type: MediaAssetType;
  /** Server-verified MIME type */
  mime_type: string;
  /** File size in bytes (nullable until upload completes) */
  file_size: number | null;
  /** Image width in pixels (nullable until inspected server-side) */
  width: number | null;
  /** Image height in pixels (nullable until inspected server-side) */
  height: number | null;
  /** Processing lifecycle status */
  status: MediaAssetStatus;
  /**
   * SHA-256 hex digest of the file content — populated after upload.
   * Added in Phase 8 migration (20260828000000). Nullable for legacy rows.
   */
  checksum?: string | null;
  /**
   * JSONB array of processing log entries — written by the processing pipeline.
   * Added in Phase 8 migration. Nullable until processing begins.
   */
  processing_log?: Array<{
    ts: string;
    event: string;
    detail?: Record<string, unknown>;
  }> | null;
  /**
   * Phase 10: ratio of optimized output file size to original input size.
   * e.g. 0.42 means output is 42% the size of the original (58% reduction).
   * NULL for pre-Phase-10 assets.
   */
  compression_ratio?: number | null;
  /**
   * Phase 10: timestamp when WASM image optimization completed for this asset.
   * NULL for pre-Phase-10 assets.
   */
  optimized_at?: string | null;
  /**
   * Phase 11: permanent CDN URL for this asset in the designs-public bucket.
   * Format: {SUPABASE_URL}/storage/v1/object/public/designs-public/{cdn_path}
   * NULL for original assets, unpublished designs, or pre-Phase-11 rows.
   */
  public_url?: string | null;
  /**
   * Phase 11: path within the designs-public bucket.
   * Format: {asset_type}/{creator_id}/{design_id}/{filename}
   * NULL for original assets and pre-Phase-11 rows.
   */
  cdn_path?: string | null;
  /**
   * Phase 11: timestamp when this asset was first published to the CDN.
   * NULL for assets not yet published.
   */
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Public-safe media asset — only fields safe to expose to unauthenticated users.
 * Never includes storage_path, storage_bucket, or original assets.
 */
export type PublicMediaAsset = Omit<
  MediaAsset,
  'storage_path' | 'storage_bucket' | 'creator_id'
>;

// =============================================================================
// Input / mutation types
// =============================================================================

/**
 * Input for creating a new media asset record.
 *
 * storage_path MUST be generated via buildStoragePath() on the server.
 * Never accept storage_path from client input.
 */
export type CreateMediaAssetInput = {
  design_id: string;
  creator_id: string;
  /** Server-generated only. Must pass parseStoragePath() validation. */
  storage_path: string;
  storage_bucket?: string;
  asset_type: MediaAssetType;
  mime_type: string;
  file_size?: number;
  width?: number;
  height?: number;
};

/**
 * Fields that may be updated on an existing media asset.
 *
 * Immutable fields (design_id, creator_id, storage_path, asset_type) are
 * excluded — those cannot change after creation.
 */
export type UpdateMediaAssetInput = Partial<
  Pick<MediaAsset, 'status' | 'mime_type' | 'file_size' | 'width' | 'height'>
>;

// =============================================================================
// Upload validation types
// =============================================================================

/**
 * Server-side constraints for incoming file uploads.
 * Enforced in validateMediaFile() before any storage operation.
 */
export type MediaUploadConstraints = {
  allowedMimeTypes: string[];
  /** Maximum file size in bytes */
  maxFileSizeBytes: number;
  maxWidthPx: number;
  maxHeightPx: number;
  minWidthPx: number;
  minHeightPx: number;
};

/**
 * Result of server-side file validation.
 * valid = false means the upload must be rejected with the given reason.
 */
export type MediaValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

// =============================================================================
// Storage path types
// =============================================================================

/**
 * Parsed components of a deterministic storage path.
 *
 * Path format: designs/{creator_id}/{design_id}/{asset_type}/{filename}
 */
export type StoragePathComponents = {
  prefix: 'designs';
  creatorId: string;
  designId: string;
  assetType: MediaAssetType;
  filename: string;
};

// =============================================================================
// Composite / summary types
// =============================================================================

/**
 * All media assets for a single design, grouped by type.
 * Used by Server Components to pass media data to the UI without exposing
 * raw storage paths.
 */
export type DesignMediaSummary = {
  design_id: string;
  /** Full-resolution original — private, creator only */
  original: MediaAsset | null;
  /** Processed preview for detail page — public when published */
  preview: MediaAsset | null;
  /** Small thumbnail for grid cards — public when published */
  thumbnail: MediaAsset | null;
};

/**
 * Variant usage matrix — documents which variant maps to which UI context.
 * Used as reference only; not a runtime type.
 *
 * | Context              | Variant    | Asset type  | Access  |
 * |----------------------|------------|-------------|---------|
 * | Marketplace grid     | card       | thumbnail   | public  |
 * | Design detail page   | detail     | preview     | public  |
 * | Creator downloads    | download   | original    | private |
 * | Admin review panel   | detail     | preview     | private |
 */
export type MediaVariantMatrix = Record<
  MediaVariant,
  { assetType: MediaAssetType; access: 'public' | 'private' }
>;

export const MEDIA_VARIANT_MATRIX: MediaVariantMatrix = {
  card:     { assetType: 'thumbnail', access: 'public'  },
  detail:   { assetType: 'preview',   access: 'public'  },
  download: { assetType: 'original',  access: 'private' },
};

// =============================================================================
// Phase 11: CDN Delivery types
// =============================================================================

/**
 * Public CDN media result for a single design.
 *
 * Returned by getDesignPublicMedia() — safe to pass to Client Components.
 * Never includes storage_path, storage_bucket, creator_id, or original URLs.
 */
export type DesignPublicMedia = {
  design_id: string;
  /**
   * CDN URL for the thumbnail (designs-public bucket).
   * null if the design has no published thumbnail yet.
   * Use the fallback image_url from the designs table when null.
   */
  thumbnailCdnUrl: string | null;
  /**
   * CDN URL for the preview (designs-public bucket).
   * null if the design has no published preview yet.
   */
  previewCdnUrl: string | null;
  /**
   * Timestamp when the thumbnail was published to the CDN.
   * null if not yet published.
   */
  thumbnailPublishedAt: string | null;
  /**
   * Timestamp when the preview was published to the CDN.
   * null if not yet published.
   */
  previewPublishedAt: string | null;
};

/**
 * Result type for the media delivery service functions.
 * success=false means the asset is not available (not published, does not exist,
 * or the caller is not authorized).
 */
export type MediaDeliveryResult =
  | { success: true;  url: string; publishedAt: string | null }
  | { success: false; reason: string };
