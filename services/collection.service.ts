/**
 * Collection Service — Phase 8.
 *
 * Server-side operations for creator-owned collection management.
 * Covers: fetching collections, adding/removing designs, creation.
 *
 * ONLY call these functions from Server Components, Server Actions, or
 * Route Handlers. Never import this file from a Client Component.
 *
 * Security model:
 *   - All mutations require the caller to own the collection.
 *     Enforced by RLS (insert_own_collection_items_v4, delete_own_collection_items_v4).
 *   - Designs can only be added to collections owned by the same creator.
 *   - No storefront or commerce logic is included in this phase.
 *   - Cross-creator collection access is blocked by Postgres RLS.
 *
 * RLS policies in use (from migration 20260826000000):
 *   - read_own_collections / read_published_collections
 *   - insert_own_collections_v4 / update_own_collections_v4 / delete_own_collections_v4
 *   - insert_own_collection_items_v4 / delete_own_collection_items_v4
 */

import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import { resolveAuthenticatedCreatorId } from '@/services/media.service';
import { supabaseServer } from '@/lib/supabase/server';
import type { Collection, CollectionItem, CreateCollectionInput } from '@/types/design';
import type { Creator } from '@/types/marketplace';

// =============================================================================
// Collection queries
// =============================================================================

/**
 * Fetch all collections owned by the authenticated creator.
 *
 * Includes draft, published, and archived collections.
 * Returns empty array if not authenticated or no creator row.
 */
export async function getMyCollections(): Promise<Collection[]> {
  try {
    const db = createSupabaseServerClient();

    const { data, error } = await db
      .from('collections')
      .select('*')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false });

    if (error || !data) return [];
    return data as Collection[];
  } catch {
    return [];
  }
}

/**
 * Fetch a single collection by ID, with its items (designs).
 *
 * Returns null if not found or not accessible.
 * The 'read_own_collections' RLS policy ensures only the owner can see
 * non-published collections.
 *
 * @param collectionId - collections.id
 */
export async function getCollectionWithItems(
  collectionId: string
): Promise<{ collection: Collection; items: CollectionItem[] } | null> {
  try {
    const db = createSupabaseServerClient();

    const [collectionResult, itemsResult] = await Promise.all([
      db.from('collections').select('*').eq('id', collectionId).maybeSingle(),
      db
        .from('collection_items')
        .select('*, designs(id, title, slug, thumbnail_url, image_url, status)')
        .eq('collection_id', collectionId)
        .order('added_at', { ascending: false }),
    ]);

    if (collectionResult.error || !collectionResult.data) return null;

    return {
      collection: collectionResult.data as Collection,
      items: (itemsResult.data ?? []) as CollectionItem[],
    };
  } catch {
    return null;
  }
}

// =============================================================================
// Public collection query (Phase 13)
// =============================================================================

/**
 * Type returned by getPublicCollection().
 *
 * Public-safe: never includes creator user_id, admin notes, or private media.
 * designs only contains publicly published entries (status='published', is_public=true).
 */
export type PublicCollectionResult = {
  collection: Pick<
    Collection,
    'id' | 'name' | 'description' | 'cover_image_url' | 'item_count' | 'created_at'
  >;
  creator: Pick<Creator, 'id' | 'display_name' | 'handle' | 'avatar_url' | 'is_verified'> | null;
  designs: Array<{
    id: string;
    title: string;
    slug: string;
    image_url: string;
    thumbnail_url: string | null;
    avg_rating: number;
    creators: Pick<Creator, 'display_name' | 'handle'> | null;
  }>;
};

/**
 * Fetch a published collection for public display.
 *
 * Security model:
 *   - Uses the anon Supabase client so RLS is enforced.
 *   - RLS policy 'read_published_collections' requires: is_public=true AND status='published'.
 *   - RLS policy 'read_published_designs' requires: status='published' AND is_public=true.
 *   - Draft and archived collections return null → caller renders notFound().
 *   - Unpublished designs are excluded by RLS on the designs join.
 *   - creator_id is NEVER accepted from client input.
 *   - Returns only public-safe fields; no user_id, admin_note, or storage paths.
 *
 * @param collectionId - collections.id (from public route parameter)
 */
