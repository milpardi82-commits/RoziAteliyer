/**
 * Public Collection page — Server Component.
 *
 * Route: /[locale]/designs/collections/[id]
 *
 * Fetches the published collection and its public designs server-side.
 * Passes data to PublicCollectionClient for interactive rendering.
 *
 * Visibility rules:
 *   - status = 'published' AND is_public = true → accessible
 *   - status = 'draft' OR 'archived' → 404 (identical to "not found")
 *   - Designs inside the collection: only status='published' AND is_public=true
 *
 * Security:
 *   - Uses anon Supabase client; RLS enforces all visibility constraints.
 *   - creator_id is never accepted from client input.
 *   - No private fields (user_id, admin_note, storage_path) are returned.
 *   - Media: public CDN URLs only via batchGetDesignPublicMedia().
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n';
import { getPublicCollection } from '@/services/collection.service';
import { batchGetDesignPublicMedia } from '@/services/media-delivery.service';
import { PublicCollectionClient } from '@/features/collection/PublicCollectionClient';
import type { DesignPublicMedia } from '@/types/media';

interface Props {
  params: { locale: string; id: string };
}

// =============================================================================
// Metadata
// =============================================================================

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};

  const result = await getPublicCollection(params.id);
  if (!result) return {};

  const { collection, creator } = result;

  const title = creator
    ? `${collection.name} — ${creator.display_name} — Rozi Atelier`
    : `${collection.name} — Rozi Atelier`;

  const description = collection.description
    ?? (creator ? `A curated collection by ${creator.display_name}` : undefined);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(collection.cover_image_url
        ? { images: [collection.cover_image_url] }
        : {}),
    },
  };
}

// =============================================================================
// Page
// =============================================================================

export default async function PublicCollectionPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();

  // Fetch the published collection (returns null for draft/archived/missing).
  // Uses anon client → RLS read_published_collections enforces visibility.
  const result = await getPublicCollection(params.id);

  // If null: collection doesn't exist, is draft, or is archived.
  // Return standard 404 — do not leak whether the collection exists privately.
  if (!result) notFound();

  // Batch-fetch CDN media for all public designs in the collection.
  // Single round-trip — no N+1 queries.
  const designIds = result.designs.map((d) => d.id);
  const mediaBatch = await batchGetDesignPublicMedia(designIds);

  // Convert Map to plain object for serialization to Client Component.
  const mediaMap: Record<string, DesignPublicMedia> = {};
  mediaBatch.forEach((media, id) => {
    mediaMap[id] = media;
  });

  return <PublicCollectionClient result={result} mediaMap={mediaMap} />;
}
