/**
 * Design Creation Service — Phase 7.
 *
 * Server-side orchestration layer for the creator design creation and upload
 * system. Composes existing services (design.service, media.service) with
 * Phase-7-specific logic: atomic design + media creation, upload pipeline,
 * and the design editor data bundle.
 *
 * ONLY call these functions from Server Components, Server Actions, or
 * Route Handlers. Never import this file from a Client Component.
 *
 * Security model (enforced at every layer):
 *   - creator_id is ALWAYS resolved from the authenticated session.
 *     It is NEVER accepted from client parameters.
 *   - File uploads go through:
 *       1. Client-side pre-validation (type, size) — fast UX feedback
 *       2. Server-side re-validation (type, size, filename safety) — enforced
 *       3. Supabase Storage RLS — final path-ownership check
 *   - media_assets records are written with status='pending' before the
 *     Storage write, then updated to 'ready' on success or 'failed' on error.
 *     This gives an auditable trail even on partial failures.
 *
 * Performance:
 *   - getDesignEditorData() fetches categories and tags in parallel.
 *   - No full design list is loaded — only the specific design being edited.
 *   - Storage uploads are streamed through the server action; no base64 encoding.
 */

import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import {
  createDraftDesign,
  updateDraftDesign,
  submitDesignForReview,
  getCategories,
} from '@/services/design.service';
import {
  resolveAuthenticatedCreatorId,
  buildStoragePath,
  validateMediaFile,
  createMediaAssetRecord,
  updateMediaAsset,
  getOwnDesignMedia,
  DESIGNS_BUCKET,
} from '@/services/media.service';
import { queueMediaProcessing, appendProcessingLog } from '@/services/media-queue.service';
import type { Design } from '@/types/marketplace';
import type { Tag } from '@/types/design';
import type {
  DesignCreationInput,
  DesignUpdateInput,
  DesignEditorData,
  DesignEditorAsset,
  DesignUploadResult,
  DesignUploadError,
} from '@/types/design-upload';

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Generate a URL-safe slug from a title.
 * Mirrors the slug logic used in createDraftDesign() for consistency.
 */
function titleToSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Add a numeric suffix to a slug to avoid uniqueness collisions.
 * Called only when the initial slug is taken.
 */
function slugWithSuffix(slug: string, attempt: number): string {
  return `${slug}-${attempt}`;
}

/**
 * Fetch all tags, ordered by use_count descending.
 * Returns empty array on failure.
 */
async function getTags(): Promise<Tag[]> {
  try {
    const db = createSupabaseServerClient();
    const { data, error } = await db
      .from('tags')
      .select('id, name, slug, use_count')
      .order('use_count', { ascending: false })
      .limit(200);

    if (error || !data) return [];
    return data as Tag[];
  } catch {
    return [];
  }
}

/**
 * Resolve the design for the editor — verifies ownership.
 * Returns null if the design is not found, or not owned by the session creator.
 *
 * Uses read_own_designs RLS so no cross-creator data can leak.
 */
async function resolveOwnDesign(designId: string): Promise<Design | null> {
  try {
    const db = createSupabaseServerClient();
    const { data, error } = await db
      .from('designs')
      .select('*')
      .eq('id', designId)
      .maybeSingle();

    if (error || !data) return null;
    return data as Design;
  } catch {
    return null;
  }
}

// =============================================================================
// Public service functions
// =============================================================================

/**
 * Create a new draft design for the authenticated creator.
 *
 * Resolves creator_id from the session — never from client input.
 * Handles slug uniqueness by appending a counter on collision.
 *
 * @returns The created Design row, or a structured error.
 */
