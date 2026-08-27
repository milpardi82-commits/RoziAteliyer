/**
 * Creator service — Phase 3.
 *
 * Server-side data access layer for all creator-related operations.
 * Covers: public profile lookup, auth-linked creator resolution,
 * creator application submission, and profile updates.
 *
 * ONLY call these functions from Server Components, Server Actions, or Route Handlers.
 * Never import this file from a Client Component.
 */
import { supabaseServer } from '@/lib/supabase/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import type { Creator } from '@/types/marketplace';
import type {
  CreatorApplication,
  CreatorApplicationInput,
  CreatorProfileUpdate,
  CreatorStats,
} from '@/types/creator';

// =============================================================================
// Public reads (no auth required)
// =============================================================================

/**
 * Fetch a single APPROVED creator profile by their URL handle.
 *
 * Returns null if no approved creator with that handle exists.
 * Uses the anon client — no session required.
 */
export async function getCreatorByHandle(handle: string): Promise<Creator | null> {
  try {
    const db = supabaseServer();
    const { data, error } = await db
      .from('creators')
      .select('*')
      .eq('handle', handle)
      .eq('status', 'approved')
      .maybeSingle();

    if (error || !data) return null;
    return data as Creator;
  } catch {
    return null;
  }
}

/**
 * Fetch a single creator by their auth user_id.
 *
 * Used when an authenticated user checks whether they are a creator.
 * Returns null if the user has no creator account, or if their creator
 * account is not yet approved.
 *
 * @param userId - auth.users.id (from session)
 * @param includeAll - if true, return any status (for owner's own view).
 *   When true, uses the cookie-aware auth client so the user can see
 *   their own pending/suspended creator row through RLS.
 *   When false, uses the anon client (RLS `read_approved_creators` applies).
 */
export async function getCreatorByUserId(
  userId: string,
  includeAll = false
): Promise<Creator | null> {
  try {
    // Use auth client when fetching owner's own data (so update_own_creator_v3 RLS is visible)
    const db = includeAll ? createSupabaseServerClient() : supabaseServer();
    let query = db
      .from('creators')
      .select('*')
      .eq('user_id', userId);

    if (!includeAll) {
      // Belt-and-suspenders: also filter explicitly even though RLS handles it
      query = query.eq('status', 'approved');
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data as Creator;
  } catch {
    return null;
  }
}

/**
 * Fetch multiple approved creators, ordered by follower count.
 * Used for the "Meet the artists" section and the artists browse page.
 */
export async function getApprovedCreators(limit = 20): Promise<Creator[]> {
  try {
    const db = supabaseServer();
    const { data, error } = await db
      .from('creators')
      .select('*')
      .eq('status', 'approved')
      .order('follower_count', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as Creator[];
  } catch {
    return [];
  }
}

/**
 * Fetch aggregated stats for a creator's public profile page.
 *
 * Returns design_count and follower_count from the denormalized columns,
 * plus a live collection count.
 */
export async function getCreatorStats(creatorId: string): Promise<CreatorStats> {
  const fallback: CreatorStats = { design_count: 0, follower_count: 0, collection_count: 0 };
  try {
    const db = supabaseServer();

    // Creator base stats (denormalized)
    const { data: creator } = await db
      .from('creators')
      .select('design_count, follower_count')
      .eq('id', creatorId)
      .maybeSingle();

    // Live collection count
    const { count: collectionCount } = await db
      .from('collections')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('is_public', true);

    return {
      design_count: creator?.design_count ?? 0,
      follower_count: creator?.follower_count ?? 0,
      collection_count: collectionCount ?? 0,
    };
  } catch {
    return fallback;
  }
}

// =============================================================================
// Creator application (authenticated operations)
// =============================================================================

/**
 * Fetch the current user's creator application(s).
 *
 * Returns the most recent application, or null if none exists.
 * Uses the cookie-aware auth client so RLS is enforced with the user's session.
 */
export async function getMyCreatorApplication(): Promise<CreatorApplication | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('creator_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (error || !data) return null;
    return data as CreatorApplication;
  } catch {
    return null;
  }
}

/**
 * Submit a creator application for the current authenticated user.
 *
 * Returns the created application row, or null on failure.
 * Enforced by RLS — only the authenticated user can submit for themselves.
 *
 * @throws Does NOT throw — returns null on error so callers can show UI feedback.
 */
export async function applyToBeCreator(
  input: CreatorApplicationInput
): Promise<{ data: CreatorApplication | null; error: string | null }> {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'not_authenticated' };
    }

    // Check for an existing pending application
    const { data: existing } = await supabase
      .from('creator_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return { data: null, error: 'application_already_pending' };
    }

    // Check if the user is already an approved creator
    const { data: existingCreator } = await supabase
      .from('creators')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (existingCreator) {
      return { data: null, error: 'already_a_creator' };
    }

    const { data, error } = await supabase
      .from('creator_applications')
      .insert({
        user_id: user.id,
        status: 'pending',
        message: input.message?.trim() || null,
        desired_handle: input.desired_handle?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || null,
        desired_display_name: input.desired_display_name?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation = duplicate pending application
      if (error.code === '23505') {
        return { data: null, error: 'application_already_pending' };
      }
      return { data: null, error: 'submission_failed' };
    }

    return { data: data as CreatorApplication, error: null };
  } catch {
    return { data: null, error: 'submission_failed' };
  }
}

// =============================================================================
// Creator profile updates (authenticated, creator-only)
// =============================================================================

/**
 * Update a creator's own profile fields.
 *
 * Enforced by RLS — the calling user must be the owner (auth.uid() = user_id).
 * Only safe profile fields are accepted — status, id, user_id cannot be changed here.
 *
 * @param creatorId - creators.id (the standalone PK, NOT user_id)
 */
export async function updateCreatorProfile(
  creatorId: string,
  updates: CreatorProfileUpdate
): Promise<{ data: Creator | null; error: string | null }> {
  try {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from('creators')
      .update({
        ...(updates.display_name !== undefined && { display_name: updates.display_name }),
        ...(updates.bio !== undefined && { bio: updates.bio }),
        ...(updates.location !== undefined && { location: updates.location }),
        ...(updates.avatar_url !== undefined && { avatar_url: updates.avatar_url }),
        ...(updates.banner_url !== undefined && { banner_url: updates.banner_url }),
        ...(updates.website_url !== undefined && { website_url: updates.website_url }),
      })
      .eq('id', creatorId)
      .select()
      .single();

    if (error) {
      return { data: null, error: 'update_failed' };
    }

    return { data: data as Creator, error: null };
  } catch {
    return { data: null, error: 'update_failed' };
  }
}
