/**
 * Design Media Integration Service — Phase 8.
 *
 * Bridges the design domain and the media pipeline.
 * Provides enriched design queries that include media availability status
 * and pre-fetched thumbnail/preview URLs for the marketplace and dashboard.
 *
 * ONLY call these functions from Server Components, Server Actions, or
 * Route Handlers. Never import this file from a Client Component.
 *
 * Design principles:
 *   - Original files are NEVER exposed to public queries.
 *   - thumbnail_url is pre-computed server-side and passed to the client
 *     as an opaque signed URL string (no storage path exposed).
 *   - preview availability (hasPreview: boolean) is the only public
 *     signal about the media processing state.
 *   - All queries add zero overhead when no media assets exist
 *     (uses a single LEFT JOIN pattern).
 */

import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import { supabaseServer } from '@/lib/supabase/server';
import { getDesignMedia } from '@/services/media.service';
import {
  getDesignMediaUrls,
  getMarketplaceThumbnailUrl,
} from '@/services/media-url.service';

// =============================================================================
// Types
// =============================================================================

/**
 * Design enriched with media availability information.
 *
 * Added fields (never expose raw storage data):
 *   hasOriginal  — true if a ready original asset exists
 *   hasPreview   — true if a ready preview asset exists
 *   hasThumbnail — true if a ready thumbnail asset exists
 *   thumbnailSignedUrl — signed thumbnail URL (null if no thumbnail or not ready)
 */
export type DesignWithMediaStatus = {
  id: string;
  title: string;
  slug: string;
  status: string;
  image_url: string;
  thumbnail_url: string | null;
  hasOriginal: boolean;
  hasPreview: boolean;
  hasThumbnail: boolean;
  /** Pre-fetched signed thumbnail URL. Null if thumbnail not ready. */
  thumbnailSignedUrl: string | null;
};

/**
 * Media availability summary for a design.
 * Used in marketplace queries to determine what is ready to display.
 */
export type DesignMediaAvailability = {
  designId: string;
  hasOriginal: boolean;
  hasPreview: boolean;
  hasThumbnail: boolean;
  thumbnailSignedUrl: string | null;
  previewSignedUrl: string | null;
};

// =============================================================================
// Public marketplace queries
// =============================================================================

/**
 * Fetch media availability for a published design.
 *
 * Used by:
 *   - Design detail page: to show preview vs placeholder
 *   - Marketplace grid: to show thumbnail vs seed image
 *
 * Returns null for original assets — they are never exposed publicly.
 * Returns null preview/thumbnail if assets are not in 'ready' status.
 *
 * @param designId - designs.id
 */
export async function getPublicDesignMedia(
  designId: string
): Promise<DesignMediaAvailability> {
  const empty: DesignMediaAvailability = {
    designId,
    hasOriginal: false,
    hasPreview:  false,
    hasThumbnail: false,
    thumbnailSignedUrl: null,
    previewSignedUrl: null,
  };

  try {
    const db = supabaseServer(); // anon client — public RLS applies

    const { data: assets } = await db
      .from('media_assets')
      .select('asset_type, status')
      .eq('design_id', designId)
      .eq('status', 'ready')
      .neq('asset_type', 'original'); // Never expose original metadata publicly

    if (!assets || assets.length === 0) return empty;

    const byType = (type: string) =>
      assets.some((a: { asset_type: string; status: string }) => a.asset_type === type);

    // Get thumbnail signed URL (public-ready)
    const thumbnailResult = await getMarketplaceThumbnailUrl(designId);
    const thumbnailSignedUrl =
      thumbnailResult?.success ? thumbnailResult.signedUrl : null;

    return {
      designId,
      hasOriginal:  false,                      // never expose
      hasPreview:   byType('preview'),
      hasThumbnail: byType('thumbnail'),
      thumbnailSignedUrl,
      previewSignedUrl: null,                   // detail page fetches this separately
    };
  } catch {
    return empty;
  }
}

/**
 * Batch-fetch media availability for multiple published designs.
 *
 * Used by the Discover/Home page grid to prepare thumbnail URLs for all
 * visible cards without N+1 queries.
 *
 * Returns a map from designId → DesignMediaAvailability.
 *
 * @param designIds - Array of designs.id values
 */
