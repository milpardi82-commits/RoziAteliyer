/**
 * POST /api/creator/designs/[id]/upload
 *
 * Handles image upload for a creator's design.
 *
 * Security model:
 *   1. Session auth check — only authenticated users can call this endpoint.
 *   2. creator_id resolved server-side — never from the request.
 *   3. Design ownership verified in uploadDesignMedia() before any file operation.
 *   4. File type validated server-side (PNG, JPEG, WEBP only).
 *   5. File size validated server-side (≤ 50 MB).
 *   6. Storage path generated server-side — never from client input.
 *   7. Supabase Storage RLS provides a final path-ownership enforcement layer.
 *
 * Request: multipart/form-data with a single 'file' field.
 *
 * Response:
 *   200 { assetId: string, status: 'ready', mimeType: string, fileSizeBytes: number }
 *   400 | 401 | 403 | 404 { error: true, message: string }
 *   413 { error: true, message: 'file_too_large' }
 *   415 { error: true, message: 'invalid_file_type' }
 *   500 { error: true, message: 'internal_error' }
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import { uploadDesignMedia } from '@/services/design-creation.service';

interface RouteContext {
  params: { id: string };
}

export async function POST(request: Request, { params }: RouteContext) {
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

    // ── Parse multipart form data ───────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: true, message: 'invalid_form_data' },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: true, message: 'no_file' },
        { status: 400 }
      );
    }

    // ── Delegate to service (all validation and upload logic lives there) ───
    const result = await uploadDesignMedia(designId, file);

    // Check if result is an error
    if ('error' in result) {
      const errorCode = result.error;
      const status =
        errorCode === 'not_authenticated'  ? 401 :
        errorCode === 'not_a_creator'      ? 403 :
        errorCode === 'design_not_found'   ? 404 :
        errorCode === 'file_too_large'     ? 413 :
        errorCode === 'invalid_file_type'  ? 415 :
        errorCode === 'invalid_filename'   ? 400 :
        400;

      return NextResponse.json(
        { error: true, message: errorCode },
        { status }
      );
    }

    // Success
    return NextResponse.json(result);
  } catch (err) {
    console.error('[POST /api/creator/designs/[id]/upload]', err);
    return NextResponse.json(
      { error: true, message: 'internal_error' },
      { status: 500 }
    );
  }
}
