'use client';

/**
 * DashboardCollectionDetail — designs within a single creator collection.
 *
 * Client Component: handles add/remove design mutations via fetch to the
 * /api/creator/collections/[id]/designs route handlers.
 *
 * Uses the existing dashboard visual language (consistent with DashboardDesignList).
 * The add-design workflow shows a dropdown of the creator's own eligible designs.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Loader2, X, FileEdit } from 'lucide-react';
import type { Collection, CollectionItem } from '@/types/design';
import type { CreatorDesignSummary } from '@/types/dashboard';
import type { Dictionary, Locale } from '@/lib/i18n';

interface Props {
  collection: Collection;
  items: CollectionItem[];
  /** Creator's own designs that can potentially be added */
  creatorDesigns: CreatorDesignSummary[];
  locale: Locale;
  dict: Dictionary;
}

// =============================================================================
// Add Design Panel
// =============================================================================

function AddDesignPanel({
  collectionId,
  existingDesignIds,
  creatorDesigns,
  dict,
  onAdded,
  onCancel,
}: {
  collectionId: string;
  existingDesignIds: Set<string>;
  creatorDesigns: CreatorDesignSummary[];
  dict: Dictionary;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const d = dict.dashboard;
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Only show designs not already in the collection
  const eligible = creatorDesigns.filter(
    (des) => !existingDesignIds.has(des.id) && des.status !== 'archived'
  );

  async function handleAdd() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/creator/collections/${collectionId}/designs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design_id: selectedId }),
      });
      if (!res.ok) {
        setError(d.collectionAddError);
        return;
      }
      onAdded();
    } catch {
      setError(d.collectionAddError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-background p-4">
      <p className="mb-3 text-sm font-semibold text-foreground">{d.collectionSelectDesign}</p>

      {eligible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{d.designsEmpty}</p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
          >
            <option value="">— {d.collectionSelectDesign} —</option>
            {eligible.map((des) => (
              <option key={des.id} value={des.id}>{des.title}</option>
            ))}
          </select>

          <button
            onClick={handleAdd}
            disabled={saving || !selectedId}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {d.collectionAddDesign}
          </button>

          <button
            onClick={onCancel}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:text-primary"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

// =============================================================================
// Design Item Row
// =============================================================================

function DesignItemRow({
  item,
  collectionId,
  dict,
  onRemoved,
}: {
  item: CollectionItem;
  collectionId: string;
  dict: Dictionary;
  onRemoved: () => void;
}) {
  const d = dict.dashboard;
  const [removing, setRemoving]       = useState(false);
  const [confirmDel, setConfirmDel]   = useState(false);

  const design = item.design;

  async function handleRemove() {
    if (!confirmDel) {
      setConfirmDel(true);
      setTimeout(() => setConfirmDel(false), 4000);
      return;
    }
    setRemoving(true);
    try {
      await fetch(`/api/creator/collections/${collectionId}/designs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design_id: item.design_id }),
      });
    } finally {
      setRemoving(false);
      setConfirmDel(false);
      onRemoved();
    }
  }

  return (
    <tr className="group border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      {/* Thumbnail + title */}
      <td className="py-3 pe-4 ps-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted">
            {design && (design.thumbnail_url || design.image_url) ? (
              <img
                src={design.thumbnail_url ?? design.image_url}
                alt={design.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-muted-foreground/40">
                <FileEdit size={14} />
              </div>
            )}
          </div>
          <p className="truncate text-sm font-medium text-foreground">
            {design?.title ?? item.design_id}
          </p>
        </div>
      </td>

      {/* Status */}
      <td className="py-3 pe-4 text-xs text-muted-foreground hidden sm:table-cell">
        {design?.status ?? '—'}
      </td>

      {/* Remove action */}
      <td className="py-3 pe-4 text-end">
        <button
          onClick={handleRemove}
          disabled={removing}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
            confirmDel
              ? 'border-destructive/50 bg-destructive/10 text-destructive'
              : 'border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive'
          }`}
        >
          {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          {d.collectionRemoveDesign}
        </button>
      </td>
    </tr>
  );
}

// =============================================================================
// Main component
// =============================================================================

export function DashboardCollectionDetail({ collection, items, creatorDesigns, locale: _locale, dict }: Props) {
  const d = dict.dashboard;
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);

  const existingIds = new Set(items.map((i) => i.design_id));

  function handleRefresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Add design control */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {collection.item_count} {d.collectionItemCount}
        </p>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus size={15} />
            {d.collectionAddDesign}
          </button>
        )}
      </div>

      {showAdd && (
        <AddDesignPanel
          collectionId={collection.id}
          existingDesignIds={existingIds}
          creatorDesigns={creatorDesigns}
          dict={dict}
          onAdded={() => { setShowAdd(false); handleRefresh(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Design list */}
      {items.length === 0 && !showAdd ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-[#f7f6f2] px-8 py-16 text-center">
          <p className="font-semibold text-foreground">{d.collectionDesignsEmpty}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-background">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-[#f7f6f2]">
                <th className="py-3 pe-4 ps-4 text-start text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  {d.colTitle}
                </th>
                <th className="py-3 pe-4 text-start text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground hidden sm:table-cell">
                  {d.colStatus}
                </th>
                <th className="py-3 pe-4 text-end text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  {d.colActions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {items.map((item) => (
                <DesignItemRow
                  key={item.id}
                  item={item}
                  collectionId={collection.id}
                  dict={dict}
                  onRemoved={handleRefresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
