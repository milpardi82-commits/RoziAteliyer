'use client';

/**
 * useUserFavorites — manages persisted favorites for authenticated users.
 *
 * Falls back silently to an empty set if the user is not authenticated.
 * The existing ephemeral favorite UX in FavoritesClient is preserved separately.
 *
 * Usage: const { favorites, toggle, isLoading } = useUserFavorites();
 */
import { useState, useEffect, useCallback } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabaseAuthClient } from '@/lib/supabase/auth-client';

export function useUserFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current user + their favorites on mount
  useEffect(() => {
    const supabase = supabaseAuthClient();

    async function load() {
      const result: { data: { user: User | null }; error: unknown } =
        await supabase.auth.getUser();
      const user = result.data.user;
      if (!user) {
        setIsLoading(false);
        return;
      }
      setUserId(user.id);

      const { data } = await supabase
        .from('user_favorites')
        .select('design_id')
        .eq('user_id', user.id);

      if (data) {
        setFavorites(new Set((data as Array<{ design_id: string }>).map((r) => r.design_id)));
      }
      setIsLoading(false);
    }

    void load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session?.user) {
          setUserId(null);
          setFavorites(new Set());
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Toggle a design favorite. Optimistic update — reverts on error.
   */
  const toggle = useCallback(async (designId: string): Promise<void> => {
    if (!userId) return; // Not logged in — no-op

    const supabase = supabaseAuthClient();
    const wasFavorited = favorites.has(designId);

    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      if (wasFavorited) {
        next.delete(designId);
      } else {
        next.add(designId);
      }
      return next;
    });

    if (wasFavorited) {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('design_id', designId);

      if (error) {
        // Revert
        setFavorites((prev) => {
          const next = new Set(prev);
          next.add(designId);
          return next;
        });
      }
    } else {
      const { error } = await supabase
        .from('user_favorites')
        .insert({ user_id: userId, design_id: designId });

      if (error) {
        // Revert
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(designId);
          return next;
        });
      }
    }
  }, [userId, favorites]);

  return {
    favorites,
    toggle,
    isLoading,
    isAuthenticated: userId !== null,
  };
}
