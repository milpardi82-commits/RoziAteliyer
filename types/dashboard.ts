/**
 * Creator Dashboard domain types — Phase 6.
 *
 * These types describe the aggregated data shapes used exclusively by the
 * Creator Dashboard. They compose existing domain types (Creator, Design,
 * Collection) into purpose-built view models, keeping the dashboard layer
 * decoupled from the underlying Supabase rows.
 *
 * Design principle:
 *   - No new DB columns required — all data derived from existing tables.
 *   - Types are additive and do not modify existing domain types.
 *   - Server-only: never expose raw DB rows; pass only what the UI needs.
 */

import type { Creator } from '@/types/marketplace';
import type { Design, DesignStatus, Collection } from '@/types/design';

// =============================================================================
// Stats
// =============================================================================

/**
 * Aggregated statistics for the dashboard overview panel.
 *
 * Counts are computed server-side with COUNT(*) queries — never client-side.
 * All counts are per-creator (RLS-scoped, never cross-creator).
 */
export type CreatorDashboardStats = {
  /** Total designs owned by this creator (all statuses) */
  total_designs: number;
  /** Designs with status = 'published' */
  published_designs: number;
  /** Designs with status = 'draft' */
  draft_designs: number;
  /** Designs with status = 'pending_review' */
  pending_review_designs: number;
  /** Designs with status = 'archived' */
  archived_designs: number;
  /** Total collections (all statuses, creator-owned only) */
  total_collections: number;
  /** Collections with is_public = true and status = 'published' */
  published_collections: number;
};

// =============================================================================
// Design summary for dashboard list view
// =============================================================================

/**
 * Minimal design representation used in the "My Designs" dashboard table.
 *
 * Excludes heavy fields (description, colors[], admin_note) that are not
 * needed in the list view — reducing payload size for paginated responses.
 */
export type CreatorDesignSummary = {
  id: string;
  title: string;
  slug: string;
  /** Thumbnail URL (falls back to image_url if null) */
  thumbnail_url: string | null;
  image_url: string;
  status: DesignStatus;
  is_public: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

// =============================================================================
// Full dashboard data bundle
// =============================================================================

/**
 * The complete data bundle for the Creator Dashboard page.
 *
 * Fetched once on the server, split into named sections, and passed to
 * the respective dashboard section components. Avoids waterfall requests.
 */
export type CreatorDashboardData = {
  /** The authenticated creator's own full profile row */
  creator: Creator;
  /** Aggregated counts for the overview panel */
  stats: CreatorDashboardStats;
  /**
   * Paginated design summaries for the "My Designs" section.
   * Default page size: 20. Ordered by updated_at DESC.
   */
  designs: CreatorDesignSummary[];
  /** Total design count used for pagination UI */
  designs_total: number;
  /** Whether there are more pages of designs */
  designs_has_more: boolean;
};

// =============================================================================
// Pagination for dashboard design list
// =============================================================================

/**
 * Parameters for the paginated dashboard design list query.
 */
export type DashboardDesignListParams = {
  /** 1-based page number. Default: 1. */
  page?: number;
  /** Items per page. Default: 20. Max: 50. */
  pageSize?: number;
  /** Optional status filter for narrowing the list. */
  statusFilter?: DesignStatus | 'all';
};

// =============================================================================
// Section identity (for navigation state)
// =============================================================================

/**
 * Valid dashboard section identifiers.
 * Used for tab/navigation active state tracking.
 */
export type DashboardSection = 'overview' | 'designs' | 'collections' | 'profile';