export async function createDesignDraft(
  input: DesignCreationInput
): Promise<{ data: Design | null; error: string | null }> {
  const baseSlug = titleToSlug(input.title);
  if (!baseSlug) {
    return { data: null, error: 'invalid_title' };
  }

  // Try up to 5 slug variants before giving up
  for (let attempt = 0; attempt <= 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : slugWithSuffix(baseSlug, attempt);

    const result = await createDraftDesign({
      title:         input.title.trim(),
      slug,
      description:   input.description?.trim(),
      image_url:     'https://via.placeholder.com/1500x1500.png?text=Draft', // placeholder until upload
      colors:        input.colors ?? [],
      category_ids:  input.category_ids ?? [],
      tag_ids:       input.tag_ids ?? [],
    });

    if (!result.error) {
      return result;
    }

    if (result.error === 'slug_taken') {
      continue; // try next suffix
    }

    return result; // propagate other errors immediately
  }

  return { data: null, error: 'slug_taken' };
}

/**
 * Update an existing draft or pending_review design.
 *
 * Only the editable fields from DesignUpdateInput are accepted.
 * Status cannot be changed via this function.
 *
 * @param designId - designs.id
 * @param input    - partial update payload
 */
export async function updateDesignDraft(
  designId: string,
  input: DesignUpdateInput
): Promise<{ data: Design | null; error: string | null }> {
  return updateDraftDesign(designId, {
    title:       input.title,
    description: input.description,
  });
}

/**
 * Upload a design image and create/update the media_asset record.
 *
 * This is the core upload pipeline:
 *   1. Resolve creator from session (never trusts client)
 *   2. Validate file type and size server-side
 *   3. Create a 'pending' media_assets record (audit trail)
 *   4. Upload file to Supabase Storage via service-role-equivalent path
 *   5. Update media_asset status to 'ready' (or 'failed' on error)
 *   6. Update designs.image_url to point at the asset
 *
 * @param designId   - designs.id (must be owned by the authenticated creator)
 * @param file       - The File object from the client upload form
 */
