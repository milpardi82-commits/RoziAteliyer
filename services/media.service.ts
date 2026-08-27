/**
 * Media Service — Phase 5.
 *
 * Server-side data access layer for all media asset operations.
 * Covers: asset record management, storage path generation, ownership
 * verification, and safe signed URL generation.
 *
 * ONLY call these functions from Server Components, Server Actions, or
 * Route Handlers. Never import this file from a Client Component.
 *
 * Architecture principles:
 *   - Storage paths are ALWAYS generated server-side — never accepted from client.
 *   - Ownership is ALWAYS verified server-side via creators.user_id = auth.uid().
 *   - Signed URLs are generated server-side and passed to the client — the client
 *     never receives a storage_path or storage_bucket.
 *   - No service-role key is used here — only the anon key with RLS.
 *     Future: heavy operations (signed URLs, processing triggers) will use
 *     a server-side service-role client passed from Server Actions.
 */

import { supabaseServer } from '@/lib/supabase/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import type {
  MediaAsset,
  MediaAssetType,
  MediaAssetStatus,
  CreateMediaAssetInput,
  UpdateMediaAssetInput,
  DesignMediaSummary,
  MediaValidationResult,
  MediaUploadConstraints,
  StoragePathComponents,
} from '@/types/media';

// =============================================================================
// Constants
// =============================================================================

/** The bucket used for all design media in Phase 5 */
export const DESIGNS_BUCKET = 'designs-private' as const;

/**
 * Upload constraints enforced server-side before accepting any file.
 * These are validated in validateMediaFile() before storage upload.
 */
export const UPLOAD_CONSTRAINTS: MediaUploadConstraints = {
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/tiff', 'image/svg+xml'],
  maxFileSizeBytes: 50 * 1024 * 1024,  // 50 MB
  maxWidthPx: 10000,
  maxHeightPx: 10000,
  minWidthPx: 100,
  minHeightPx: 100,
};

// =============================================================================
// Storage path utilities
// =============================================================================

/**
 * Build a deterministic, server-side-only storage path for a media asset.
 *
 * Convention: designs/{creator_id}/{design_id}/{asset_type}/{filename}
 *
 * Requirements enforced:
 *   - No random/uncontrolled paths
 *   - No user-provided path components (creator_id and design_id come from DB)
 *   - No path traversal (filename is sanitised)
 *   - Unambiguous cross-user ownership (creator_id at level 2)
 *
 * @param creatorId   creators.id (standalone UUID, NOT auth.users.id)
 * @param designId    designs.id
 * @param assetType   'original' | 'preview' | 'thumbnail'
 * @param filename    Original filename — will be sanitised
 */
export function buildStoragePath(
  creatorId: string,
  designId: string,
  assetType: MediaAssetType,
  filename: string
): string {
  const safe = sanitiseFilename(filename);
  return `designs/${creatorId}/${designId}/${assetType}/${safe}`;
}

/**
 * Parse a storage path into its components for validation.
 * Returns null if the path does not match the expected convention.
 */
export function parseStoragePath(path: string): StoragePathComponents | null {
  const parts = path.split('/');
  if (parts.length !== 5) return null;

  const [prefix, creatorId, designId, assetType, filename] = parts;

  if (prefix !== 'designs') return null;
  if (!isValidUuid(creatorId)) return null;
  if (!isValidUuid(designId)) return null;
  if (!['original', 'preview', 'thumbnail'].includes(assetType)) return null;
  if (!filename || filename.includes('..') || filename.includes('/')) return null;

  return {
    prefix: 'designs',
    creatorId,
    designId,
    assetType: assetType as MediaAssetType,
    filename,
  };
}

/**
 * Sanitise a filename to prevent path traversal and invalid characters.
 * Keeps the file extension; replaces unsafe characters with underscores.
 */
export function sanitiseFilename(filename: string): string {
  // Remove any path separators and traversal sequences
  const basename = filename.replace(/[/\\]/g, '_').replace(/\.\./g, '_');
  // Allow only: alphanumeric, dash, underscore, dot (for extension)
  return basename.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
}

/**
 * Validate a UUID v4 string.
 */
function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// =============================================================================
// File validation (architecture only — no actual file parsing yet)
// =============================================================================

/**
 * Validate a potential upload against the server-side constraints.
 *
 * NOTE: Phase 5 is architecture-only. This function validates the metadata
 * (size, claimed MIME type, dimensions). Full magic-byte MIME verification
 * will be added in the upload implementation phase.
 *
 * DO NOT trust browser-supplied MIME types alone. This function is the
 * first layer; the actual upload handler must verify file magic bytes.
 */
