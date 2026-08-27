/**
 * Media Delivery Service — Phase 11: CDN Delivery & Public Media Layer.
 *
 * Provides the production public delivery layer for published design assets.
 * Separates CDN public delivery (thumbnails/previews) from private signed-URL
 * delivery (originals), completing the media architecture.
 *
 * ONLY call these functions from Server Components, Server Actions, or
 * Route Handlers. Never import this file from a Client Component.
 *
 * Security model:
 *   - Public CDN URLs are only generated for PUBLISHED designs.
 *   - designs.status must be 'published' AND designs.is_public must be true.
 *   - Original files ALWAYS stay in designs-private — never returned here.
 *   - Creator A cannot access Creator B's private assets via this service.
 *   - No URL is ever constructed from client-supplied data.
 *   - cdn_path and public_url are read from the DB, never generated client-side.
 *
 * Architecture:
 *   getPublicThumbnailUrl()   — anonymous/public CDN URL for a design's thumbnail
 *   getPublicPreviewUrl()     — anonymous/public CDN URL for a design's preview
 *   getCreatorOriginalUrl()   — signed URL for the owning creator's original file
 *   getDesignPublicMedia()    — all public CDN URLs for a design (one round-trip)
 *   batchGetDesignPublicMedia() — batch variant for grid/list pages
 */

import { supabaseServer } from '@/lib/supabase/server';
import {
  resolveAuthenticatedCreatorId,
  DESIGNS_BUCKET,
} from '@/services/media.service';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import type { MediaDeliveryResult, DesignPublicMedia } from '@/types/media';

// =============================================================================
// Constants
// =============================================================================

/** The public CDN bucket name — created in Phase 11 migration */
export const PUBLIC_BUCKET = 'designs-public' as const;

/** Signed URL expiry for original (private) files — 1 hour */
const SIGNED_URL_EXPIRY_ORIGINAL = 60 * 60; // 3 600 s

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Verify a design is published before serving its public assets.
 *
 * Returns true only when:
 *   - designs.status  = 'published'
 *   - designs.is_public = true
 *
 * Uses the anon client — RLS enforces visibility automatically.
 */
async function isDesignPublished(designId: string): Promise<boolean> {
  try {
    const db = supabaseServer();
    const { data } = await db
      .from('designs')
      .select('id')
      .eq('id', designId)
      .eq('status', 'published')
      .eq('is_public', true)
      .maybeSingle();
    return data !== null;
  } catch {
    return false;
  }
}

// =============================================================================
// Public CDN delivery functions
// =============================================================================

/**
 * Get the public CDN URL for a published design's thumbnail.
 *
 * This is the primary function used by marketplace grid cards.
 * It reads public_url directly from media_assets (populated by the worker)
 * and validates that the design is published before returning the URL.
 *
 * Returns failure if:
 *   - The design is not published / not public
 *   - No thumbnail asset exists in 'ready' status
 *   - The thumbnail has no public_url (not yet promoted to CDN)
 *
 * @param designId - designs.id
 */
