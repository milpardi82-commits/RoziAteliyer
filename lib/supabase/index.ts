/**
 * Supabase barrel export.
 *
 * - Client Components → import { supabaseClient } from '@/lib/supabase/client'
 * - Server Components → import { supabaseServer } from '@/lib/supabase/server'
 *
 * The legacy `supabase` named export is re-exported here for backwards
 * compatibility during the migration period. Prefer the explicit imports above.
 */
export { supabaseClient, supabaseClient as supabase } from './client';
export { supabaseServer } from './server';