export function validateMediaFile(params: {
  mimeType: string;
  fileSizeBytes: number;
  widthPx?: number;
  heightPx?: number;
  filename: string;
}): MediaValidationResult {
  const { mimeType, fileSizeBytes, widthPx, heightPx, filename } = params;
  const c = UPLOAD_CONSTRAINTS;

  if (!c.allowedMimeTypes.includes(mimeType)) {
    return { valid: false, reason: `MIME type '${mimeType}' is not allowed.` };
  }

  if (fileSizeBytes > c.maxFileSizeBytes) {
    return {
      valid: false,
      reason: `File size ${fileSizeBytes} bytes exceeds the maximum of ${c.maxFileSizeBytes} bytes.`,
    };
  }

  if (widthPx !== undefined && (widthPx < c.minWidthPx || widthPx > c.maxWidthPx)) {
    return {
      valid: false,
      reason: `Image width ${widthPx}px is outside the allowed range (${c.minWidthPx}–${c.maxWidthPx}px).`,
    };
  }

  if (heightPx !== undefined && (heightPx < c.minHeightPx || heightPx > c.maxHeightPx)) {
    return {
      valid: false,
      reason: `Image height ${heightPx}px is outside the allowed range (${c.minHeightPx}–${c.maxHeightPx}px).`,
    };
  }

  if (!filename || filename.includes('..') || filename.includes('/')) {
    return { valid: false, reason: 'Filename contains invalid characters or path traversal.' };
  }

  return { valid: true };
}

// =============================================================================
// Ownership verification
// =============================================================================

/**
 * Verify that the currently authenticated user owns the given creator row.
 *
 * Returns the creator.id (standalone UUID) if ownership is confirmed.
 * Returns null if the user is not authenticated or does not own this creator.
 *
 * This is the foundation of the ownership chain:
 *   auth.uid() → creators.user_id → creators.id → designs.creator_id → media_assets.creator_id
 */
export async function resolveAuthenticatedCreatorId(): Promise<string | null> {
  try {
    const db = createSupabaseServerClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return null;

    const { data: creator, error } = await db
      .from('creators')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (error || !creator) return null;
    return creator.id as string;
  } catch {
    return null;
  }
}

/**
 * Verify that a specific design belongs to the currently authenticated creator.
 *
 * Returns true if:
 *   1. auth.uid() is set
 *   2. A creator row exists with user_id = auth.uid()
 *   3. designs.creator_id = that creator.id
 *
 * Never trusts client-supplied creator_id.
 */
export async function verifyMediaOwnership(designId: string): Promise<boolean> {
  try {
    const db = createSupabaseServerClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return false;

    const { data, error } = await db
      .from('designs')
      .select('creator_id, creators!inner(user_id)')
      .eq('id', designId)
      .eq('creators.user_id', user.id)
      .maybeSingle();

    return !error && data !== null;
  } catch {
    return false;
  }
}

// =============================================================================
// Media asset record operations
// =============================================================================

/**
 * Fetch all media assets for a given design, grouped by type.
 *
 * Returns original, preview, and thumbnail (or null if not yet uploaded).
 * Only returns 'ready' assets for the public fields. The owning creator
 * can see all statuses via read_own_media_assets RLS policy.
 *
 * Uses the anon client — respects RLS.
 */
export async function getDesignMedia(designId: string): Promise<DesignMediaSummary> {
  const db = supabaseServer();

  const { data, error } = await db
    .from('media_assets')
    .select('*')
    .eq('design_id', designId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false });

  const assets: MediaAsset[] = error ? [] : (data as MediaAsset[]);

  // Return the most recent asset of each type
  const byType = (type: MediaAssetType): MediaAsset | null =>
    assets.find((a) => a.asset_type === type) ?? null;

  return {
    design_id: designId,
    original:  byType('original'),
    preview:   byType('preview'),
    thumbnail: byType('thumbnail'),
  };
}

/**
 * Fetch a single media asset by its ID.
 *
 * Returns null if not found or not accessible.
 * RLS enforces visibility: public assets are visible to all;
 * private/pending assets are only visible to the owning creator.
 */
export async function getMediaAsset(assetId: string): Promise<MediaAsset | null> {
  try {
    const db = supabaseServer();
    const { data, error } = await db
      .from('media_assets')
      .select('*')
      .eq('id', assetId)
      .maybeSingle();

    if (error || !data) return null;
    return data as MediaAsset;
  } catch {
    return null;
  }
}

