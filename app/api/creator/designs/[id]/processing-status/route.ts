/**
 * GET /api/creator/designs/[id]/processing-status
 *
 * Returns the current media processing job status for a design.
 * Used by the creator dashboard realtime hook as a fallback fetch.
 *
 * Security:
 *   - Requires authenticated session.
 *   - creator_id resolved server-side — never from request.
 *   - RLS on media_processing_jobs (creator_read_own_jobs) enforces isolation.
 *   - Cross-creator access returns an empty jobs object (not a 403).
 *
 * Response:
 *   200 { found: true,  status: DesignProcessingStatus }
 *   200 { found: false, reason: string }
 *   401 { error: true, message: 'not_authenticated' }
 *   500 { error: true, message: 'internal_error' }
 *
 * POST /api/creator/designs/[id]/processing-status
 *
 * Re-queues failed processing jobs for a design.
 * Accepts: body { action: 'retry' | 'cancel', jobId?: string }
 *
 * Response:
 *   200 { success: true, retried?: number }
 *   400 { error: true, message: string }
 *   401 { error: true, message: 'not_authenticated' }
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import {
  getProcessingStatus,
  retryFailedProcessing,
  cancelProcessingJob,
} from '@/services/media-queue.service';

interface RouteContext {
  params: { id: string };
}

// ---------------------------------------------------------------------------
// GET — fetch current processing status
// ---------------------------------------------------------------------------

export async function GET(_request: Request, { params }: RouteContext) {
  try {
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

    const result = await getProcessingStatus(designId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/creator/designs/[id]/processing-status]', err);
    return NextResponse.json(
      { error: true, message: 'internal_error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — retry failed jobs or cancel a specific job
// ---------------------------------------------------------------------------

export async function POST(request: Request, { params }: RouteContext) {
  try {
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

    let body: { action?: string; jobId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: true, message: 'invalid_json' },
        { status: 400 }
      );
    }

    const { action, jobId } = body;

    if (action === 'retry') {
      const result = await retryFailedProcessing(designId);
      return NextResponse.json(result);
    }

    if (action === 'cancel' && jobId) {
      const result = await cancelProcessingJob(jobId);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: true, message: 'invalid_action' },
      { status: 400 }
    );
  } catch (err) {
    console.error('[POST /api/creator/designs/[id]/processing-status]', err);
    return NextResponse.json(
      { error: true, message: 'internal_error' },
      { status: 500 }
    );
  }
}
