'use client';

/**
 * DashboardCollectionList — creator's collection management list.
 *
 * Client Component: handles create/edit/delete mutations via fetch to the
 * /api/creator/collections route handlers. Uses the existing dashboard
 * visual language (rounded-2xl, border-border, bg-[#f7f6f2], etc.).
 *
 * State is managed locally (optimistic updates not used — simplicity first).
 * The server page fetches the initial list; mutations refresh via router.
 */

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FolderOpen, Edit2, Trash2, X, Check, Loader2, ChevronRight } from 'lucide-react';
import { toPersianNumber } from '@/lib/i18n';
import type { Collection } from '@/types/design';
import type { Dictionary, Locale } from '@/lib/i18n';

interface Props {
  collections: Collection[];
  locale: Locale;
  dict: Dictionary;
  dashboardBase: string;
}

// =============================================================================
// Create Collection Form
// =============================================================================

function CreateCollectionForm({
  dict,
  onCreated,
  onCancel,
}: {
  dict: Dictionary;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const d = dict.dashboard;
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(d.collectionNameRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/creator/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), is_public: isPublic }),
      });
      if (!res.ok) {
        setError(d.collectionCreateError);
        return;
      }
      onCreated();
    } catch {
      setError(d.collectionCreateError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-background p-6">
      <h3 className="mb-4 font-semibold text-foreground">{d.collectionCreate}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {d.collectionName}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={d.collectionNamePlaceholder}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
            autoFocus
            maxLength={120}
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {d.collectionDescription}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={d.collectionDescriptionPlaceholder}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
            maxLength={500}
          />
        </div>

        {/* Public toggle */}
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-sm text-foreground">{d.collectionIsPublic}</span>
        </label>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? d.collectionSaving : d.collectionCreate}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <X size={14} />
            {d.collectionCancelBtn}
          </button>
        </div>
      </form>
    </div>
  );
}

// =============================================================================
// Edit Collection Inline Form
// =============================================================================

function EditCollectionForm({
  collection,
  dict,
  onSaved,
  onCancel,
}: {
  collection: Collection;
  dict: Dictionary;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const d = dict.dashboard;
  const [name, setName]               = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? '');
  const [isPublic, setIsPublic]       = useState(collection.is_public);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(d.collectionNameRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/creator/collections/${collection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), is_public: isPublic }),
      });
      if (!res.ok) {
        setError(d.collectionUpdateError);
        return;
      }
      onSaved();
    } catch {
      setError(d.collectionUpdateError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={d.collectionNamePlaceholder}
        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
        autoFocus
        maxLength={120}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={d.collectionDescriptionPlaceholder}
        rows={2}
        className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
        maxLength={500}
      />
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-xs text-foreground">{d.collectionIsPublic}</span>
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {saving ? d.collectionSaving : d.collectionSaveChanges}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <X size={12} />
          {d.collectionCancelBtn}
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// Collection Card
// =============================================================================

function CollectionCard({
  collection,
  dict,
  locale,
  dashboardBase,
  onRefresh,
}: {
  collection: Collection;
  dict: Dictionary;
  locale: Locale;
  dashboardBase: string;
  onRefresh: () => void;
}) {
  const d = dict.dashboard;
  const [editing, setEditing]     = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const confirmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const itemCount = locale === 'fa'
    ? toPersianNumber(collection.item_count)
    : collection.item_count;

  function handleEditSaved() {
    setEditing(false);
    onRefresh();
  }

  async function handleDelete() {
    if (!confirmDel) {
      setConfirmDel(true);
      confirmRef.current = setTimeout(() => setConfirmDel(false), 4000);
      return;
    }
    if (confirmRef.current) clearTimeout(confirmRef.current);
    setDeleting(true);
    try {
      await fetch(`/api/creator/collections/${collection.id}`, { method: 'DELETE' });
    } finally {
      setDeleting(false);
      setConfirmDel(false);
      onRefresh();
    }
  }

  if (editing) {
    return (
      <div className="overflow-hidden rounded-2xl border border-primary/30 bg-background">
        <EditCollectionForm
          collection={collection}
          dict={dict}
          onSaved={handleEditSaved}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between gap-3 rounded-2xl border border-border bg-[#f7f6f2] p-4 transition-colors hover:border-border/80">
      {/* Icon + info */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <FolderOpen size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{collection.name}</p>
          {collection.description && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {collection.description}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {itemCount} {d.collectionItemCount}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Open link */}
        <Link
          href={`${dashboardBase}/collections/${collection.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          {d.collectionOpenBtn}
          <ChevronRight size={11} />
        </Link>

        {/* Edit */}
        <button
          onClick={() => setEditing(true)}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          aria-label={d.collectionEditTitle}
        >
          <Edit2 size={13} />
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`grid h-8 w-8 place-items-center rounded-lg border text-xs font-medium transition-colors disabled:opacity-60 ${
            confirmDel
              ? 'border-destructive/50 bg-destructive/10 text-destructive'
              : 'border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive'
          }`}
          aria-label={d.collectionDelete}
          title={confirmDel ? d.collectionDeleteConfirm : d.collectionDelete}
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Empty state
// =============================================================================

function CollectionsEmpty({ dict }: { dict: Dictionary }) {
  const d = dict.dashboard;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-[#f7f6f2] px-8 py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <FolderOpen size={24} />
      </div>
      <p className="font-semibold text-foreground">{d.collectionsEmpty}</p>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {d.collectionsEmptyDesc}
      </p>
    </div>
  );
}

// =============================================================================
// Main component
// =============================================================================

export function DashboardCollectionList({ collections: initial, locale, dict, dashboardBase }: Props) {
  const d = dict.dashboard;
  const router = useRouter();
  const [collections, setCollections]   = useState<Collection[]>(initial);
  const [showCreate, setShowCreate]     = useState(false);

  function handleRefresh() {
    // Re-fetch the page to pick up DB changes
    router.refresh();
  }

  function handleCreated() {
    setShowCreate(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Header + CTA */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div /> {/* spacer — title rendered in page.tsx */}
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus size={15} />
            {d.collectionCreate}
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateCollectionForm
          dict={dict}
          onCreated={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* List */}
      {collections.length === 0 && !showCreate ? (
        <CollectionsEmpty dict={dict} />
      ) : (
        <div className="space-y-3">
          {collections.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              dict={dict}
              locale={locale}
              dashboardBase={dashboardBase}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
