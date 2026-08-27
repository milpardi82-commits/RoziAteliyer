/**
 * POST   /api/creator/collections/[id]/designs  — add a design to the collection
 * DELETE /api/creator/collections/[id]/designs  — remove a design from the collection
 *
 * Security:
 *   - Session verified server-side.
 *   - Both the collection and the design must be owned by the authenticated creator.
 *   - RLS insert_own_collection_items_v4 / delete_own_collection_items_v4 provides
 *     a second layer of enforcement.
 *
 * POST body:
 *   { design_id: string }
 *
 * DELETE body:
 *   { design_id: string }
 *
 * Response:
 *   200 { success: true }
 *   400 | 401 | 404 { error: true, message: string }
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import { addDesignToCollection, removeDesignFromCollection } from '@/services/collection.service';

interface RouteContext {
  params: { id: string };
}

// ─── Shared body parser ────────────────────────────────────────────────────────

async function parseDesignId(request: Request): Promise<string | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') return null;
    const { design_id } = body as Record<string, unknown>;
    if (!design_id || typeof design_id !== 'string' || !design_id.trim()) return null;
    return design_id.trim();
  } catch {
    return null;
  }
}

// ─── POST /api/creator/collections/[id]/designs ───────────────────────────────

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: true, message: 'not_authenticated' }, { status: 401 });
    }

    const collectionId = params.id?.trim();
    if (!collectionId) {
      return NextResponse.json({ error: true, message: 'missing_collection_id' }, { status: 400 });
    }

    const designId = await parseDesignId(request);
    if (!designId) {
      return NextResponse.json({ error: true, message: 'design_id_required' }, { status: 400 });
    }

    const result = await addDesignToCollection(collectionId, designId);

    if (result.error) {
      const status = result.error === 'not_authenticated'              ? 401
        : result.error === 'collection_not_found_or_not_owned'  ? 404
        : result.error === 'design_not_found_or_not_owned'      ? 404
        : 400;
      return NextResponse.json({ error: true, message: result.error }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/creator/collections/[id]/designs]', err);
    return NextResponse.json({ error: true, message: 'internal_error' }, { status: 500 });
  }
}

// ─── DELETE /api/creator/collections/[id]/designs ─────────────────────────────

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: true, message: 'not_authenticated' }, { status: 401 });
    }

    const collectionId = params.id?.trim();
    if (!collectionId) {
      return NextResponse.json({ error: true, message: 'missing_collection_id' }, { status: 400 });
    }

    const designId = await parseDesignId(request);
    if (!designId) {
      return NextResponse.json({ error: true, message: 'design_id_required' }, { status: 400 });
    }

    const result = await removeDesignFromCollection(collectionId, designId);

    if (result.error) {
      const status = result.error === 'not_authenticated'             ? 401
        : result.error === 'collection_not_found_or_not_owned' ? 404
        : 400;
      return NextResponse.json({ error: true, message: result.error }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/creator/collections/[id]/designs]', err);
    return NextResponse.json({ error: true, message: 'internal_error' }, { status: 500 });
  }
}