export async function getPublicThumbnailUrl(
  designId: string
): Promise<MediaDeliveryResult> {
  try {
    // 1. Verify design is published — reject silently for unpublished designs
    const published = await isDesignPublished(designId);
    if (!published) {
      return { success: false, reason: 'design_not_published' };
    }

    // 2. Fetch the ready thumbnail asset with its CDN URL
    const db = supabaseServer();
    const { data: asset, error } = await db
      .from('media_assets')
      .select('public_url, published_at, status')
      .eq('design_id', designId)
      .eq('asset_type', 'thumbnail')
      .eq('status', 'ready')
      .maybeSingle();

    if (error || !asset) {
      return { success: false, reason: 'thumbnail_not_found' };
    }

    if (!asset.public_url) {
      // Thumbnail exists in designs-private but has not been promoted to CDN yet
      return { success: false, reason: 'thumbnail_not_published_to_cdn' };
    }

    return {
      success: true,
      url: asset.public_url as string,
      publishedAt: (asset.published_at as string | null) ?? null,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unexpected_error';
    return { success: false, reason };
  }
}

/**
 * Get the public CDN URL for a published design's preview.
 *
 * Used by the design detail page for the hero image.
 * Validates publication status before returning the URL.
 *
 * Returns failure if:
 *   - The design is not published / not public
 *   - No preview asset exists in 'ready' status
 *   - The preview has no public_url (not yet promoted to CDN)
 *
 * @param designId - designs.id
 */
export async function getPublicPreviewUrl(
  designId: string
): Promise<MediaDeliveryResult> {
  try {
    const published = await isDesignPublished(designId);
    if (!published) {
      return { success: false, reason: 'design_not_published' };
    }

    const db = supabaseServer();
    const { data: asset, error } = await db
      .from('media_assets')
      .select('public_url, published_at, status')
      .eq('design_id', designId)
      .eq('asset_type', 'preview')
      .eq('status', 'ready')
      .maybeSingle();

    if (error || !asset) {
      return { success: false, reason: 'preview_not_found' };
    }

    if (!asset.public_url) {
      return { success: false, reason: 'preview_not_published_to_cdn' };
    }

    return {
      success: true,
      url: asset.public_url as string,
      publishedAt: (asset.published_at as string | null) ?? null,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unexpected_error';
    return { success: false, reason };
  }
}

// =============================================================================
// Creator private file access
// =============================================================================

/**
 * Generate a signed URL for the owning creator to access their original file.
 *
 * Ownership is verified via the full chain:
 *   auth.uid() → creators.user_id → creators.id → media_assets.creator_id
 *
 * Returns failure if:
 *   - The caller is not authenticated
 *   - The caller does not own this design
 *   - No original asset exists for this design
 *
 * SECURITY: Only the owning creator receives this URL.
 *
 * @param designId - designs.id
 */
export async function getCreatorOriginalUrl(
  designId: string
): Promise<MediaDeliveryResult> {
  try {
    // 1. Resolve the authenticated creator — reject if not authenticated
    const creatorId = await resolveAuthenticatedCreatorId();
    if (!creatorId) {
      return { success: false, reason: 'not_authenticated_or_not_a_creator' };
    }

    // 2. Fetch the original asset, verifying the creator_id matches
    const db = createSupabaseServerClient();
    const { data: asset, error } = await db
      .from('media_assets')
      .select('storage_path, creator_id, status')
      .eq('design_id', designId)
      .eq('asset_type', 'original')
      .neq('status', 'deleted')
      .maybeSingle();

    if (error || !asset) {
      return { success: false, reason: 'original_not_found' };
    }

    // 3. Belt-and-suspenders: verify creator ownership after DB fetch
    if ((asset as { creator_id: string }).creator_id !== creatorId) {
      return { success: false, reason: 'not_authorized' };
    }

    // 4. Generate a signed URL (1 hour expiry — maximum privacy protection)
    const { data: signedData, error: signError } = await db.storage
      .from(DESIGNS_BUCKET)
      .createSignedUrl((asset as { storage_path: string }).storage_path, SIGNED_URL_EXPIRY_ORIGINAL);

    if (signError || !signedData?.signedUrl) {
      return {
        success: false,
        reason: signError?.message ?? 'failed_to_generate_signed_url',
      };
    }

    return {
      success: true,
      url: signedData.signedUrl,
      publishedAt: null, // originals are never "published"
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unexpected_error';
    return { success: false, reason };
  }
}

// =============================================================================
// Composite query: all public media for a design
// =============================================================================

/**
 * Fetch all public CDN URLs for a published design in a single DB round-trip.
 *
 * Used by:
 *   - Design detail page: thumbnail + preview
 *   - Marketplace grid card: thumbnail only
 *
 * Returns DesignPublicMedia with null URLs for any asset not yet on CDN.
 * Callers must use a fallback (e.g. designs.image_url) when thumbnailCdnUrl is null.
 *
 * SECURITY:
 *   - Only returns URLs for published designs.
 *   - Original assets are never included.
 *   - Does not verify caller identity — this is intentionally public.
 *
 * @param designId - designs.id
 */
export async function getDesignPublicMedia(
  designId: string
): Promise<DesignPublicMedia> {
  const empty: DesignPublicMedia = {
    design_id: designId,
    thumbnailCdnUrl: null,
    previewCdnUrl: null,
    thumbnailPublishedAt: null,
    previewPublishedAt: null,
  };

  try {
    const published = await isDesignPublished(designId);
    if (!published) return empty;

    const db = supabaseServer();
    const { data: assets, error } = await db
      .from('media_assets')
      .select('asset_type, public_url, published_at')
      .eq('design_id', designId)
      .eq('status', 'ready')
      .in('asset_type', ['thumbnail', 'preview'])
      .not('public_url', 'is', null);

    if (error || !assets || assets.length === 0) return empty;

    type Row = { asset_type: string; public_url: string | null; published_at: string | null };
    const thumb   = (assets as Row[]).find((a) => a.asset_type === 'thumbnail');
    const preview = (assets as Row[]).find((a) => a.asset_type === 'preview');

    return {
      design_id:           designId,
      thumbnailCdnUrl:     thumb?.public_url     ?? null,
      previewCdnUrl:       preview?.public_url   ?? null,
      thumbnailPublishedAt: thumb?.published_at  ?? null,
      previewPublishedAt:  preview?.published_at ?? null,
    };
  } catch {
    return empty;
  }
}

/**
 * Batch-fetch public CDN media for multiple published designs.
 *
 * Performs a single DB query for all designs, avoiding N+1 queries.
 * Used by Home and Discover page grids to populate all card thumbnail URLs.
 *
 * Returns a Map<designId, DesignPublicMedia>.
 * Designs with no CDN assets return an entry with all-null URLs.
 *
 * @param designIds - Array of designs.id values
 */
export async function batchGetDesignPublicMedia(
  designIds: string[]
): Promise<Map<string, DesignPublicMedia>> {
  const result = new Map<string, DesignPublicMedia>();
  if (designIds.length === 0) return result;

  // Seed empty entries so callers always get a result per ID
  for (const id of designIds) {
    result.set(id, {
      design_id: id,
      thumbnailCdnUrl: null,
      previewCdnUrl: null,
      thumbnailPublishedAt: null,
      previewPublishedAt: null,
    });
  }

  try {
    const db = supabaseServer();
    const { data: assets, error } = await db
      .from('media_assets')
      .select('design_id, asset_type, public_url, published_at')
      .in('design_id', designIds)
      .eq('status', 'ready')
      .in('asset_type', ['thumbnail', 'preview'])
      .not('public_url', 'is', null);

    if (error || !assets) return result;

    type Row = {
      design_id: string;
      asset_type: string;
      public_url: string | null;
      published_at: string | null;
    };

    for (const row of assets as Row[]) {
      const existing = result.get(row.design_id);
      if (!existing) continue;

      if (row.asset_type === 'thumbnail') {
        result.set(row.design_id, {
          ...existing,
          thumbnailCdnUrl:     row.public_url   ?? null,
          thumbnailPublishedAt: row.published_at ?? null,
        });
      } else if (row.asset_type === 'preview') {
        result.set(row.design_id, {
          ...existing,
          previewCdnUrl:      row.public_url   ?? null,
          previewPublishedAt: row.published_at ?? null,
        });
      }
    }

    return result;
  } catch {
    return result;
  }
}
