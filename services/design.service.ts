/**
 * Design service — Phase 4.
 *
 * Server-side data access layer for all design-related operations.
 * Covers: public browsing, creator draft management, category/tag queries.
 *
 * ONLY call these functions from Server Components, Server Actions, or Route Handlers.
 * Never import this file from a Client Component.
 *
 * Performance principles:
 *   - All list queries are paginated (default 24 items).
 *   - Filtering happens on the database, not in JavaScript.
 *   - Counts use COUNT(*) queries, not data fetches.
 *   - Server-side queries always carry the status='published' filter for public reads.
 */
import { supabaseServer } from '@/lib/supabase/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import type { Design, Category } from '@/types/marketplace';
import type {
  DesignFilterParams,
  CreateDraftDesignInput,
  UpdateDraftDesignInput,
} from '@/types/design';

// =============================================================================
// Fallback data (build/preview safety — Supabase unavailable)
// =============================================================================

/** Fallback designs shown while Supabase is unreachable (build/preview safety). */
export const FALLBACK_DESIGNS: Design[] = [
  {
    id: '1', creator_id: '1', shop_id: null,
    title: 'Mediterranean Bloom', slug: 'mediterranean-bloom', description: null,
    image_url: 'https://images.pexels.com/photos/5117322/pexels-photo-5117322.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop',
    thumbnail_url: null, colors: ['#E8A0BF'], width_px: 1500, height_px: 1500, dpi: 150,
    is_public: true, is_featured: true, status: 'published',
    view_count: 4521, favorite_count: 312, review_count: 28,
    avg_rating: 4.8, published_at: '', created_at: '', updated_at: '',
    creators: { id: '1', display_name: 'Elena Marchetti', handle: 'elena-marchetti', bio: null,
      location: 'Milan, Italy', avatar_url: 'https://images.pexels.com/photos/5393535/pexels-photo-5393535.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop',
      banner_url: null, website_url: null, is_verified: true, design_count: 7, follower_count: 1284, created_at: '', updated_at: '' },
  },
  {
    id: '2', creator_id: '2', shop_id: null,
    title: 'Asanoha Grid', slug: 'asanoha-grid', description: null,
    image_url: 'https://images.pexels.com/photos/2268541/pexels-photo-2268541.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop',
    thumbnail_url: null, colors: ['#2C3E50'], width_px: 1500, height_px: 1500, dpi: 150,
    is_public: true, is_featured: true, status: 'published',
    view_count: 5234, favorite_count: 389, review_count: 31,
    avg_rating: 4.8, published_at: '', created_at: '', updated_at: '',
    creators: { id: '2', display_name: 'Kenji Watanabe', handle: 'kenji-watanabe', bio: null,
      location: 'Tokyo, Japan', avatar_url: 'https://images.pexels.com/photos/6925033/pexels-photo-6925033.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop',
      banner_url: null, website_url: null, is_verified: true, design_count: 6, follower_count: 2156, created_at: '', updated_at: '' },
  },
  {
    id: '3', creator_id: '3', shop_id: null,
    title: 'Pastel Dreams', slug: 'pastel-dreams', description: null,
    image_url: 'https://images.pexels.com/photos/4391611/pexels-photo-4391611.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop',
    thumbnail_url: null, colors: ['#FADBD8'], width_px: 1500, height_px: 1500, dpi: 150,
    is_public: true, is_featured: true, status: 'published',
    view_count: 6789, favorite_count: 512, review_count: 35,
    avg_rating: 4.9, published_at: '', created_at: '', updated_at: '',
    creators: { id: '3', display_name: 'Amara Okafor', handle: 'amara-okafor', bio: null,
      location: 'Lagos, Nigeria', avatar_url: 'https://images.pexels.com/photos/8036823/pexels-photo-8036823.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop',
      banner_url: null, website_url: null, is_verified: true, design_count: 5, follower_count: 3421, created_at: '', updated_at: '' },
  },
  {
    id: '4', creator_id: '4', shop_id: null,
    title: 'Monstera Wild', slug: 'monstera-wild', description: null,
    image_url: 'https://images.pexels.com/photos/3686275/pexels-photo-3686275.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop',
    thumbnail_url: null, colors: ['#27AE60'], width_px: 1500, height_px: 1500, dpi: 150,
    is_public: true, is_featured: true, status: 'published',
    view_count: 5678, favorite_count: 423, review_count: 29,
    avg_rating: 4.8, published_at: '', created_at: '', updated_at: '',
    creators: { id: '4', display_name: 'Isabella Costa', handle: 'isabella-costa', bio: null,
      location: 'Rio de Janeiro, Brazil', avatar_url: 'https://images.pexels.com/photos/22690802/pexels-photo-22690802.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop',
      banner_url: null, website_url: null, is_verified: true, design_count: 3, follower_count: 1879, created_at: '', updated_at: '' },
  },
  {
    id: '5', creator_id: '5', shop_id: null,
    title: 'Tokyo Night', slug: 'tokyo-night', description: null,
    image_url: 'https://images.pexels.com/photos/2268528/pexels-photo-2268528.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop',
    thumbnail_url: null, colors: ['#E74C3C'], width_px: 1500, height_px: 1500, dpi: 150,
    is_public: true, is_featured: true, status: 'published',
    view_count: 4123, favorite_count: 312, review_count: 24,
    avg_rating: 4.9, published_at: '', created_at: '', updated_at: '',
    creators: { id: '5', display_name: 'Kenji Watanabe', handle: 'kenji-watanabe', bio: null,
      location: 'Tokyo, Japan', avatar_url: 'https://images.pexels.com/photos/6925033/pexels-photo-6925033.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop',
      banner_url: null, website_url: null, is_verified: true, design_count: 6, follower_count: 2156, created_at: '', updated_at: '' },
  },
  {
    id: '6', creator_id: '6', shop_id: null,
    title: 'Desert Dreams', slug: 'desert-dreams', description: null,
    image_url: 'https://images.pexels.com/photos/2158532/pexels-photo-2158532.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop',
    thumbnail_url: null, colors: ['#D35400'], width_px: 1500, height_px: 1500, dpi: 150,
    is_public: true, is_featured: true, status: 'published',
    view_count: 3102, favorite_count: 234, review_count: 17,
    avg_rating: 4.7, published_at: '', created_at: '', updated_at: '',
    creators: { id: '6', display_name: 'Sofia Reyes', handle: 'sofia-reyes', bio: null,
      location: 'Oaxaca, Mexico', avatar_url: 'https://images.pexels.com/photos/22690802/pexels-photo-22690802.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop',
      banner_url: null, website_url: null, is_verified: false, design_count: 5, follower_count: 893, created_at: '', updated_at: '' },
  },
];