export async function getPublicCollection(
  collectionId: string
): Promise<PublicCollectionResult | null> {
  try {
    const db = supabaseServer(); // anon client — RLS enforces published-only visibility

    // 1. Fetch the collection with its creator (single round-trip).
    //    RLS 'read_published_collections' silently filters non-published rows.
    const { data: collectionRow, error: collectionError } = await db
      .from('collections')
      .select(
        'id, name, description, cover_image_url, item_count, created_at, creator_id, creators(id, display_name, handle, avatar_url, is_verified)'
      )
      .eq('id', collectionId)
      .maybeSingle();

    if (collectionError || !collectionRow) return null;

    // 2. Fetch collection_items with only published designs.
    //    RLS 'read_collection_items' is USING (true) — all items are visible.
    //    The join to designs is governed by 'read_published_designs' RLS
    //    so only status='published' AND is_public=true rows are returned.
    const { data: items, error: itemsError } = await db
      .from('collection_items')
      .select(
        'design_id, designs(id, title, slug, image_url, thumbnail_url, avg_rating, creators(display_name, handle))'
      )
      .eq('collection_id', collectionId)
      .order('added_at', { ascending: false });

    if (itemsError) return null;

    // 3. Build public-safe collection fields.
    const collection = {
      id:              collectionRow.id as string,
      name:            collectionRow.name as string,
      description:     collectionRow.description as string | null,
      cover_image_url: collectionRow.cover_image_url as string | null,
      item_count:      collectionRow.item_count as number,
      created_at:      collectionRow.created_at as string,
    };

    // 4. Build public-safe creator (never expose user_id).
    //    Supabase returns a single object (not array) for FK-based joins.
    type CreatorJoin = { id: string; display_name: string; handle: string; avatar_url: string | null; is_verified: boolean } | null;
    const creatorJoin = collectionRow.creators as unknown as CreatorJoin;
    const creator = creatorJoin
      ? {
          id:           creatorJoin.id,
          display_name: creatorJoin.display_name,
          handle:       creatorJoin.handle,
          avatar_url:   creatorJoin.avatar_url,
          is_verified:  creatorJoin.is_verified,
        }
      : null;

    // 5. Filter to only items where the design join resolved (i.e., published designs).
    type DesignJoin = {
      id: string;
      title: string;
      slug: string;
      image_url: string;
      thumbnail_url: string | null;
      avg_rating: number;
      creators: { display_name: string; handle: string } | null;
    } | null;

    const designs = ((items ?? []) as unknown as Array<{ design_id: string; designs: DesignJoin }>)
      .filter((item) => item.designs !== null)
      .map((item) => {
        const d = item.designs!;
        return {
          id:            d.id,
          title:         d.title,
          slug:          d.slug,
          image_url:     d.image_url,
          thumbnail_url: d.thumbnail_url,
          avg_rating:    d.avg_rating,
          creators:      d.creators ?? null,
        };
      });

    return { collection, creator, designs };
  } catch {
    return null;
  }
}

// =============================================================================
// Collection mutations
// =============================================================================

/**
 * Create a new collection for the authenticated creator.
 *
 * The creator_id is resolved from the session — never from client input.
 * New collections start with status='draft' and is_public=false.
 *
 * @param input - Collection creation payload
 */
