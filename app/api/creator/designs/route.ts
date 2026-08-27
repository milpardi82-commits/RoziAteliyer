/**
 * POST /api/creator/designs
 *
 * Creates a new draft design for the authenticated creator.
 *
 * Security:
 *   - Session verified server-side via createSupabaseServerClient().
 *   - creator_id resolved from session — never accepted from request body.
 *   - Only approved creators can create designs (enforced by createDesignDraft()).
 *
 * Request body:
 *   { title: string, description?: string }
 *
 * Response:
 *   201 { id: string, slug: string, status: 'draft' }
 *   400 { error: true, message: string }
 *   401 { error: true, message: string }
 *   500 { error: true, message: string }
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import { createDesignDraft } from '@/services/design-creation.service';

export async function POST(request: Request) {
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

    // ── Parse and validate body ─────────────────────────────────────────────
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

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: true, message: 'title_required' },
        { status: 400 }
      );
    }

    // ── Create draft ────────────────────────────────────────────────────────
    const result = await createDesignDraft({
      title: title.trim(),
      description: typeof description === 'string' ? description : undefined,
    });

    if (result.error) {
      const status = result.error === 'not_authenticated' ? 401
        : result.error === 'not_a_creator'   ? 403
        : 400;
      return NextResponse.json(
        { error: true, message: result.error },
        { status }
      );
    }

    const design = result.data!;
    return NextResponse.json(
      { id: design.id, slug: design.slug, status: design.status },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/creator/designs]', err);
    return NextResponse.json(
      { error: true, message: 'internal_error' },
      { status: 500 }
    );
  }
}
