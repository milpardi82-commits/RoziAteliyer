/**
 * PUT    /api/creator/collections/[id]  — update a collection
 * DELETE /api/creator/collections/[id]  — delete a collection
 *
 * Security:
 *   - Session verified server-side.
 *   - creator_id resolved from session — never from params.
 *   - RLS policies enforce ownership on the DB write/delete.
 *
 * PUT body:
 *   { name?: string, description?: string, is_public?: boolean }
 *
 * Response:
 *   200 { id, name, status, item_count }     (PUT)
 *   200 { success: true }                    (DELETE)
 *   400 | 401 | 404 { error: true, message: string }
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import { updateCollection, deleteCollection } from '@/services/collection.service';

interface RouteContext {
  params: { id: string };
}

// ─── PUT /api/creator/collections/[id] ───────────────────────────────────────

export async function PUT(request: Request, { params }: RouteContext) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: true, message: 'invalid_json' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: true, message: 'invalid_body' }, { status: 400 });
    }

    const { name, description, is_public } = body as Record<string, unknown>;

    const result = await updateCollection(collectionId, {
      name:        typeof name        === 'string'  ? name        : undefined,
      description: typeof description === 'string'  ? description : undefined,
      is_public:   typeof is_public   === 'boolean' ? is_public   : undefined,
    });

    if (result.error) {
      const status = result.error === 'not_authenticated'             ? 401
        : result.error === 'collection_not_found_or_not_owned' ? 404
        : result.error === 'no_changes'                        ? 400
        : 400;
      return NextResponse.json({ error: true, message: result.error }, { status });
    }

    const c = result.data!;
    return NextResponse.json({ id: c.id, name: c.name, status: c.status, item_count: c.item_count });
  } catch (err) {
    console.error('[PUT /api/creator/collections/[id]]', err);
    return NextResponse.json({ error: true, message: 'internal_error' }, { status: 500 });
  }
}

// ─── DELETE /api/creator/collections/[id] ────────────────────────────────────

export async function DELETE(_request: Request, { params }: RouteContext) {
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

    const result = await deleteCollection(collectionId);

    if (result.error) {
      const status = result.error === 'not_authenticated' ? 401 : 400;
      return NextResponse.json({ error: true, message: result.error }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/creator/collections/[id]]', err);
    return NextResponse.json({ error: true, message: 'internal_error' }, { status: 500 });
  }
}