/** Fallback categories shown while Supabase is unreachable. */
export const FALLBACK_CATEGORIES: Category[] = [
  { id: '1', name: 'Floral',      slug: 'floral',      description: null, icon_name: 'Flower2',   design_count: 8 },
  { id: '2', name: 'Geometric',   slug: 'geometric',   description: null, icon_name: 'Hexagon',   design_count: 7 },
  { id: '3', name: 'Abstract',    slug: 'abstract',    description: null, icon_name: 'Sparkles',  design_count: 6 },
  { id: '4', name: 'Botanical',   slug: 'botanical',   description: null, icon_name: 'Leaf',      design_count: 5 },
  { id: '5', name: 'Watercolor',  slug: 'watercolor',  description: null, icon_name: 'Droplets',  design_count: 5 },
  { id: '6', name: 'Minimalist',  slug: 'minimalist',  description: null, icon_name: 'Minus',     design_count: 4 },
];

// =============================================================================
// Public reads (no auth required) — status = 'published' always applied
// =============================================================================

/**
 * Fetch featured published designs for the home page.
 * Falls back to static data gracefully.
 */
export async function getFeaturedDesigns(limit = 12): Promise<Design[]> {
  try {
    const db = supabaseServer();
    const { data, error } = await db
      .from('designs')
      .select('*, creators(*)')
      .eq('status', 'published')
      .eq('is_public', true)
      .eq('is_featured', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    // If we got less than expected featured, backfill with recent published
    if (error || !data || data.length === 0) {
      const { data: recent } = await db
        .from('designs')
        .select('*, creators(*)')
        .eq('status', 'published')
        .eq('is_public', true)
        .order('published_at', { ascending: false })
        .limit(limit);
      if (!recent || recent.length === 0) return FALLBACK_DESIGNS;
      return recent as Design[];
    }

    // If fewer featured than limit, top up with recent
    if (data.length < limit) {
      const featuredIds = data.map((d) => d.id);
      const remaining = limit - data.length;
      const { data: extra } = await db
        .from('designs')
        .select('*, creators(*)')
        .eq('status', 'published')
        .eq('is_public', true)
        .not('id', 'in', `(${featuredIds.join(',')})`)
        .order('published_at', { ascending: false })
        .limit(remaining);
      return [...data, ...(extra ?? [])] as Design[];
    }

    return data as Design[];
  } catch {
    return FALLBACK_DESIGNS;
  }
}

/**
 * Fetch a single published design by slug, including creator and shop data.
 * Returns null if the design doesn't exist or is not published.
 */
export async function getDesignBySlug(slug: string): Promise<Design | null> {
  try {
    const db = supabaseServer();
    const { data, error } = await db
      .from('designs')
      .select('*, creators(*), shops(*)')
      .eq('slug', slug)
      .eq('status', 'published')
      .eq('is_public', true)
      .maybeSingle();

    if (error || !data) return null;
    return data as Design;
  } catch {
    return null;
  }
}

/**
 * Fetch all published designs by a given creator.
 * Used for the artist profile page and "more from this artist" sections.
 *
 * @param creatorId - creators.id (the standalone PK)
 * @param excludeId - optional design ID to exclude (current design on detail page)
 * @param limit     - max results (default 8)
 */
export async function getDesignsByCreator(
  creatorId: string,
  excludeId?: string,
  limit = 8
): Promise<Design[]> {
  try {
    const db = supabaseServer();
    let query = db
      .from('designs')
      .select('*, creators(*)')
      .eq('creator_id', creatorId)
      .eq('status', 'published')
      .eq('is_public', true)
      .order('published_at', { ascending: false });

    if (excludeId) query = query.neq('id', excludeId);

    const { data, error } = await query.limit(limit);
    if (error || !data) return [];
    return data as Design[];
  } catch {
    return [];
  }
}

/**
 * Fetch published designs with server-side filtering and pagination.
 * This is the primary endpoint for the Discover/Browse page.
 *
 * All filtering is done on the database — no client-side array filtering.
 *
 * @param params - filter, sort, and pagination parameters
 */
export async function getPublishedDesigns(
  params: DesignFilterParams = {}
): Promise<Design[]> {
  try {
    const {
      categorySlug,
      tagSlug,
      creatorId,
      search,
      sort = 'newest',
      featured,
      page = 1,
      pageSize = 24,
    } = params;

    const db = supabaseServer();
    const offset = (page - 1) * pageSize;

    // Category filter: must join through design_categories
    if (categorySlug && categorySlug !== 'all') {
      const { data: catData } = await db
        .from('categories')
        .select('id')
        .eq('slug', categorySlug)
        .maybeSingle();

      if (!catData) return [];

      const { data, error } = await db
        .from('design_categories')
        .select('designs!inner(*, creators(*))')
        .eq('category_id', catData.id)
        // Filter via the joined designs table
        .eq('designs.status', 'published')
        .eq('designs.is_public', true)
        .range(offset, offset + pageSize - 1);

      if (error || !data) return [];
      return data.map((row: any) => row.designs) as Design[];
    }

    // Tag filter
    if (tagSlug) {
      const { data: tagData } = await db
        .from('tags')
        .select('id')
        .eq('slug', tagSlug)
        .maybeSingle();

      if (!tagData) return [];

      const { data, error } = await db
        .from('design_tags')
        .select('designs!inner(*, creators(*))')
        .eq('tag_id', tagData.id)
        .eq('designs.status', 'published')
        .eq('designs.is_public', true)
        .range(offset, offset + pageSize - 1);

      if (error || !data) return [];
      return data.map((row: any) => row.designs) as Design[];
    }

    // Standard query (no join required)
    let query = db
      .from('designs')
      .select('*, creators(*)')
      .eq('status', 'published')
      .eq('is_public', true);

    if (creatorId)  query = query.eq('creator_id', creatorId);
    if (featured)   query = query.eq('is_featured', true);
    if (search?.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    switch (sort) {
      case 'popular':   query = query.order('view_count',     { ascending: false }); break;
      case 'rating':    query = query.order('avg_rating',     { ascending: false }); break;
      case 'favorites': query = query.order('favorite_count', { ascending: false }); break;
      default:          query = query.order('published_at',   { ascending: false }); break;
    }

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error || !data) return FALLBACK_DESIGNS;
    return data as Design[];
  } catch {
    return FALLBACK_DESIGNS;
  }
}

/**
 * Fetch all categories ordered by design count. Falls back gracefully.
 */
export async function getCategories(): Promise<Category[]> {
  try {
    const db = supabaseServer();
    const { data, error } = await db
      .from('categories')
      .select('*')
      .order('design_count', { ascending: false });

    if (error || !data || data.length === 0) return FALLBACK_CATEGORIES;
    return data as Category[];
  } catch {
    return FALLBACK_CATEGORIES;
  }
}

// =============================================================================
// Creator operations (authenticated, RLS-enforced)
// =============================================================================

/**
 * Fetch all designs owned by the authenticated creator, across all statuses.
 * Used for the creator's design management dashboard (future phase).
 *
 * Returns designs ordered by updated_at DESC — most recently edited first.
 */
export async function getMyDesigns(): Promise<Design[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Resolve the creator row for this auth user
    const { data: creator } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (!creator) return [];

    const { data, error } = await supabase
      .from('designs')
      .select('*')
      .eq('creator_id', creator.id)
      .order('updated_at', { ascending: false });

    if (error || !data) return [];
    return data as Design[];
  } catch {
    return [];
  }
}

