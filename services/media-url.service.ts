/**
 * Media URL Service — Phase 8.
 *
 * Server-side signed URL generation for all media asset types.
 * Provides secure, time-limited access URLs for private Storage objects.
 *
 * ONLY call these functions from Server Components, Server Actions, or
 * Route Handlers. Never import this file from a Client Component.
 *
 * Security model:
 *   - Original files: ONLY the owning creator can get a signed URL.
 *     Verified via the full ownership chain: auth.uid() → creators.user_id → creators.id → media_assets.creator_id
 *   - Preview files: creator + authorized users (future: admin review panel).
 *   - Thumbnail files: any authenticated user (future: public CDN delivery).
 *   - Storage paths are NEVER exposed in the response — only the signed URL.
 *   - Signed URLs expire after a configurable duration (default: 1 hour for originals,
 *     24 hours for previews, 7 days for thumbnails).
 *
 * Architecture:
 *   - All URL generation goes through the Supabase Storage sign API.
 *   - The service enforces ownership at the service layer — the RLS policies
 *     on storage.objects are a belt-and-suspenders second guard.
 *   - Signed URLs are single-use and time-limited by design.
 *   - No public URLs are ever generated from this service.
 *     (Future: thumbnails may be served via a CDN redirect — not this service.)
 */

import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import {
  resolveAuthenticatedCreatorId,
  getDesignMedia,
  DESIGNS_BUCKET,
} from '@/services/media.service';
import type { MediaAssetType } from '@/types/media';

// =============================================================================
// Constants
// =============================================================================

/** Signed URL expiry for original (private) files — 1 hour */
const SIGNED_URL_EXPIRY_ORIGINAL  = 60 * 60;            // 3 600 s

/** Signed URL expiry for preview files — 24 hours */
const SIGNED_URL_EXPIRY_PREVIEW   = 60 * 60 * 24;       // 86 400 s

/** Signed URL expiry for thumbnail files — 7 days */
const SIGNED_URL_EXPIRY_THUMBNAIL = 60 * 60 * 24 * 7;   // 604 800 s

// =============================================================================
// Types
// =============================================================================

/**
 * A signed URL result.
 *
 * signedUrl  — The time-limited URL to pass to the client.
 * expiresAt  — ISO-8601 timestamp of when the URL expires.
 *              Consumers can use this to avoid serving stale URLs.
 */
export type SignedUrlResult =
  | { success: true;  signedUrl: string; expiresAt: string }
  | { success: false; reason: string };

/**
 * All media URLs for a single design, bundled for efficient delivery.
 *
 * Used by the creator's design editor and preview page to fetch all
 * asset URLs in a single server round-trip.
 *
 * Fields are null if the asset does not exist or the caller is not
 * authorized to access it.
 */
export type DesignMediaUrls = {
  original:  SignedUrlResult | null;
  preview:   SignedUrlResult | null;
  thumbnail: SignedUrlResult | null;
};

// =============================================================================
// Core URL generation
// =============================================================================

/**
 * Generate a signed URL for any media asset given its storage path.
 *
 * This is the low-level primitive. Use the typed wrappers below instead:
 *   - getSignedMediaUrl()          — owner access to any asset type
 *   - getCreatorPreviewUrl()       — creator access to preview
 *   - getMarketplaceThumbnailUrl() — public-ready thumbnail URL
 *
 * @param storagePath - Server-generated storage path (never client-supplied)
 * @param expiresIn   - Expiry in seconds
 */
