/**
 * Review data service — server-side data access layer.
 *
 * All Supabase queries for the `reviews` table live here.
 *
 * ONLY call these functions from Server Components, Server Actions, or API routes.
 */
import { supabaseServer } from '@/lib/supabase/server';
import type { Review } from '@/types/marketplace';

/** Fetch all reviews for a given design, newest first. */
export async function getReviewsByDesign(designId: string): Promise<Review[]> {
  try {
    const db = supabaseServer();
    const { data, error } = await db
      .from('reviews')
      .select('*, creators(*)')
      .eq('design_id', designId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as Review[];
  } catch {
    return [];
  }
}
