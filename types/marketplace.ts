/**
 * Marketplace domain types.
 * These mirror the Supabase schema and serve as the single source of truth
 * for all marketplace entities across client and server.
 *
 * Phase 4 note: Design, Collection, and Tag types have been updated.
 * The canonical Phase 4 versions live in types/design.ts.
 * This file retains backward-compatible definitions used by existing
 * services and components. New code should import from types/design.ts.
 */

export type Creator = {
  id: string;
  /** FK → auth.users.id (null for seed/legacy creators) */
  user_id?: string | null;
  display_name: string;
  handle: string;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  is_verified: boolean;
  /** 'pending' | 'approved' | 'suspended' — added in Phase 3 */
  status?: 'pending' | 'approved' | 'suspended';
  design_count: number;
  follower_count: number;
  created_at: string;
  updated_at: string;
};

export type Shop = {
  id: string;
  creator_id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type Design = {
  id: string;
  creator_id: string;
  shop_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  image_url: string;
  thumbnail_url: string | null;
  colors: string[];
  width_px: number;
  height_px: number;
  dpi: number;
  is_public: boolean;
  is_featured: boolean;
  /** Content lifecycle status — added Phase 4 */
  status?: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived';
  view_count: number;
  favorite_count: number;
  review_count: number;
  avg_rating: number;
  /** Nullable for drafts — set when status transitions to 'published' */
  published_at: string | null;
  /** Set when an admin reviews the design */
  reviewed_at?: string | null;
  /** Admin feedback note */
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
  /** Joined relation — present when fetched with creators(*) */
  creators?: Creator;
  /** Joined relation — present when fetched with shops(*) */
  shops?: Shop;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_name: string | null;
  design_count: number;
};

export type Tag = {
  id: string;
  name: string;
  slug: string;
  /** Popularity count — added Phase 4 */
  use_count?: number;
};

export type Collection = {
  id: string;
  creator_id: string | null;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  /** Content lifecycle status — added Phase 4 */
  status?: 'draft' | 'published' | 'archived';
  item_count: number;
};

export type Review = {
  id: string;
  design_id: string;
  creator_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  /** Joined relation */
  creators?: Creator;
};

/** Sort options for the design browse/discover experience */
export type DesignSortOption = 'newest' | 'popular' | 'rating' | 'favorites';
