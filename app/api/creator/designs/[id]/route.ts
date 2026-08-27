/**
 * PUT /api/creator/designs/[id]
 *
 * Updates a draft or pending_review design owned by the authenticated creator.
 *
 * Security:
 *   - Session verified server-side.
 *   - creator_id resolved from session — never from params.
 *   - RLS `update_own_designs_v4` enforces ownership on the DB write.
 *
 * Request body:
 *   { title?: string, description?: string }
 *
 * Response:
 *   200 { id: string, title: string, status: string }
 *   400 | 401 | 403 | 404 { error: true, message: string }
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import { updateDesignDraft } from '@/services/design-creation.service';

interface RouteContext {
  params: { id: string };
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    // ── Auth check ──────────────────────────────────────────────────────────
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: true, message: 'not_authenticated' },
        { status: 401 }
      );
    }

    const designId = params.id?.trim();
    if (!designId) {
      return NextResponse.json(
        { error: true, message: 'missing_design_id' },
        { status: 400 }
      );
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: true, message: 'invalid_json' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: true, message: 'invalid_body' },
        { status: 400 }
      );
    }

    const { title, description } = body as Record<string, unknown>;

    // ── Update draft ─────────────────────────────────────────────────────────
    const result = await updateDesignDraft(designId, {
      title:       typeof title       === 'string' ? title.trim()       : undefined,
      description: typeof description === 'string' ? description.trim() : undefined,
    });

    if (result.error) {
      const status = result.error === 'not_found_or_not_owned' ? 404
        : result.error === 'no_changes'  ? 400
        : 400;
      return NextResponse.json(
        { error: true, message: result.error },
        { status }
      );
    }

    const design = result.data!;
    return NextResponse.json({
      id:     design.id,
      title:  design.title,
      status: design.status,
    });
  } catch (err) {
    console.error('[PUT /api/creator/designs/[id]]', err);
    return NextResponse.json(
      { error: true, message: 'internal_error' },
      { status: 500 }
    );
  }
}
