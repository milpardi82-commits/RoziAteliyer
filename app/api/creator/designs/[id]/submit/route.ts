/**
 * POST /api/creator/designs/[id]/submit
 *
 * Submits a draft design for admin review.
 *
 * Transitions: draft → pending_review
 *
 * Security:
 *   - Session verified server-side.
 *   - Design ownership verified via the SECURITY DEFINER DB function
 *     `submit_design_for_review` (creators.user_id = auth.uid()).
 *   - Only draft designs can be submitted (enforced by the DB function).
 *   - Creator cannot set status to 'approved' or 'published' directly.
 *
 * Request: no body required.
 *
 * Response:
 *   200 { submitted: true }
 *   400 | 401 | 403 | 404 { error: true, message: string }
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import { submitDesignForReview } from '@/services/design-creation.service';

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteContext) {
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

    // ── Call SECURITY DEFINER DB function via service ───────────────────────
    const result = await submitDesignForReview(designId);

    if (result.error) {
      const status =
        result.error === 'not_owner'  ? 403 :
        result.error === 'not_found'  ? 404 :
        result.error === 'not_a_draft'? 400 :
        400;

      return NextResponse.json(
        { error: true, message: result.error },
        { status }
      );
    }

    return NextResponse.json({ submitted: true });
  } catch (err) {
    console.error('[POST /api/creator/designs/[id]/submit]', err);
    return NextResponse.json(
      { error: true, message: 'internal_error' },
      { status: 500 }
    );
  }
}
