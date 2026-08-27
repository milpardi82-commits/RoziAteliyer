'use client';

/**
 * DesignForm — the unified design creation and editing form.
 *
 * Client Component: handles all form state, client-side validation, and
 * submits to the server via fetch (Route Handler).
 *
 * Used by:
 *   /[locale]/creator/dashboard/designs/new        → mode='create'
 *   /[locale]/creator/dashboard/designs/[id]/edit  → mode='edit'
 *
 * Upload flow:
 *   1. User fills title (required before upload)
 *   2. System creates draft design via POST /api/creator/designs (if mode='create')
 *   3. User selects image → UploadArea triggers POST /api/creator/designs/[id]/upload
 *   4. On success → shows ready state, enables "Submit for Review" if applicable
 *   5. User can save edits → PUT /api/creator/designs/[id]
 *   6. User clicks "Submit for Review" → POST /api/creator/designs/[id]/submit
 *
 * Security: all mutations go through authenticated Route Handlers that resolve
 * creator_id from the session. No creator_id is ever sent from this client.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Send,
  ArrowLeft,
  Info,
  Tag as TagIcon,
  CheckCircle2,
} from 'lucide-react';
import { UploadArea } from './UploadArea';
import { MediaProcessingIndicator } from '@/components/media/MediaProcessingIndicator';
import type {
  DesignEditorData,
  UploadProgressState,
} from '@/types/design-upload';

interface Props {
  /** 'create' — new design; 'edit' — editing an existing design */
  mode: 'create' | 'edit';
  /** Pre-fetched editor data from the Server Component */
  editorData: DesignEditorData;
  locale: string;
  /** Back link href (e.g. /[locale]/creator/dashboard/designs) */
  backHref: string;
  /** i18n strings for all UI labels */
  labels: DesignFormLabels;
}

export type DesignFormLabels = {
  // Page headings
  createTitle:          string;
  editTitle:            string;
  // Sections
  sectionDetails:       string;
  sectionImage:         string;
  // Fields
  titleLabel:           string;
  titlePlaceholder:     string;
  titleRequired:        string;
  descriptionLabel:     string;
  descriptionPlaceholder: string;
  categoryLabel:        string;
  categoryPlaceholder:  string;
  tagsLabel:            string;
  tagsPlaceholder:      string;
  // Upload
  dragDropTitle:        string;
  dragDropHint:         string;
  orClickBrowse:        string;
  uploadingLabel:       string;
  successLabel:         string;
  errorLabel:           string;
  replaceFile:          string;
  allowedTypes:         string;
  maxSize:              string;
  validating:           string;
  // Actions
  saveChanges:          string;
  saving:               string;
  savedSuccess:         string;
  submitForReview:      string;
  submitting:           string;
  submitSuccess:        string;
  submitHint:           string;
  back:                 string;
  // Errors
  saveError:            string;
  submitError:          string;
  uploadNotReady:       string;
  createFirst:          string;
  // Info
  draftBadge:           string;
  pendingBadge:         string;
  statusNote:           string;
};

// ─── Internal state types ────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type SubmitState = 'idle' | 'submitting' | 'submitted' | 'error';

