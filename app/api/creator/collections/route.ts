/**
 * GET  /api/creator/collections   — list the authenticated creator's collections
 * POST /api/creator/collections   — create a new collection
 *
 * Security:
 *   - Session verified server-side via createSupabaseServerClient().
 *   - creator_id resolved from session — never accepted from request body.
 *   - Only approved creators can create/list collections.
 *
 * POST body:
 *   { name: string, description?: string, is_public?: boolean }
 *
 * POST response:
 *   201 { id, name, status, item_count }
 *   400 | 401 | 403 | 500 { error: true, message: string }
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import { getMyCollections, createCollection } from '@/services/collection.service';

// ─── GET /api/creator/collections ────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: true, message: 'not_authenticated' }, { status: 401 });
    }

    const collections = await getMyCollections();
    return NextResponse.json({ collections });
  } catch (err) {
    console.error('[GET /api/creator/collections]', err);
    return NextResponse.json({ error: true, message: 'internal_error' }, { status: 500 });
  }
}

// ─── POST /api/creator/collections ───────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // ── Auth check ───────────────────────────────────────────────────────────
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: true, message: 'not_authenticated' }, { status: 401 });
    }

    // ── Parse and validate body ──────────────────────────────────────────────
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

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: true, message: 'name_required' }, { status: 400 });
    }

    // ── Create collection ────────────────────────────────────────────────────
    const result = await createCollection({
      name: name.trim(),
      description: typeof description === 'string' ? description : undefined,
      is_public: typeof is_public === 'boolean' ? is_public : false,
    });

    if (result.error) {
      const status = result.error === 'not_authenticated' ? 401 : 400;
      return NextResponse.json({ error: true, message: result.error }, { status });
    }

    const collection = result.data!;
    return NextResponse.json(
      { id: collection.id, name: collection.name, status: collection.status, item_count: collection.item_count },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/creator/collections]', err);
    return NextResponse.json({ error: true, message: 'internal_error' }, { status: 500 });
  }
}
