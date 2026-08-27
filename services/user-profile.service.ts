/**
 * User profile service — server-side data access.
 *
 * Handles CRUD for `user_profiles` table.
 * Only call from Server Components, Server Actions, or Route Handlers.
 */
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import type { UserProfile } from '@/types/auth';

/**
 * Fetch a user's profile by their auth user ID.
 * Returns null if no profile exists yet.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data as UserProfile;
  } catch {
    return null;
  }
}

/**
 * Update a user's profile fields.
 * Only updates the fields passed — partial update.
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'username' | 'display_name' | 'avatar_url' | 'bio' | 'language_preference'>>
): Promise<UserProfile | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) return null;
    return data as UserProfile;
  } catch {
    return null;
  }
}
