/**
 * Creator domain types — Phase 3.
 *
 * These types mirror the database schema and serve as the single source of
 * truth for creator identity, application lifecycle, and status semantics.
 *
 * Design principle:
 *   - Creator is a PROMOTION of a User — not a separate identity.
 *   - All user base identity (email, auth) lives in auth.users + user_profiles.
 *   - Creator-specific fields (handle, banner, verified, counts) live here.
 */

// =============================================================================
// Enums / Literal types
// =============================================================================

/**
 * Lifecycle status of a creator account.
 *
 * pending   — creator row created but not yet approved (e.g. self-registered
 *             while awaiting admin confirmation in future flow)
 * approved  — visible on the public marketplace
 * suspended — hidden from public; creator cannot publish
 */
export type CreatorStatus = 'pending' | 'approved' | 'suspended';

/**
 * Lifecycle status of a creator application.
 *
 * pending  — submitted, awaiting admin review
 * approved — accepted; a `creators` row has been created for the user
 * rejected — declined; the user may reapply after a waiting period (future)
 */
export type CreatorApplicationStatus = 'pending' | 'approved' | 'rejected';

// =============================================================================
// Core domain types
// =============================================================================

/**
 * Full creator profile row as stored in the `creators` table.
 *
 * Note: `user_id` is the FK to `auth.users`. The 8 seed creators have
 * `user_id = null` (standalone seeding); real creator accounts will always
 * have a non-null `user_id`.
 */
export type Creator = {
  /** Standalone UUID PK — NOT the same as auth.users.id */
  id: string;
  /** FK → auth.users.id (null for seed/legacy creators) */
  user_id: string | null;
  /** Public display name — shown on profile and design cards */
  display_name: string;
  /** URL-safe handle (e.g. 'elena-marchetti') */
  handle: string;
  /** Short biography — displayed on profile page */
  bio: string | null;
  /** Geographic location — optional, for display only */
  location: string | null;
  /** Profile image URL */
  avatar_url: string | null;
  /** Profile banner / cover image URL */
  banner_url: string | null;
  /** External website URL */
  website_url: string | null;
  /** Platform-granted verified badge */
  is_verified: boolean;
  /** Account lifecycle status */
  status: CreatorStatus;
  /** Denormalized count of published designs */
  design_count: number;
  /** Denormalized count of followers */
  follower_count: number;
  created_at: string;
  updated_at: string;
};

/**
 * Public-safe creator profile — fields safe to expose to unauthenticated users.
 * Always status = 'approved' when returned from the public API.
 */
export type PublicCreator = Omit<Creator, 'user_id'>;

/**
 * Subset of Creator fields that an authenticated creator can update
 * about themselves.
 */
export type CreatorProfileUpdate = Partial<
  Pick<Creator, 'display_name' | 'bio' | 'location' | 'avatar_url' | 'banner_url' | 'website_url'>
>;

// =============================================================================
// Creator application
// =============================================================================

/**
 * A creator application — submitted by a User who wants to become a Creator.
 *
 * One active application per user. The `status` column has a UNIQUE constraint
 * scoped to (user_id, status) so a user cannot have two pending applications.
 */
export type CreatorApplication = {
  id: string;
  /** FK → auth.users.id */
  user_id: string;
  /** Application lifecycle status */
  status: CreatorApplicationStatus;
  /** Applicant's motivation / self-description message */
  message: string | null;
  /** Desired URL handle on approval */
  desired_handle: string | null;
  /** Desired display name on approval */
  desired_display_name: string | null;
  /** Admin review note (populated on approval/rejection) */
  admin_note: string | null;
  /** When the application was submitted */
  created_at: string;
  /** When an admin reviewed it (null while pending) */
  reviewed_at: string | null;
};

/**
 * Payload for submitting a new creator application.
 * The `user_id` and `status` are set server-side.
 */
export type CreatorApplicationInput = {
  message?: string;
  desired_handle?: string;
  desired_display_name?: string;
};

// =============================================================================
// Convenience union types
// =============================================================================

/** Creator with their most recent application (joined from the service layer) */
export type CreatorWithApplication = Creator & {
  application: CreatorApplication | null;
};

/** Creator stats for the public profile page */
export type CreatorStats = {
  design_count: number;
  follower_count: number;
  collection_count: number;
};
