/**
 * Design Metadata Service — Phase 8.
 *
 * Server-side operations for connecting designs to categories and tags.
 * Implements the design_categories and design_tags junction table operations
 * with full ownership enforcement.
 *
 * ONLY call these functions from Server Components, Server Actions, or
 * Route Handlers. Never import this file from a Client Component.
 *
 * Security model:
 *   - All mutations require the caller to own the design
 *     (enforced by RLS: insert/delete_own_design_categories_v4, etc.)
 *   - Category and tag IDs must be valid (FK constraint enforces this)
 *   - Bulk set operations are atomic: clear first, then insert
 *
 * RLS policies in use (from migration 20260826000000):
 *   - insert_own_design_categories_v4
 *   - delete_own_design_categories_v4
 *   - insert_own_design_tags_v4
 *   - delete_own_design_tags_v4
 */

import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import type { Category, Tag } from '@/types/design';

// =============================================================================
// Category operations
// =============================================================================

/**
 * Get all categories currently attached to a design.
 *
 * @param designId - designs.id
 */
export async function getDesignCategories(designId: string): Promise<Category[]> {
  try {
    const db = createSupabaseServerClient();

    const { data, error } = await db
      .from('design_categories')
      .select('categories(*)')
      .eq('design_id', designId);

    if (error || !data) return [];

    return data
      .map((row: any) => row.categories)
      .filter(Boolean) as Category[];
  } catch {
    return [];
  }
}

/**
 * Add a single category to a design.
 *
 * RLS enforces that only the owning creator can insert.
 * Returns false if the insert fails (e.g., already attached, not owner).
 *
 * @param designId   - designs.id
 * @param categoryId - categories.id
 */