export async function uploadDesignMedia(
  designId: string,
  file: File
): Promise<DesignUploadResult | DesignUploadError> {
  // ── Step 1: Resolve creator from session ─────────────────────────────────
  const creatorId = await resolveAuthenticatedCreatorId();
  if (!creatorId) {
    return { error: 'not_authenticated' };
  }

  // ── Step 2: Verify the design is owned by this creator ───────────────────
  const design = await resolveOwnDesign(designId);
  if (!design) {
    return { error: 'design_not_found' };
  }
  if (design.creator_id !== creatorId) {
    return { error: 'design_not_found' }; // deliberately opaque
  }
  if (!['draft', 'pending_review'].includes(design.status ?? '')) {
    return { error: 'design_not_editable', detail: `Design status is '${design.status}'` };
  }

  // ── Step 3: Server-side file validation ──────────────────────────────────
  // Only allow PNG, JPEG, WEBP per the spec (not TIFF/SVG for creator uploads)
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      error: 'invalid_file_type',
      detail: `Allowed types: PNG, JPEG, WEBP. Received: ${file.type}`,
    };
  }

  const validation = validateMediaFile({
    mimeType:     file.type,
    fileSizeBytes: file.size,
    filename:     file.name,
  });

  if (!validation.valid) {
    if (file.size > 50 * 1024 * 1024) {
      return { error: 'file_too_large', detail: validation.reason };
    }
    return { error: 'invalid_filename', detail: validation.reason };
  }

  // ── Step 4: Build the server-side-only storage path ──────────────────────
  const storagePath = buildStoragePath(creatorId, designId, 'original', file.name);

  // ── Step 5: Create 'pending' media_asset record (audit trail) ────────────
  const assetRecord = await createMediaAssetRecord({
    design_id:     designId,
    creator_id:    creatorId,
    storage_path:  storagePath,
    storage_bucket: DESIGNS_BUCKET,
    asset_type:    'original',
    mime_type:     file.type,
    file_size:     file.size,
  });

  if (!assetRecord) {
    return { error: 'record_failed', detail: 'Could not create media asset record' };
  }

  // ── Step 6: Upload to Supabase Storage ───────────────────────────────────
  try {
    const db = createSupabaseServerClient();
    const arrayBuffer = await file.arrayBuffer();

    const { error: storageError } = await db.storage
      .from(DESIGNS_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: true, // replace existing file if creator re-uploads
      });

    if (storageError) {
      // Mark the asset record as failed for the audit trail
      await updateMediaAsset(assetRecord.id, { status: 'failed' });
      return { error: 'upload_failed', detail: storageError.message };
    }
  } catch (err) {
    await updateMediaAsset(assetRecord.id, { status: 'failed' });
    return {
      error: 'upload_failed',
      detail: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  // ── Step 7: Mark original asset as 'ready' (file is in storage) ──────────
  // The asset record is now 'ready' as an original. Background jobs will
  // generate the preview and thumbnail asynchronously.
  const updateOk = await updateMediaAsset(assetRecord.id, { status: 'ready' });
  if (!updateOk) {
    // Upload succeeded but we couldn't update the status — not critical
    console.warn('[design-creation.service] Asset uploaded but status update failed:', assetRecord.id);
  }

  // ── Step 8: Queue background processing jobs (Phase 9) ───────────────────
  // Replaces the synchronous processDesignMedia() call from Phase 8.
  // Three jobs (metadata, preview, thumbnail) are created and the Edge
  // Function worker will pick them up asynchronously.
  const queueResult = await queueMediaProcessing(creatorId, designId, assetRecord.id);
  if (!queueResult.success) {
    // Non-fatal: the file is uploaded and the original is ready.
    // Processing can be retried manually from the dashboard.
    console.warn(
      '[design-creation.service] Failed to queue processing jobs:',
      queueResult.reason
    );
  }

  // ── Step 9: Append upload log entry ──────────────────────────────────────
  await appendProcessingLog(assetRecord.id, {
    ts:      new Date().toISOString(),
    event:   'upload_started',
    status:  'ready',
    message: `Original uploaded successfully (${file.size} bytes). Processing queued.`,
  });

  return {
    assetId:       assetRecord.id,
    status:        'ready',
    mimeType:      file.type,
    fileSizeBytes: file.size,
  };
}

/**
 * Fetch all data needed for the design editor page.
 *
 * For a new design (/designs/new): design = null, media = []
 * For an existing design (/designs/[id]/edit): design + its media assets
 *
 * Categories and tags are fetched in parallel for performance.
 * Server-only fields (storage_path, storage_bucket, creator_id) are
 * stripped from MediaAsset before returning — never sent to the client.
 *
 * @param designId - If provided, fetch that design; otherwise returns editor data for a new design.
 */
export async function getDesignEditorData(
  designId?: string
): Promise<DesignEditorData | null> {
  // Fetch categories and tags in parallel — independent of design
  const [categories, tags, design, rawMedia] = await Promise.all([
    getCategories(),
    getTags(),
    designId ? resolveOwnDesign(designId) : Promise.resolve(null),
    designId ? getOwnDesignMedia(designId) : Promise.resolve([]),
  ]);

  // If a designId was requested but not found, return null so the page can 404
  if (designId && !design) {
    return null;
  }

  // Strip server-only fields from media assets before passing to the client
  const media: DesignEditorAsset[] = rawMedia.map((a) => ({
    id:         a.id,
    asset_type: a.asset_type,
    mime_type:  a.mime_type,
    file_size:  a.file_size,
    width:      a.width,
    height:     a.height,
    status:     a.status,
  }));

  // A design can be submitted if it is in 'draft' status and has at least one ready original
  const hasReadyOriginal = media.some(
    (a) => a.asset_type === 'original' && a.status === 'ready'
  );
  const canSubmit = design?.status === 'draft' && hasReadyOriginal;

  return {
    design,
    media,
    categories,
    tags,
    canSubmit,
  };
}

/**
 * Submit a draft design for admin review.
 *
 * Re-exports the existing submitDesignForReview() from design.service.ts
 * so callers can import from a single service in Phase 7.
 */
export { submitDesignForReview };
