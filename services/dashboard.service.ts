/**
 * Dashboard service — Phase 6.
 *
 * Server-side data access layer for the Creator Dashboard.
 * Composes existing services (creator, design) with purpose-built aggregations.
 *
 * ONLY call these functions from Server Components, Server Actions, or Route Handlers.
 * Never import this file from a Client Component.
 *
 * Security model:
 *   - All queries use createSupabaseServerClient() (session-aware, RLS-enforced).
 *   - Creator identity is ALWAYS resolved from the authenticated session —
 *     never accepted from client parameters.
 *   - Cross-creator data access is impossible: RLS policies on designs and
 *     collections enforce ownership through creators.user_id = auth.uid().
 *
 * Performance principles:
 *   - Stats use COUNT(*) queries with HEAD=true — no row data fetched.
 *   - Design list is paginated (default 20 rows). Never loads all designs.
 *   - All data fetched in parallel via Promise.all() — no waterfall requests.
 */

import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import type { Creator } from '@/types/marketplace';
import type {
  CreatorDashboardData,
  CreatorDashboardStats,
  CreatorDesignSummary,
  DashboardDesignListParams,
} from '@/types/dashboard';

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Resolve the creator row for the current authenticated session.
 *
 * Accepts any creator status so the dashboard can show the correct
 * access-gating UI (pending, suspended, approved).
 *
 * Returns null if the user is not authenticated or has no creator row.
 */
async function resolveSessionCreator(): Promise<Creator | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return null;
    return data as Creator;
  } catch {
    return null;
  }
}

// =============================================================================
// Public service functions
// =============================================================================

/**
 * Resolve the creator for the current authenticated user.
 *
 * Returns the creator row regardless of status (approved/pending/suspended)
 * so the dashboard can render the correct access-gating state.
 *
 * Returns null if unauthenticated or if the user has no creator row.
 */
export async function getDashboardCreator(): Promise<Creator | null> {
  return resolveSessionCreator();
}

/**
 * Fetch aggregated stats for the creator dashboard overview panel.
 *
 * All counts are server-side COUNT(*) queries — no data rows returned.
 * Enforced by RLS: the `read_own_designs` and `read_own_collections` policies
 * restrict results to the authenticated creator's own rows.
 *
 * Returns a zero-filled fallback if anything fails, so the UI always renders.
 */
export async function getCreatorDashboardStats(
  creatorId: string
): Promise<CreatorDashboardStats> {
  const fallback: CreatorDashboardStats = {
    total_designs: 0,
    published_designs: 0,
    draft_designs: 0,
    pending_review_designs: 0,
    archived_designs: 0,
    total_collections: 0,
    published_collections: 0,
  };

  try {
    const supabase = createSupabaseServerClient();

    // All stat queries run in parallel — no waterfall
    const [
      totalDesigns,
      publishedDesigns,
      draftDesigns,
      pendingDesigns,
      archivedDesigns,
      totalCollections,
      publishedCollections,
    ] = await Promise.all([
      // Total designs (all statuses)
      supabase
        .from('designs')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', creatorId),

      // Published designs
      supabase
        .from('designs')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', creatorId)
        .eq('status', 'published'),

      // Draft designs
      supabase
        .from('designs')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', creatorId)
        .eq('status', 'draft'),

      // Pending review designs
      supabase
        .from('designs')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', creatorId)
        .eq('status', 'pending_review'),

      // Archived designs
      supabase
        .from('designs')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', creatorId)
        .eq('status', 'archived'),

      // Total collections (all statuses, creator-owned)
      supabase
        .from('collections')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', creatorId),

      // Published + public collections
      supabase
        .from('collections')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', creatorId)
        .eq('status', 'published')
        .eq('is_public', true),
    ]);

    return {
      total_designs:           totalDesigns.count      ?? 0,
      published_designs:       publishedDesigns.count  ?? 0,
      draft_designs:           draftDesigns.count      ?? 0,
      pending_review_designs:  pendingDesigns.count    ?? 0,
      archived_designs:        archivedDesigns.count   ?? 0,
      total_collections:       totalCollections.count  ?? 0,
      published_collections:   publishedCollections.count ?? 0,
    };
  } catch {
    return fallback;
  }
}

/**
 * Fetch a paginated list of the creator's own designs for the dashboard.
 *
 * Returns only the summary fields needed by the design list UI — not the
 * full Design row (which includes colors[], description, admin_note, etc.).
 *
 * Enforced by RLS: `read_own_designs` ensures only the authenticated creator's
 * designs are returned, across all statuses.
 *
 * @param creatorId  - creators.id (the standalone UUID)
 * @param params     - pagination and filter options
 */
export async function getCreatorDesignSummary(
  creatorId: string,
  params: DashboardDesignListParams = {}
): Promise<{ designs: CreatorDesignSummary[]; total: number; hasMore: boolean }> {
  const page     = Math.max(1, params.page     ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
  const offset   = (page - 1) * pageSize;

  try {
    const supabase = createSupabaseServerClient();

    let query = supabase
      .from('designs')
      .select(
        'id, title, slug, thumbnail_url, image_url, status, is_public, is_featured, created_at, updated_at, published_at',
        { count: 'exact' }
      )
      .eq('creator_id', creatorId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    // Optional status filter (skip if 'all' or undefined)
    if (params.statusFilter && params.statusFilter !== 'all') {
      query = query.eq('status', params.statusFilter);
    }

    const { data, error, count } = await query;

    if (error || !data) {
      return { designs: [], total: 0, hasMore: false };
    }

    const total   = count ?? data.length;
    const hasMore = offset + pageSize < total;

    return {
      designs: data as CreatorDesignSummary[],
      total,
      hasMore,
    };
  } catch {
    return { designs: [], total: 0, hasMore: false };
  }
}

/**
 * Fetch all data for the Creator Dashboard in a single server round-trip.
 *
 * Resolves the creator from the session, then fetches stats and designs
 * in parallel. Returns null if the user is not a creator (any status).
 *
 * This is the primary entry point for the dashboard page Server Component.
 */
export async function getCreatorDashboardData(
  params: DashboardDesignListParams = {}
): Promise<CreatorDashboardData | null> {
  try {
    const creator = await resolveSessionCreator();
    if (!creator) return null;

    // Stats and initial design page fetched in parallel
    const [stats, { designs, total, hasMore }] = await Promise.all([
      getCreatorDashboardStats(creator.id),
      getCreatorDesignSummary(creator.id, params),
    ]);

    return {
      creator,
      stats,
      designs,
      designs_total: total,
      designs_has_more: hasMore,
    };
  } catch {
    return null;
  }
}