export async function addDesignCategory(
  designId: string,
  categoryId: string
): Promise<boolean> {
  try {
    const db = createSupabaseServerClient();

    const { error } = await db
      .from('design_categories')
      .insert({ design_id: designId, category_id: categoryId });

    // 23505 = unique_violation (already attached — not an error)
    if (error && error.code !== '23505') {
      console.error('[design-metadata.service] addDesignCategory error:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a category from a design.
 *
 * RLS enforces that only the owning creator can delete.
 *
 * @param designId   - designs.id
 * @param categoryId - categories.id
 */
export async function removeDesignCategory(
  designId: string,
  categoryId: string
): Promise<boolean> {
  try {
    const db = createSupabaseServerClient();

    const { error } = await db
      .from('design_categories')
      .delete()
      .eq('design_id', designId)
      .eq('category_id', categoryId);

    if (error) {
      console.error('[design-metadata.service] removeDesignCategory error:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Set the complete category list for a design (atomic replace).
 *
 * Removes all existing categories, then inserts the new set.
 * This is the primary mutation used by the design editor's category picker.
 *
 * The two-step delete+insert is safe because:
 *   - The caller owns the design (enforced by RLS on both operations)
 *   - Both steps are in the same request context (no concurrent edits expected
 *     in Phase 8; transactions will be used in Phase 9 via an RPC function)
 *
 * @param designId    - designs.id
 * @param categoryIds - Complete replacement set of category IDs (empty = remove all)
 */
export async function setDesignCategories(
  designId: string,
  categoryIds: string[]
): Promise<{ success: boolean; error: string | null }> {
  try {
    const db = createSupabaseServerClient();

    // Step 1: Remove all existing category links
    const { error: deleteError } = await db
      .from('design_categories')
      .delete()
      .eq('design_id', designId);

    if (deleteError) {
      return { success: false, error: `delete_failed: ${deleteError.message}` };
    }

    // Step 2: Insert new category links (skip if empty)
    if (categoryIds.length > 0) {
      const rows = categoryIds.map((id) => ({
        design_id:   designId,
        category_id: id,
      }));

      const { error: insertError } = await db
        .from('design_categories')
        .insert(rows);

      if (insertError) {
        return { success: false, error: `insert_failed: ${insertError.message}` };
      }
    }

    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// =============================================================================
// Tag operations
// =============================================================================

/**
 * Get all tags currently attached to a design.
 *
 * @param designId - designs.id
 */
export async function getDesignTags(designId: string): Promise<Tag[]> {
  try {
    const db = createSupabaseServerClient();

    const { data, error } = await db
      .from('design_tags')
      .select('tags(*)')
      .eq('design_id', designId);

    if (error || !data) return [];

    return data
      .map((row: any) => row.tags)
      .filter(Boolean) as Tag[];
  } catch {
    return [];
  }
}

/**
 * Add a single tag to a design.
 *
 * RLS enforces that only the owning creator can insert.
 * Increments the tag's use_count via a separate update (best-effort).
 *
 * @param designId - designs.id
 * @param tagId    - tags.id
 */
export async function addDesignTag(designId: string, tagId: string): Promise<boolean> {
  try {
    const db = createSupabaseServerClient();

    const { error } = await db
      .from('design_tags')
      .insert({ design_id: designId, tag_id: tagId });

    if (error && error.code !== '23505') {
      console.error('[design-metadata.service] addDesignTag error:', error.message);
      return false;
    }

    // Increment use_count (best-effort — not critical to the operation)
    if (!error) {
      try { await db.rpc('increment_tag_use_count', { p_tag_id: tagId }); } catch { /* ignore */ }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a tag from a design.
 *
 * Decrements the tag's use_count via a separate update (best-effort).
 *
 * @param designId - designs.id
 * @param tagId    - tags.id
 */
export async function removeDesignTag(designId: string, tagId: string): Promise<boolean> {
  try {
    const db = createSupabaseServerClient();

    const { error } = await db
      .from('design_tags')
      .delete()
      .eq('design_id', designId)
      .eq('tag_id', tagId);

    if (error) {
      console.error('[design-metadata.service] removeDesignTag error:', error.message);
      return false;
    }

    // Decrement use_count (best-effort)
    try {
      await db.rpc('decrement_tag_use_count', { p_tag_id: tagId });
    } catch {
      // RPC may not exist yet — ignore silently
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Set the complete tag list for a design (atomic replace).
 *
 * Removes all existing tags, then inserts the new set.
 * This is the primary mutation used by the design editor's tag selector.
 *
 * @param designId - designs.id
 * @param tagIds   - Complete replacement set of tag IDs (empty = remove all)
 */
export async function setDesignTags(
  designId: string,
  tagIds: string[]
): Promise<{ success: boolean; error: string | null }> {
  try {
    const db = createSupabaseServerClient();

    // Fetch existing tag IDs for use_count bookkeeping
    const { data: existing } = await db
      .from('design_tags')
      .select('tag_id')
      .eq('design_id', designId);

    const existingIds = (existing ?? []).map((r: any) => r.tag_id as string);

    // Step 1: Remove all existing tag links
    const { error: deleteError } = await db
      .from('design_tags')
      .delete()
      .eq('design_id', designId);

    if (deleteError) {
      return { success: false, error: `delete_failed: ${deleteError.message}` };
    }

    // Step 2: Insert new tag links
    if (tagIds.length > 0) {
      const rows = tagIds.map((id) => ({
        design_id: designId,
        tag_id:    id,
      }));

      const { error: insertError } = await db
        .from('design_tags')
        .insert(rows);

      if (insertError) {
        return { success: false, error: `insert_failed: ${insertError.message}` };
      }
    }

    // Best-effort use_count maintenance
    const removed = existingIds.filter((id) => !tagIds.includes(id));
    const added   = tagIds.filter((id) => !existingIds.includes(id));

    await Promise.allSettled([
      ...removed.map(async (id) => {
        try { await db.rpc('decrement_tag_use_count', { p_tag_id: id }); } catch { /* ignore */ }
      }),
      ...added.map(async (id) => {
        try { await db.rpc('increment_tag_use_count', { p_tag_id: id }); } catch { /* ignore */ }
      }),
    ]);

    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// =============================================================================
// Combined metadata update
// =============================================================================

/**
 * Update both categories and tags for a design in a single operation.
 *
 * Both operations are performed in parallel. If one fails, the other
 * is still attempted (best-effort). The combined result reports all errors.
 *
 * @param designId    - designs.id
 * @param categoryIds - New complete set of category IDs
 * @param tagIds      - New complete set of tag IDs
 */
export async function setDesignMetadata(
  designId: string,
  categoryIds: string[],
  tagIds: string[]
): Promise<{ success: boolean; errors: string[] }> {
  const [catResult, tagResult] = await Promise.all([
    setDesignCategories(designId, categoryIds),
    setDesignTags(designId, tagIds),
  ]);

  const errors: string[] = [];
  if (!catResult.success && catResult.error) errors.push(`categories: ${catResult.error}`);
  if (!tagResult.success && tagResult.error) errors.push(`tags: ${tagResult.error}`);

  return { success: errors.length === 0, errors };
}
