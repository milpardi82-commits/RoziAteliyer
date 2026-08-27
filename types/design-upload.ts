/**
 * Design Upload domain types — Phase 7.
 *
 * These types describe the input/output shapes used exclusively by the
 * design creation and upload system. They compose existing domain types
 * (Design, MediaAsset) into purpose-built creator-facing view models.
 *
 * Design principle:
 *   - No new DB columns required — all data derived from existing tables.
 *   - Types are additive; they do not modify any existing domain types.
 *   - Server-only data (storage_path, creator_id) is never included in
 *     any type passed to a Client Component.
 */

import type { Design } from '@/types/marketplace';
import type { Category, Tag } from '@/types/design';
import type { MediaAsset } from '@/types/media';

// =============================================================================
// Input types
// =============================================================================

/**
 * Fields the creator fills in when creating a new design draft.
 *
 * Notes:
 *   - creator_id is NEVER in this type — it is resolved server-side.
 *   - status and is_public are enforced by the DB insert (RLS + service).
 *   - image_url is optional at creation; the creator uploads the file separately.
 *   - slug is auto-generated from title; not exposed to the creator.
 */
export type DesignCreationInput = {
  /** Required: plain title text */
  title: string;
  /** Optional: rich description */
  description?: string;
  /** Optional: category IDs to attach */
  category_ids?: string[];
  /** Optional: tag IDs to attach */
  tag_ids?: string[];
  /** Optional: collection ID to add the design to */
  collection_id?: string;
  /** Future-ready: dominant colours as hex strings */
  colors?: string[];
  /** Future-ready: SEO/search keywords */
  keywords?: string[];
};

/**
 * Fields the creator can update on an existing draft/pending_review design.
 *
 * Status cannot be changed via this input — that goes through the
 * dedicated submitDesignForReview() function.
 */
export type DesignUpdateInput = {
  title?: string;
  description?: string;
  category_ids?: string[];
  tag_ids?: string[];
  collection_id?: string;
  colors?: string[];
  keywords?: string[];
};

// =============================================================================
// Result types
// =============================================================================

/**
 * Result returned after a successful design image upload.
 *
 * Does NOT include storage_path or storage_bucket — those are server-only.
 * The client only needs the asset ID and status to update its UI.
 */
export type DesignUploadResult = {
  /** The created media_assets.id */
  assetId: string;
  /** Always 'ready' on success */
  status: 'ready';
  /** MIME type as verified by the server */
  mimeType: string;
  /** File size in bytes */
  fileSizeBytes: number;
};

/**
 * Structured error result from an upload attempt.
 *
 * error codes:
 *   not_authenticated     — no valid session
 *   not_a_creator         — user is authenticated but has no approved creator row
 *   design_not_found      — design ID not found or not owned by this creator
 *   invalid_file_type     — MIME type not in allowed list
 *   file_too_large        — exceeds 50 MB limit
 *   invalid_filename      — path traversal or unsafe characters
 *   upload_failed         — Supabase Storage write failed
 *   record_failed         — media_asset DB record could not be created/updated
 */
export type DesignUploadError = {
  error: string;
  detail?: string;
};

// =============================================================================
// Editor data bundle
// =============================================================================

/**
 * Full data bundle for the design editor page (/designs/new and /designs/[id]/edit).
 *
 * Fetched once on the server and passed to the editor UI.
 * Contains all the information the editor needs — no additional client fetches.
 *
 * Server-only fields (storage_path, creator_id, etc.) are stripped from
 * the MediaAsset before inclusion here; only id, asset_type, mime_type,
 * file_size, status are safe to expose.
 */
export type DesignEditorData = {
  /** The design being edited — null when creating a new design */
  design: Design | null;
  /** The existing media assets for this design (empty on new design) */
  media: DesignEditorAsset[];
  /** All available categories for the category picker */
  categories: Category[];
  /** All available tags for the tag selector */
  tags: Tag[];
  /** Whether to show the submit-for-review action */
  canSubmit: boolean;
};

/**
 * Client-safe subset of MediaAsset for the editor UI.
 *
 * Strips storage_path, storage_bucket, and creator_id — those must never
 * leave the server boundary.
 */
export type DesignEditorAsset = Pick<
  MediaAsset,
  'id' | 'asset_type' | 'mime_type' | 'file_size' | 'width' | 'height' | 'status'
>;

// =============================================================================
// Upload state (client-side only — not persisted)
// =============================================================================

/**
 * Client-side upload progress state for the UploadArea component.
 * Never sent to the server.
 */
export type UploadProgressState =
  | { stage: 'idle' }
  | { stage: 'validating' }
  | { stage: 'uploading'; percent: number }
  | { stage: 'done'; assetId: string }
  | { stage: 'error'; message: string };
