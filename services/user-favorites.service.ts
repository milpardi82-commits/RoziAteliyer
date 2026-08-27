/**
 * User favorites service — server-side data access.
 *
 * Manages the user_favorites table (for authenticated, non-creator users).
 * Only call from Server Components, Server Actions, or Route Handlers.
 */
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';

/**
 * Fetch all design IDs favorited by a user.
 */
export async function getUserFavoriteIds(userId: string): Promise<string[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('user_favorites')
      .select('design_id')
      .eq('user_id', userId);

    if (error || !data) return [];
    return data.map((row: { design_id: string }) => row.design_id);
  } catch {
    return [];
  }
}

/**
 * Toggle a design favorite for the current user.
 * Returns the new favorited state (true = added, false = removed).
 */
export async function toggleUserFavorite(
  userId: string,
  designId: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient();

    // Check if already favorited
    const { data: existing } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('design_id', designId)
      .maybeSingle();

    if (existing) {
      // Remove favorite
      await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('design_id', designId);
      return false;
    } else {
      // Add favorite
      await supabase
        .from('user_favorites')
        .insert({ user_id: userId, design_id: designId });
      return true;
    }
  } catch {
    return false;
  }
}