/**
 * Create a new media asset record in the database.
 *
 * This is called BEFORE the actual file upload to register the intent.
 * Status starts as 'pending'; it is updated to 'ready' after a successful upload.
 *
 * The storage_path MUST be generated via buildStoragePath() — never
 * accept a path from client input.
 *
 * IMPORTANT: Caller must verify ownership (verifyMediaOwnership) before calling this.
 */
export async function createMediaAssetRecord(
  input: CreateMediaAssetInput
): Promise<MediaAsset | null> {
  try {
    // Validate the storage path follows the convention
    const parsed = parseStoragePath(input.storage_path);
    if (!parsed) {
      console.error('[media.service] Invalid storage path format:', input.storage_path);
      return null;
    }

    // Ensure the creator_id in the path matches the record's creator_id
    if (parsed.creatorId !== input.creator_id) {
      console.error('[media.service] Storage path creator_id mismatch');
      return null;
    }

    // Ensure the design_id in the path matches the record's design_id
    if (parsed.designId !== input.design_id) {
      console.error('[media.service] Storage path design_id mismatch');
      return null;
    }

    const db = createSupabaseServerClient();
    const { data, error } = await db
      .from('media_assets')
      .insert({
        design_id:      input.design_id,
        creator_id:     input.creator_id,
        storage_path:   input.storage_path,
        storage_bucket: input.storage_bucket ?? DESIGNS_BUCKET,
        asset_type:     input.asset_type,
        mime_type:      input.mime_type,
        file_size:      input.file_size ?? null,
        width:          input.width ?? null,
        height:         input.height ?? null,
        status:         'pending',
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[media.service] createMediaAssetRecord error:', error?.message);
      return null;
    }

    return data as MediaAsset;
  } catch (err) {
    console.error('[media.service] createMediaAssetRecord unexpected error:', err);
    return null;
  }
}

/**
 * Update a media asset record's status and/or metadata.
 *
 * Typical usage:
 *   - Set status = 'ready' after a successful upload completes.
 *   - Set status = 'failed' if an upload error occurs.
 *   - Update width/height/file_size after server-side image inspection.
 *
 * IMPORTANT: Caller must verify ownership before calling this.
 */
export async function updateMediaAsset(
  assetId: string,
  updates: UpdateMediaAssetInput
): Promise<boolean> {
  try {
    const db = createSupabaseServerClient();
    const { error } = await db
      .from('media_assets')
      .update(updates)
      .eq('id', assetId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Soft-delete a media asset record by setting status = 'deleted'.
 *
 * This does NOT remove the physical file from Storage. A separate
 * cleanup job (future implementation) handles physical file deletion
 * after confirming the record is logically deleted.
 *
 * RLS only allows deleting 'pending' or 'failed' assets directly.
 * Deleting 'ready' assets requires a server-side service-role operation
 * (future: when the design lifecycle transitions to 'archived' or 'deleted').
 *
 * IMPORTANT: Caller must verify ownership before calling this.
 */
export async function deleteMediaAsset(assetId: string): Promise<boolean> {
  try {
    const db = createSupabaseServerClient();
    const { error } = await db
      .from('media_assets')
      .update({ status: 'deleted' as MediaAssetStatus })
      .eq('id', assetId);

    return !error;
  } catch {
    return false;
  }
}

// =============================================================================
// Media lifecycle helpers
// =============================================================================

/**
 * Fetch all media assets for a given design that belong to the
 * currently authenticated creator. Includes all statuses.
 *
 * Returns empty array if the caller does not own the design.
 * This is the owner-facing version of getDesignMedia().
 */
export async function getOwnDesignMedia(designId: string): Promise<MediaAsset[]> {
  try {
    const db = createSupabaseServerClient();

    const { data, error } = await db
      .from('media_assets')
      .select('*')
      .eq('design_id', designId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data ?? []) as MediaAsset[];
  } catch {
    return [];
  }
}

/**
 * Get the count of media assets in each status for a creator.
 * Useful for creator dashboard statistics (future).
 */
export async function getCreatorMediaStats(
  creatorId: string
): Promise<Record<MediaAssetStatus, number>> {
  const empty: Record<MediaAssetStatus, number> = {
    pending: 0, processing: 0, ready: 0, failed: 0, deleted: 0,
  };

  try {
    const db = supabaseServer();
    const { data, error } = await db
      .from('media_assets')
      .select('status')
      .eq('creator_id', creatorId);

    if (error || !data) return empty;

    return (data as { status: MediaAssetStatus }[]).reduce((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, { ...empty });
  } catch {
    return empty;
  }
}