/**
 * Create a new draft design for the authenticated creator.
 *
 * Enforced by RLS: `insert_own_designs_v4` requires status='draft' and is_public=false.
 * The creator_id is resolved server-side from the session — never trusted from client.
 *
 * @returns The created design row, or a structured error.
 */
export async function createDraftDesign(
  input: CreateDraftDesignInput
): Promise<{ data: Design | null; error: string | null }> {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'not_authenticated' };

    // Resolve creator_id from session
    const { data: creator } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (!creator) return { data: null, error: 'not_a_creator' };

    const { data, error } = await supabase
      .from('designs')
      .insert({
        creator_id:    creator.id,
        shop_id:       input.shop_id ?? null,
        title:         input.title.trim(),
        slug:          input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
        description:   input.description?.trim() ?? null,
        image_url:     input.image_url,
        thumbnail_url: input.thumbnail_url ?? null,
        colors:        input.colors ?? [],
        width_px:      input.width_px ?? 1500,
        height_px:     input.height_px ?? 1500,
        dpi:           input.dpi ?? 150,
        status:        'draft',
        is_public:     false,
        is_featured:   false,
        published_at:  null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return { data: null, error: 'slug_taken' };
      return { data: null, error: 'create_failed' };
    }

    return { data: data as Design, error: null };
  } catch {
    return { data: null, error: 'create_failed' };
  }
}

