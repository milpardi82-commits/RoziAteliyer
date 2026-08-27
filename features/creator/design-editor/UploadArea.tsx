'use client';

/**
 * UploadArea — drag-and-drop / click-to-browse image upload component.
 *
 * Client Component: handles file selection, client-side pre-validation,
 * and upload progress display. Calls the /api/creator/designs/[id]/upload
 * Route Handler via fetch — never writes to Supabase directly.
 *
 * Allowed types: PNG, JPEG, WEBP — 50 MB max
 * Matches the server-side UPLOAD_CONSTRAINTS in media.service.ts.
 */

import { useRef, useState, useCallback } from 'react';
import { Upload, CheckCircle2, AlertCircle, ImageIcon, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UploadProgressState } from '@/types/design-upload';

// Client-side constraints (mirrors server-side UPLOAD_CONSTRAINTS)
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ALLOWED_EXTENSIONS = '.png, .jpg, .jpeg, .webp';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

interface Props {
  designId: string;
  /** Current upload state — controls which UI variant is rendered */
  uploadState: UploadProgressState;
  /** Callback when the user selects a file and client-side validation passes */
  onFileSelected: (file: File) => void;
  /** Callback to reset back to idle */
  onReset: () => void;
  /** Locale for RTL-aware rendering */
  locale: string;
  /** i18n strings */
  labels: {
    dragDropTitle:  string;
    dragDropHint:   string;
    orClickBrowse:  string;
    uploadingLabel: string;
    successLabel:   string;
    errorLabel:     string;
    replaceFile:    string;
    allowedTypes:   string;
    maxSize:        string;
    validating:     string;
  };
}

export function UploadArea({
  uploadState,
  onFileSelected,
  onReset,
  labels,
}: Props) {
  const inputRef     = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ── Client-side validation ─────────────────────────────────────────────────

  function validateAndSubmit(file: File): void {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      onReset();
      // Immediate re-trigger with error state handled by parent
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      onReset();
      return;
    }
    onFileSelected(file);
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSubmit(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onFileSelected]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSubmit(file);
    // Reset so re-selecting the same file triggers onChange
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  // ── Render variants ────────────────────────────────────────────────────────

  // Done state — show the success card
  if (uploadState.stage === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={24} />
        </div>
        <p className="font-semibold text-emerald-800">{labels.successLabel}</p>
        <button
          type="button"
          onClick={onReset}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
        >
          <X size={12} />
          {labels.replaceFile}
        </button>
      </div>
    );
  }

  // Error state
  if (uploadState.stage === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-8 py-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-500">
          <AlertCircle size={24} />
        </div>
        <p className="font-semibold text-red-800">{labels.errorLabel}</p>
        <p className="max-w-xs text-sm text-red-700">{uploadState.message}</p>
        <button
          type="button"
          onClick={onReset}
          className="mt-1 rounded-lg border border-red-200 bg-white px-4 py-1.5 text-xs font-medium text-red-700 transition-colors hover:border-red-300"
        >
          {labels.replaceFile}
        </button>
      </div>
    );
  }

  // Uploading / validating state
  if (uploadState.stage === 'uploading' || uploadState.stage === 'validating') {
    const percent = uploadState.stage === 'uploading' ? uploadState.percent : 0;
    const label   = uploadState.stage === 'validating' ? labels.validating : `${labels.uploadingLabel} ${percent}%`;

    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-muted/30 px-8 py-10">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">{label}</p>
        {uploadState.stage === 'uploading' && (
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  // Idle state — the drag-and-drop zone
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={labels.dragDropTitle}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-colors',
        isDragging
          ? 'border-primary/60 bg-primary/5'
          : 'border-border bg-[#f7f6f2] hover:border-primary/40 hover:bg-muted/30',
      )}
    >
      <div className={cn(
        'grid h-14 w-14 place-items-center rounded-full transition-colors',
        isDragging ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
      )}>
        {isDragging ? <Upload size={24} /> : <ImageIcon size={24} />}
      </div>

      <div>
        <p className="font-semibold text-foreground">{labels.dragDropTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{labels.dragDropHint}</p>
        <p className="mt-1 text-xs text-muted-foreground/70">{labels.orClickBrowse}</p>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <p className="text-[11px] text-muted-foreground/60">{labels.allowedTypes}</p>
        <p className="text-[11px] text-muted-foreground/60">{labels.maxSize}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={ALLOWED_EXTENSIONS}
        onChange={handleFileChange}
        tabIndex={-1}
      />
    </div>
  );
}