// ─── Helper: format file size ─────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DesignForm({ mode, editorData, locale, backHref, labels }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Form field state ───────────────────────────────────────────────────────
  const [title,       setTitle]       = useState(editorData.design?.title       ?? '');
  const [description, setDescription] = useState(editorData.design?.description ?? '');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds,      setSelectedTagIds]      = useState<string[]>([]);

  // ── Design ID (set after first save in create mode) ───────────────────────
  const [designId, setDesignId] = useState<string | null>(
    editorData.design?.id ?? null
  );

  // ── Upload state ───────────────────────────────────────────────────────────
  const [uploadState, setUploadState] = useState<UploadProgressState>(
    () => {
      const existingReady = editorData.media.find(
        (a) => a.asset_type === 'original' && a.status === 'ready'
      );
      if (existingReady) {
        return { stage: 'done', assetId: existingReady.id };
      }
      return { stage: 'idle' };
    }
  );

  // ── Save / Submit state ────────────────────────────────────────────────────
  const [saveState,   setSaveState]   = useState<SaveState>('idle');
  const [submitState, setSubmitState] = useState<SubmitState>(
    editorData.design?.status === 'pending_review' ? 'submitted' : 'idle'
  );
  const [errorMsg,    setErrorMsg]    = useState('');

  // ── Title validation ───────────────────────────────────────────────────────
  const [titleTouched, setTitleTouched] = useState(false);
  const titleError = titleTouched && title.trim().length === 0
    ? labels.titleRequired
    : null;

  // ── Can submit check ──────────────────────────────────────────────────────
  const hasReadyUpload = uploadState.stage === 'done';
  const isEditableStatus = !editorData.design?.status ||
    editorData.design.status === 'draft' ||
    editorData.design.status === 'pending_review';

  // ── Step 1: Save or create the design draft ───────────────────────────────

  async function ensureDesignExists(): Promise<string | null> {
    // Already have a designId (edit mode, or already saved in create mode)
    if (designId) return designId;

    if (!title.trim()) {
      setTitleTouched(true);
      return null;
    }

    setSaveState('saving');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/creator/designs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setSaveState('error');
        setErrorMsg(json.message ?? labels.saveError);
        return null;
      }

      setDesignId(json.id);
      setSaveState('saved');
      return json.id as string;
    } catch {
      setSaveState('error');
      setErrorMsg(labels.saveError);
      return null;
    }
  }

  // ── Step 2: Upload the image ──────────────────────────────────────────────

  const handleFileSelected = async (file: File) => {
    setUploadState({ stage: 'validating' });

    // Ensure the design draft exists first
    const dId = await ensureDesignExists();
    if (!dId) {
      setUploadState({ stage: 'error', message: labels.createFirst });
      return;
    }

    setUploadState({ stage: 'uploading', percent: 10 });

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress while uploading (no streaming progress API available)
      const progressInterval = setInterval(() => {
        setUploadState((prev) => {
          if (prev.stage !== 'uploading') return prev;
          return { stage: 'uploading', percent: Math.min(prev.percent + 15, 85) };
        });
      }, 400);

      const res = await fetch(`/api/creator/designs/${dId}/upload`, {
        method: 'POST',
        body:   formData,
      });

      clearInterval(progressInterval);
      const json = await res.json();

      if (!res.ok || json.error) {
        setUploadState({ stage: 'error', message: json.message ?? labels.errorLabel });
        return;
      }

      setUploadState({ stage: 'done', assetId: json.assetId });
    } catch {
      setUploadState({ stage: 'error', message: labels.errorLabel });
    }
  };

  // ── Step 3: Save details ──────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setTitleTouched(true);
    if (!title.trim()) return;

    setSaveState('saving');
    setErrorMsg('');

    // Ensure design exists (for create mode first save without upload)
    const dId = designId ?? await ensureDesignExists();
    if (!dId) return;

    try {
      const res = await fetch(`/api/creator/designs/${dId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:       title.trim(),
          description: description.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setSaveState('error');
        setErrorMsg(json.message ?? labels.saveError);
        return;
      }

      setSaveState('saved');
      startTransition(() => router.refresh());

      // Reset saved state after 3s
      setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
      setErrorMsg(labels.saveError);
    }
  }

  // ── Step 4: Submit for review ────────────────────────────────────────────

  async function handleSubmit() {
    if (!designId) return;
    if (!hasReadyUpload) {
      setErrorMsg(labels.uploadNotReady);
      return;
    }

    setSubmitState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/creator/designs/${designId}/submit`, {
        method: 'POST',
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setSubmitState('error');
        setErrorMsg(json.message ?? labels.submitError);
        return;
      }

      setSubmitState('submitted');
      startTransition(() => router.refresh());
    } catch {
      setSubmitState('error');
      setErrorMsg(labels.submitError);
    }
  }

  // ── Status badge ──────────────────────────────────────────────────────────

  const currentStatus = editorData.design?.status ?? 'draft';
  const isSubmitted   = submitState === 'submitted' || currentStatus === 'pending_review';
  const isEditable    = isEditableStatus && !isSubmitted;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-8">

      {/* ── Back + heading ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <a
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          {labels.back}
        </a>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em]">
            {mode === 'create' ? labels.createTitle : labels.editTitle}
          </h1>
          {designId && (
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
                isSubmitted
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-zinc-200 bg-zinc-100 text-zinc-600'
              }`}>
                {isSubmitted ? labels.pendingBadge : labels.draftBadge}
              </span>
              <span className="text-xs text-muted-foreground">{labels.statusNote}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Global error message ─────────────────────────────────────────── */}
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* ── Submission success banner ────────────────────────────────────── */}
      {isSubmitted && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-800">{labels.submitSuccess}</p>
            <p className="mt-0.5 text-xs text-amber-700">{labels.submitHint}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">

        {/* ── Section 1: Design details ───────────────────────────────────── */}
        <section className="space-y-5 rounded-2xl border border-border bg-background p-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {labels.sectionDetails}
          </h2>

          {/* Title */}
          <div>
            <label
              htmlFor="design-title"
              className="mb-1.5 block text-sm font-medium"
            >
              {labels.titleLabel}
              <span className="ms-1 text-red-500">*</span>
            </label>
            <input
              id="design-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTitleTouched(true)}
              placeholder={labels.titlePlaceholder}
              disabled={!isEditable}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground"
            />
            {titleError && (
              <p className="mt-1 text-xs text-red-500">{titleError}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="design-description"
              className="mb-1.5 block text-sm font-medium"
            >
              {labels.descriptionLabel}
            </label>
            <textarea
              id="design-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={labels.descriptionPlaceholder}
              disabled={!isEditable}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground"
            />
          </div>

          {/* Category picker (future-ready — display only for now) */}
          {editorData.categories.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {labels.categoryLabel}
              </label>
              <div className="flex flex-wrap gap-2">
                {editorData.categories.slice(0, 12).map((cat) => {
                  const selected = selectedCategoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={!isEditable}
                      onClick={() =>
                        setSelectedCategoryIds((prev) =>
                          selected ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags (future-ready) */}
          {editorData.tags.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                <TagIcon size={13} className="text-muted-foreground" />
                {labels.tagsLabel}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {editorData.tags.slice(0, 20).map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={!isEditable}
                      onClick={() =>
                        setSelectedTagIds((prev) =>
                          selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                        )
                      }
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        selected
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      #{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── Section 2: Image upload ─────────────────────────────────────── */}
        <section className="space-y-4 rounded-2xl border border-border bg-background p-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {labels.sectionImage}
          </h2>

          {isEditable ? (
            <UploadArea
              designId={designId ?? ''}
              uploadState={uploadState}
              onFileSelected={handleFileSelected}
              onReset={() => setUploadState({ stage: 'idle' })}
              locale={locale}
              labels={{
                dragDropTitle:  labels.dragDropTitle,
                dragDropHint:   labels.dragDropHint,
                orClickBrowse:  labels.orClickBrowse,
                uploadingLabel: labels.uploadingLabel,
                successLabel:   labels.successLabel,
                errorLabel:     labels.errorLabel,
                replaceFile:    labels.replaceFile,
                allowedTypes:   labels.allowedTypes,
                maxSize:        labels.maxSize,
                validating:     labels.validating,
              }}
            />
          ) : (
            /* Non-editable: show existing image */
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 px-8 py-10 text-center">
              {uploadState.stage === 'done' ? (
                <>
                  <CheckCircle2 size={32} className="text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-800">{labels.successLabel}</p>
                </>
              ) : (
                <>
                  <Info size={24} className="text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{labels.uploadNotReady}</p>
                </>
              )}
            </div>
          )}
        </section>

        {/* ── Action bar ──────────────────────────────────────────────────── */}
        {isEditable && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            {/* Save button */}
            <button
              type="submit"
              disabled={saveState === 'saving'}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saveState === 'saving' ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  {labels.saving}
                </>
              ) : saveState === 'saved' ? (
                <>
                  <CheckCircle2 size={15} />
                  {labels.savedSuccess}
                </>
              ) : (
                <>
                  <Save size={15} />
                  {labels.saveChanges}
                </>
              )}
            </button>

            {/* Submit for review */}
            {editorData.canSubmit && designId && currentStatus === 'draft' && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitState === 'submitting' || !hasReadyUpload}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-6 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitState === 'submitting' ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    {labels.submitting}
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    {labels.submitForReview}
                  </>
                )}
              </button>
            )}
          </div>
        )}

      </form>

      {/* ── Upload status info strip ─────────────────────────────────────── */}
      {uploadState.stage === 'done' && !isSubmitted && isEditable && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-[#f7f6f2] px-4 py-3 text-xs text-muted-foreground">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>{labels.submitHint}</span>
        </div>
      )}

      {/* ── Phase 9: Media processing status indicator ───────────────────── */}
      {/* Shown only after upload; reflects background job progress in realtime */}
      {designId && uploadState.stage === 'done' && (
        <div className="flex items-center gap-2">
          <MediaProcessingIndicator
            designId={designId}
            hasReadyAssets={uploadState.stage === 'done'}
            compact={false}
          />
        </div>
      )}
    </div>
  );
}