/**
 * Update a creator's own draft design.
 *
 * Enforced by RLS: `update_own_designs_v4` blocks escalation to published/approved.
 * Only drafts and pending_review designs can be updated by the creator.
 *
 * @param designId - designs.id (the PK)
 * @param updates  - partial field updates (only safe fields accepted)
 */
export async function updateDraftDesign(
  designId: string,
  updates: UpdateDraftDesignInput
): Promise<{ data: Design | null; error: string | null }> {
  try {
    const supabase = createSupabaseServerClient();

    // Build update payload — only include defined fields
    const payload: Record<string, unknown> = {};
    if (updates.title         !== undefined) payload.title         = updates.title.trim();
    if (updates.description   !== undefined) payload.description   = updates.description?.trim() ?? null;
    if (updates.image_url     !== undefined) payload.image_url     = updates.image_url;
    if (updates.thumbnail_url !== undefined) payload.thumbnail_url = updates.thumbnail_url;
    if (updates.colors        !== undefined) payload.colors        = updates.colors;
    if (updates.width_px      !== undefined) payload.width_px      = updates.width_px;
    if (updates.height_px     !== undefined) payload.height_px     = updates.height_px;
    if (updates.dpi           !== undefined) payload.dpi           = updates.dpi;
    if (updates.shop_id       !== undefined) payload.shop_id       = updates.shop_id;

    if (Object.keys(payload).length === 0) {
      return { data: null, error: 'no_changes' };
    }

    const { data, error } = await supabase
      .from('designs')
      .update(payload)
      .eq('id', designId)
      // RLS will enforce ownership; but belt-and-suspenders: only allow on non-published
      .in('status', ['draft', 'pending_review'])
      .select()
      .single();

    if (error) return { data: null, error: 'update_failed' };
    if (!data) return { data: null, error: 'not_found_or_not_owned' };
    return { data: data as Design, error: null };
  } catch {
    return { data: null, error: 'update_failed' };
  }
}

/**
 * Submit a draft design for admin review.
 *
 * Calls the SECURITY DEFINER function `submit_design_for_review` which:
 * 1. Verifies the caller owns the design
 * 2. Verifies the design is in 'draft' status
 * 3. Transitions status → 'pending_review'
 *
 * @param designId - designs.id
 */
export async function submitDesignForReview(
  designId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.rpc('submit_design_for_review', {
      p_design_id: designId,
    });

    if (error) {
      if (error.message.includes('not the design owner')) return { error: 'not_owner' };
      if (error.message.includes('not found'))            return { error: 'not_found' };
      if (error.message.includes('expected draft'))       return { error: 'not_a_draft' };
      return { error: 'submit_failed' };
    }
    return { error: null };
  } catch {
    return { error: 'submit_failed' };
  }
}