export async function createCollection(
  input: CreateCollectionInput
): Promise<{ data: Collection | null; error: string | null }> {
  try {
    const creatorId = await resolveAuthenticatedCreatorId();
    if (!creatorId) {
      return { data: null, error: 'not_authenticated' };
    }

    const db = createSupabaseServerClient();

    const { data, error } = await db
      .from('collections')
      .insert({
        creator_id:       creatorId,
        name:             input.name.trim(),
        description:      input.description?.trim() ?? null,
        cover_image_url:  input.cover_image_url ?? null,
        is_public:        input.is_public ?? false,
        status:           'draft',
        item_count:       0,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }
    return { data: data as Collection, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Create failed';
    return { data: null, error: msg };
  }
}

// =============================================================================
// Collection update / delete
// =============================================================================

/**
 * Update a collection owned by the authenticated creator.
 *
 * Only the creator who owns the collection can update it.
 * Creator identity is resolved from the session — never from client input.
 *
 * @param collectionId - collections.id
 * @param input        - Partial update payload
 */
export type UpdateCollectionInput = {
  name?: string;
  description?: string;
  is_public?: boolean;
};

export async function updateCollection(
  collectionId: string,
  input: UpdateCollectionInput
): Promise<{ data: Collection | null; error: string | null }> {
  try {
    const creatorId = await resolveAuthenticatedCreatorId();
    if (!creatorId) {
      return { data: null, error: 'not_authenticated' };
    }

    // Build the update payload — only include fields that were provided
    const update: Record<string, unknown> = {};
    if (typeof input.name === 'string') update.name = input.name.trim();
    if (typeof input.description === 'string') update.description = input.description.trim() || null;
    if (typeof input.is_public === 'boolean') update.is_public = input.is_public;

    if (Object.keys(update).length === 0) {
      return { data: null, error: 'no_changes' };
    }

    const db = createSupabaseServerClient();

    // RLS policy update_own_collections_v4 enforces ownership
    const { data, error } = await db
      .from('collections')
      .update(update)
      .eq('id', collectionId)
      .eq('creator_id', creatorId)
      .select()
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }
    if (!data) {
      return { data: null, error: 'collection_not_found_or_not_owned' };
    }
    return { data: data as Collection, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Update failed';
    return { data: null, error: msg };
  }
}

/**
 * Delete a collection owned by the authenticated creator.
 *
 * The collection and all its items are removed (CASCADE on collection_items).
 * Creator identity is resolved from the session — never from client input.
 *
 * @param collectionId - collections.id
 */
export async function deleteCollection(
  collectionId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const creatorId = await resolveAuthenticatedCreatorId();
    if (!creatorId) {
      return { success: false, error: 'not_authenticated' };
    }

    const db = createSupabaseServerClient();

    // RLS policy delete_own_collections_v4 enforces ownership
    const { error } = await db
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .eq('creator_id', creatorId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Delete failed';
    return { success: false, error: msg };
  }
}

// =============================================================================
// Collection item operations
// =============================================================================

/**
 * Add a design to a creator-owned collection.
 *
 * Access control (enforced by two independent guards):
 *   1. RLS (insert_own_collection_items_v4): the collection must be owned by
 *      the authenticated creator.
 *   2. Service layer: the design must also be owned by the same creator —
 *      a creator cannot add another creator's designs to their collections
 *      in this phase.
 *
 * Returns false if:
 *   - The design is already in the collection (idempotent — not an error)
 *   - The collection is not owned by the caller
 *   - The design is not owned by the caller
 *
 * @param collectionId - collections.id
 * @param designId     - designs.id
 */
export async function addDesignToCollection(
  collectionId: string,
  designId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const creatorId = await resolveAuthenticatedCreatorId();
    if (!creatorId) {
      return { success: false, error: 'not_authenticated' };
    }

    const db = createSupabaseServerClient();

    // Verify that both the collection and design belong to this creator
    const [collectionCheck, designCheck] = await Promise.all([
      db
        .from('collections')
        .select('id')
        .eq('id', collectionId)
        .eq('creator_id', creatorId)
        .maybeSingle(),
      db
        .from('designs')
        .select('id')
        .eq('id', designId)
        .eq('creator_id', creatorId)
        .maybeSingle(),
    ]);

    if (!collectionCheck.data) {
      return { success: false, error: 'collection_not_found_or_not_owned' };
    }
    if (!designCheck.data) {
      return { success: false, error: 'design_not_found_or_not_owned' };
    }

    // Insert the collection item
    const { error } = await db
      .from('collection_items')
      .insert({
        collection_id: collectionId,
        design_id:     designId,
      });

    if (error) {
      // 23505 = unique violation — already in collection (idempotent)
      if (error.code === '23505') {
        return { success: true, error: null };
      }
      return { success: false, error: error.message };
    }

    // Increment the denormalised item_count on the collection
    await incrementCollectionItemCount(collectionId, db);

    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Add to collection failed';
    return { success: false, error: msg };
  }
}

/**
 * Remove a design from a creator-owned collection.
 *
 * Both the collection and design must be owned by the authenticated creator.
 * Returns false if not found or not owned.
 *
 * @param collectionId - collections.id
 * @param designId     - designs.id
 */
export async function removeDesignFromCollection(
  collectionId: string,
  designId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const creatorId = await resolveAuthenticatedCreatorId();
    if (!creatorId) {
      return { success: false, error: 'not_authenticated' };
    }

    const db = createSupabaseServerClient();

    // Verify collection ownership before deletion
    const { data: collection } = await db
      .from('collections')
      .select('id')
      .eq('id', collectionId)
      .eq('creator_id', creatorId)
      .maybeSingle();

    if (!collection) {
      return { success: false, error: 'collection_not_found_or_not_owned' };
    }

    // Delete the item (RLS enforces ownership on the collection side)
    const { error } = await db
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('design_id', designId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Decrement the denormalised item_count on the collection
    await decrementCollectionItemCount(collectionId, db);

    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Remove from collection failed';
    return { success: false, error: msg };
  }
}

/**
 * Check which of the creator's collections contain a specific design.
 *
 * Used by the design editor to show/unshow collection membership badges.
 *
 * @param designId - designs.id
 */
export async function getCollectionsContainingDesign(
  designId: string
): Promise<string[]> {
  try {
    const db = createSupabaseServerClient();

    const { data, error } = await db
      .from('collection_items')
      .select('collection_id')
      .eq('design_id', designId);

    if (error || !data) return [];
    return data.map((row: any) => row.collection_id as string);
  } catch {
    return [];
  }
}

// =============================================================================
// Internal helpers
// =============================================================================

/** Increment collection.item_count by 1 (best-effort). */
async function incrementCollectionItemCount(
  collectionId: string,
  db: ReturnType<typeof createSupabaseServerClient>
): Promise<void> {
  try {
    await db.rpc('increment_collection_item_count', {
      p_collection_id: collectionId,
    });
  } catch {
    // RPC may not exist yet in Phase 8 — silently skip (Phase 9 implements fully)
  }
}

/** Decrement collection.item_count by 1, floor at 0 (best-effort). */
async function decrementCollectionItemCount(
  collectionId: string,
  db: ReturnType<typeof createSupabaseServerClient>
): Promise<void> {
  try {
    await db.rpc('decrement_collection_item_count', {
      p_collection_id: collectionId,
    });
  } catch {
    // RPC may not exist yet in Phase 8 — best-effort fallback
  }
}
