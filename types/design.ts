/**
 * Design domain types — Phase 4.
 *
 * These types mirror the Supabase schema and serve as the authoritative source
 * for all design-related entities: designs, collections, categories, tags,
 * and all associated enumerations and payload shapes.
 *
 * Design principle:
 *   - A Design is the core marketplace entity.
 *   - It belongs to a Creator, optionally to a Shop, and can be in Collections.
 *   - Status drives the entire content lifecycle.
 */

// =============================================================================
// Status enumerations
// =============================================================================

/**
 * Lifecycle status of a design.
 *
 * draft          — Creator is still working on it. Not visible to the public.
 * pending_review — Creator submitted it. Awaiting admin approval.
 * approved       — Admin approved but not yet set to public. Transitional state.
 * published      — Visible to everyone. is_public = true.
 * archived       — Removed from public view. is_public = false. Not deleted.
 */
export type DesignStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'published'
  | 'archived';

/**
 * Lifecycle status of a collection.
 *
 * draft     — Being curated. Not visible to the public.
 * published — Visible to everyone.
 * archived  — Removed from public view.
 */
export type CollectionStatus = 'draft' | 'published' | 'archived';

// =============================================================================
// Core entity types
// =============================================================================

/**
 * Full design row as stored in the `designs` table.
 *
 * NOTE: `creator_id` is the standalone `creators.id` UUID — NOT `auth.users.id`.
 * Ownership checks always go through `creators.user_id = auth.uid()`.
 */
export type Design = {
  id: string;
  /** FK → creators.id (standalone UUID, not auth.users.id) */
  creator_id: string;
  /** FK → shops.id (nullable) */
  shop_id: string | null;
  title: string;
  /** URL-safe slug (unique across all designs) */
  slug: string;
  description: string | null;
  /** Full-size preview image URL */
  image_url: string;
  /** Smaller thumbnail URL */
  thumbnail_url: string | null;
  /** Dominant colours as hex strings (e.g. ['#E8A0BF', '#27AE60']) */
  colors: string[];
  width_px: number;
  height_px: number;
  dpi: number;
  /** Public visibility gate — must be true for published status */
  is_public: boolean;
  /** Editorial featured flag */
  is_featured: boolean;
  /** Content lifecycle status — added Phase 4 */
  status: DesignStatus;
  /** Denormalised view count */
  view_count: number;
  /** Denormalised favourite count */
  favorite_count: number;
  /** Denormalised review count */
  review_count: number;
  /** Denormalised average rating (0–5, 2dp) */
  avg_rating: number;
  /** Set when status transitions to 'published'. May be null for drafts. */
  published_at: string | null;
  /** Set when an admin reviews the design. Null for unreviewed designs. */
  reviewed_at: string | null;
  /** Admin feedback note (visible to creator). Null if not reviewed. */
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  // ── Joined relations (present when selected with creators(*) / shops(*)) ──
  creators?: import('./marketplace').Creator;
  shops?: import('./marketplace').Shop;
};

/**
 * Public-facing design — only the fields safe to expose to unauthenticated users.
 * Always status = 'published', is_public = true.
 */
export type PublicDesign = Omit<Design, 'admin_note' | 'reviewed_at'>;

/**
 * Fields a creator is allowed to set when creating a draft.
 * Status and is_public are enforced by RLS — not accepted from client.
 */
export type CreateDraftDesignInput = {
  title: string;
  slug: string;
  description?: string;
  image_url: string;
  thumbnail_url?: string;
  colors?: string[];
  width_px?: number;
  height_px?: number;
  dpi?: number;
  shop_id?: string;
  category_ids?: string[];
  tag_ids?: string[];
};

/**
 * Fields a creator is allowed to update on a draft design.
 * Status escalation is handled by dedicated functions, not this update payload.
 */
export type UpdateDraftDesignInput = Partial<
  Pick<
    Design,
    | 'title'
    | 'description'
    | 'image_url'
    | 'thumbnail_url'
    | 'colors'
    | 'width_px'
    | 'height_px'
    | 'dpi'
    | 'shop_id'
  >
>;

// =============================================================================
// Category types
// =============================================================================

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Lucide icon name string */
  icon_name: string | null;
  /** Denormalised count of published designs in this category */
  design_count: number;
  created_at?: string;
};

// =============================================================================
// Tag types
// =============================================================================

export type Tag = {
  id: string;
  name: string;
  slug: string;
  /** Number of published designs using this tag — added Phase 4 */
  use_count: number;
  created_at?: string;
};

/**
 * Tag with the design it is attached to (joined from design_tags).
 */
export type DesignTag = {
  design_id: string;
  tag_id: string;
  tag?: Tag;
};

// =============================================================================
// Collection types
// =============================================================================

export type Collection = {
  id: string;
  /** FK → creators.id (nullable for system collections) */
  creator_id: string | null;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  /** Content lifecycle status — added Phase 4 */
  status: CollectionStatus;
  /** Denormalised item count */
  item_count: number;
  created_at: string;
  updated_at: string;
  // ── Joined relations ──
  creators?: import('./marketplace').Creator;
};

export type CollectionItem = {
  id: string;
  collection_id: string;
  design_id: string;
  added_at: string;
  design?: Design;
};

/**
 * Payload for creating a new collection.
 */
export type CreateCollectionInput = {
  name: string;
  description?: string;
  cover_image_url?: string;
  is_public?: boolean;
};

// =============================================================================
// Pagination
// =============================================================================

/**
 * Standard pagination parameters for list queries.
 * All public list endpoints should support pagination.
 */
export type PaginationParams = {
  page?: number;     // 1-based, default 1
  pageSize?: number; // default 24, max 96
};

/**
 * Paginated result wrapper.
 */
export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

// =============================================================================
// Filter / sort types
// =============================================================================

/** Sort options for the design browse / discover experience */
export type DesignSortOption = 'newest' | 'popular' | 'rating' | 'favorites';

/** Filter parameters for the public design browse endpoint */
export type DesignFilterParams = {
  categorySlug?: string;
  tagSlug?: string;
  creatorId?: string;
  search?: string;
  sort?: DesignSortOption;
  featured?: boolean;
} & PaginationParams;
