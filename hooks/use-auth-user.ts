'use client';

/**
 * useAuthUser — returns the current authenticated user (or null).
 *
 * Uses the SSR-safe browser auth client. Subscribes to auth state changes.
 * Safe to call from any Client Component.
 */
import { useState, useEffect } from 'react';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabaseAuthClient } from '@/lib/supabase/auth-client';

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = supabaseAuthClient();

    // Get current session immediately
    void supabase.auth.getUser().then((result: { data: { user: User | null }; error: unknown }) => {
      setUser(result.data.user ?? null);
      setLoading(false);
    });

    // Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