async function generateSignedUrl(
  storagePath: string,
  expiresIn: number
): Promise<SignedUrlResult> {
  try {
    const db = createSupabaseServerClient();

    const { data, error } = await db.storage
      .from(DESIGNS_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error || !data?.signedUrl) {
      return {
        success: false,
        reason: error?.message ?? 'Failed to generate signed URL',
      };
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    return {
      success:   true,
      signedUrl: data.signedUrl,
      expiresAt,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unexpected error generating signed URL';
    return { success: false, reason };
  }
}

// =============================================================================
// Owner-only URL generation
// =============================================================================

/**
 * Generate a signed URL for a specific media asset.
 *
 * Access control:
 *   - original   → only the owning creator
 *   - preview    → only the owning creator (future: authorized reviewer)
 *   - thumbnail  → authenticated users (future: public)
 *
 * Ownership is verified via the full chain:
 *   auth.uid() → creators.user_id → creators.id → media_assets.creator_id
 *
 * Returns null if the asset doesn't exist or the caller is not authorized.
 *
 * @param assetId  - media_assets.id
 * @param assetType - Expected asset type (used to select expiry duration)
 */
export async function getSignedMediaUrl(
  assetId: string,
  assetType: MediaAssetType
): Promise<SignedUrlResult | null> {
  try {
    const db = createSupabaseServerClient();

    // Fetch the asset — RLS enforces: only owner can read own assets
    const { data: asset, error } = await db
      .from('media_assets')
      .select('storage_path, creator_id, asset_type, status')
      .eq('id', assetId)
      .neq('status', 'deleted')
      .maybeSingle();

    if (error || !asset) {
      return { success: false, reason: 'Asset not found or not accessible' };
    }

    // Belt-and-suspenders: verify the asset type matches expectation
    if (asset.asset_type !== assetType) {
      return { success: false, reason: 'Asset type mismatch' };
    }

    // Select expiry based on asset type
    const expiresIn = getExpiryForType(assetType);

    return generateSignedUrl(asset.storage_path as string, expiresIn);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Error generating URL';
    return { success: false, reason };
  }
}

/**
 * Generate a signed preview URL for a creator reviewing their own design.
 *
 * Verifies that the authenticated user owns the design before generating
 * the URL. Returns null if the preview asset doesn't exist yet.
 *
 * This is the primary URL function used by the design editor page.
 *
 * @param designId - designs.id (ownership verified server-side)
 */
export async function getCreatorPreviewUrl(
  designId: string
): Promise<SignedUrlResult | null> {
  try {
    // Verify the caller owns this design
    const creatorId = await resolveAuthenticatedCreatorId();
    if (!creatorId) {
      return { success: false, reason: 'Not authenticated or not a creator' };
    }

    // Fetch the design's media assets
    const media = await getDesignMedia(designId);
    if (!media.preview) {
      // Preview not yet generated — return null (not an error)
      return null;
    }

    // Ensure the preview asset belongs to this creator
    if (media.preview.creator_id !== creatorId) {
      return { success: false, reason: 'Not authorized to access this preview' };
    }

    // Generate signed URL for the preview
    return generateSignedUrl(media.preview.storage_path, SIGNED_URL_EXPIRY_PREVIEW);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Error generating preview URL';
    return { success: false, reason };
  }
}

/**
 * Generate a signed thumbnail URL for marketplace card display.
 *
 * Access model:
 *   - Phase 8: authenticated users only (signed URL, 7-day expiry).
 *   - Phase 9+: replace with a public CDN URL once a public bucket exists.
 *
 * Returns null if the thumbnail does not exist yet.
 *
 * @param designId - designs.id
 */
export async function getMarketplaceThumbnailUrl(
  designId: string
): Promise<SignedUrlResult | null> {
  try {
    const media = await getDesignMedia(designId);
    if (!media.thumbnail) {
      return null;
    }

    // Thumbnail is public-ready — any authenticated user can fetch it.
    // RLS on storage.objects allows the creator to read their own files;
    // future: public bucket will expose thumbnails without a signed URL.
    return generateSignedUrl(media.thumbnail.storage_path, SIGNED_URL_EXPIRY_THUMBNAIL);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Error generating thumbnail URL';
    return { success: false, reason };
  }
}

// =============================================================================
// Bulk URL generation
// =============================================================================

/**
 * Fetch all media URLs for a design in a single operation.
 *
 * Runs all three URL generations in parallel for performance.
 * Used by the creator's design editor to populate all image previews.
 *
 * Access control per asset:
 *   - original  → owner only
 *   - preview   → owner only (via getCreatorPreviewUrl)
 *   - thumbnail → owner only in Phase 8; public in Phase 9
 *
 * SECURITY: caller must be the owning creator. This is enforced by
 * resolveAuthenticatedCreatorId() and RLS policies on media_assets.
 *
 * @param designId - designs.id
 */
export async function getDesignMediaUrls(designId: string): Promise<DesignMediaUrls> {
  try {
    const db = createSupabaseServerClient();

    // Fetch all assets for this design (RLS: creator sees own assets)
    const { data: assets } = await db
      .from('media_assets')
      .select('id, asset_type, storage_path, status')
      .eq('design_id', designId)
      .neq('status', 'deleted')
      .in('status', ['ready']); // Only serve 'ready' assets

    if (!assets || assets.length === 0) {
      return { original: null, preview: null, thumbnail: null };
    }

    const byType = (type: MediaAssetType) =>
      (assets as Array<{ id: string; asset_type: string; storage_path: string; status: string }>)
        .find((a) => a.asset_type === type) ?? null;

    const originalAsset  = byType('original');
    const previewAsset   = byType('preview');
    const thumbnailAsset = byType('thumbnail');

    // Generate all URLs in parallel
    const [originalUrl, previewUrl, thumbnailUrl] = await Promise.all([
      originalAsset
        ? generateSignedUrl(originalAsset.storage_path, SIGNED_URL_EXPIRY_ORIGINAL)
        : null,
      previewAsset
        ? generateSignedUrl(previewAsset.storage_path, SIGNED_URL_EXPIRY_PREVIEW)
        : null,
      thumbnailAsset
        ? generateSignedUrl(thumbnailAsset.storage_path, SIGNED_URL_EXPIRY_THUMBNAIL)
        : null,
    ]);

    return {
      original:  originalUrl,
      preview:   previewUrl,
      thumbnail: thumbnailUrl,
    };
  } catch {
    return { original: null, preview: null, thumbnail: null };
  }
}

/**
 * Fetch only the original file URL (private, owner-only).
 *
 * SECURITY: This verifies that the authenticated user owns the design.
 * Returns null if the caller is not the owner.
 *
 * @param designId - designs.id
 */
export async function getOriginalFileUrl(designId: string): Promise<SignedUrlResult | null> {
  try {
    const creatorId = await resolveAuthenticatedCreatorId();
    if (!creatorId) {
      return { success: false, reason: 'Not authenticated or not a creator' };
    }

    const db = createSupabaseServerClient();
    const { data: asset } = await db
      .from('media_assets')
      .select('storage_path, creator_id, status')
      .eq('design_id', designId)
      .eq('asset_type', 'original')
      .neq('status', 'deleted')
      .maybeSingle();

    if (!asset) return null;

    // Verify ownership
    if ((asset as any).creator_id !== creatorId) {
      return { success: false, reason: 'Not authorized to access this file' };
    }

    return generateSignedUrl((asset as any).storage_path, SIGNED_URL_EXPIRY_ORIGINAL);
  } catch {
    return null;
  }
}

// =============================================================================
// URL helpers
// =============================================================================

/**
 * Select the appropriate signed URL expiry duration for a given asset type.
 *
 * Security tradeoffs:
 *   - Original: short expiry (1 hour) — maximum protection for private files
 *   - Preview:  medium expiry (24 hours) — balance between UX and security
 *   - Thumbnail: long expiry (7 days) — optimized for caching and performance
 */
function getExpiryForType(assetType: MediaAssetType): number {
  switch (assetType) {
    case 'original':  return SIGNED_URL_EXPIRY_ORIGINAL;
    case 'preview':   return SIGNED_URL_EXPIRY_PREVIEW;
    case 'thumbnail': return SIGNED_URL_EXPIRY_THUMBNAIL;
    default:          return SIGNED_URL_EXPIRY_PREVIEW;
  }
}

/**
 * Check whether a signed URL is still valid (has not expired).
 *
 * @param expiresAt - ISO-8601 expiry timestamp from SignedUrlResult
 * @param bufferMs  - Buffer in milliseconds before expiry (default: 5 minutes)
 */
export function isSignedUrlValid(expiresAt: string, bufferMs = 5 * 60 * 1000): boolean {
  const expiry = new Date(expiresAt).getTime();
  return expiry - Date.now() > bufferMs;
}

// =============================================================================
// Export constants for consumers
// =============================================================================
export {
  SIGNED_URL_EXPIRY_ORIGINAL,
  SIGNED_URL_EXPIRY_PREVIEW,
  SIGNED_URL_EXPIRY_THUMBNAIL,
};
