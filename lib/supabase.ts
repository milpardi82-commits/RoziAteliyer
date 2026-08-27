/**
 * @deprecated
 * Legacy re-export for backwards compatibility during migration.
 *
 * Existing code that imports from '@/lib/supabase' will continue to work.
 * For new code, prefer the explicit imports:
 *   - Client Components → '@/lib/supabase/client'
 *   - Server Components → '@/lib/supabase/server'
 */
export { supabaseClient as supabase } from './supabase/client';
export { supabaseServer } from './supabase/server';