export async function batchGetPublicDesignMedia(
  designIds: string[]
): Promise<Map<string, DesignMediaAvailability>> {
  const result = new Map<string, DesignMediaAvailability>();

  if (!designIds.length) return result;

  try {
    const db = supabaseServer();

    const { data: assets } = await db
      .from('media_assets')
      .select('design_id, asset_type, storage_path, status')
      .in('design_id', designIds)
      .eq('status', 'ready')
      .neq('asset_type', 'original');

    if (!assets) return result;

    // Group by design_id
    const grouped = (assets as Array<{
      design_id: string;
      asset_type: string;
      storage_path: string;
      status: string;
    }>).reduce((acc, asset) => {
      if (!acc[asset.design_id]) acc[asset.design_id] = [];
      acc[asset.design_id].push(asset);
      return acc;
    }, {} as Record<string, typeof assets>);

    // For each design, populate the availability object
    for (const designId of designIds) {
      const designAssets = grouped[designId] ?? [];
      const byType = (type: string) => designAssets.some((a: any) => a.asset_type === type);

      // Note: Batch signed URL generation is left as a future optimization.
      // For now we return hasThumbnail=true as the signal; the UI can request
      // the signed URL individually via getMarketplaceThumbnailUrl() if needed.
      result.set(designId, {
        designId,
        hasOriginal:  false,
        hasPreview:   byType('preview'),
        hasThumbnail: byType('thumbnail'),
        thumbnailSignedUrl: null,   // fetched on-demand per card
        previewSignedUrl: null,
      });
    }

    return result;
  } catch {
    return result;
  }
}

// =============================================================================
// Creator-facing enriched queries
// =============================================================================

/**
 * Fetch enriched media status for a creator's own design.
 *
 * Includes ALL asset types (original, preview, thumbnail) and their statuses.
 * Used by the design editor and the creator's dashboard design detail view.
 *
 * SECURITY: The creator must own the design.
 * Ownership is enforced by RLS on media_assets (read_own_media_assets).
 *
 * @param designId - designs.id (must be owned by the authenticated creator)
 */
export async function getCreatorDesignMediaStatus(
  designId: string
): Promise<DesignMediaAvailability & {
  originalStatus: string | null;
  previewStatus: string | null;
  thumbnailStatus: string | null;
}> {
  const empty = {
    designId,
    hasOriginal:    false,
    hasPreview:     false,
    hasThumbnail:   false,
    thumbnailSignedUrl: null,
    previewSignedUrl:   null,
    originalStatus:     null,
    previewStatus:      null,
    thumbnailStatus:    null,
  };

  try {
    const media = await getDesignMedia(designId);
    const urls  = await getDesignMediaUrls(designId);

    return {
      designId,
      hasOriginal:    media.original  !== null,
      hasPreview:     media.preview   !== null,
      hasThumbnail:   media.thumbnail !== null,
      thumbnailSignedUrl: urls.thumbnail?.success ? urls.thumbnail.signedUrl : null,
      previewSignedUrl:   urls.preview?.success   ? urls.preview.signedUrl   : null,
      originalStatus:  media.original?.status  ?? null,
      previewStatus:   media.preview?.status   ?? null,
      thumbnailStatus: media.thumbnail?.status ?? null,
    };
  } catch {
    return empty;
  }
}

/**
 * Check whether a specific design is ready for submission to review.
 *
 * A design is ready when:
 *   1. It is in 'draft' status
 *   2. It has at least one 'ready' original asset
 *   3. It has at least one 'ready' preview asset (good to have, not strictly required)
 *
 * @param designId - designs.id
 */
export async function isDesignReadyForReview(designId: string): Promise<{
  ready: boolean;
  hasReadyOriginal: boolean;
  hasReadyPreview: boolean;
  reason: string | null;
}> {
  try {
    const db = createSupabaseServerClient();

    const { data: design } = await db
      .from('designs')
      .select('status')
      .eq('id', designId)
      .maybeSingle();

    if (!design) return { ready: false, hasReadyOriginal: false, hasReadyPreview: false, reason: 'design_not_found' };
    if (design.status !== 'draft') return { ready: false, hasReadyOriginal: false, hasReadyPreview: false, reason: 'not_a_draft' };

    const media = await getDesignMedia(designId);
    const hasReadyOriginal = media.original?.status === 'ready';
    const hasReadyPreview  = media.preview?.status  === 'ready';

    if (!hasReadyOriginal) {
      return { ready: false, hasReadyOriginal, hasReadyPreview, reason: 'no_ready_original' };
    }

    return { ready: true, hasReadyOriginal, hasReadyPreview, reason: null };
  } catch {
    return { ready: false, hasReadyOriginal: false, hasReadyPreview: false, reason: 'error' };
  }
}
