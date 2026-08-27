/**
 * Design detail page — Server Component.
 *
 * Fetches all data on the server. Passes it to a Client Component for
 * the interactive bits (favourite toggle, share button).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n';
import { getDesignBySlug, getDesignsByCreator } from '@/services';
import { getReviewsByDesign } from '@/services/review.service';
import { DesignDetailClient } from '@/features/design-detail/DesignDetailClient';

interface Props {
  params: { locale: string; slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const design = await getDesignBySlug(params.slug);
  if (!design) return {};
  return {
    title: `${design.title} — Rozi Atelier`,
    description: design.description ?? `Original surface design by ${design.creators?.display_name}`,
    openGraph: {
      images: [design.image_url],
    },
  };
}

export default async function DesignDetailPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();

  const design = await getDesignBySlug(params.slug);
  if (!design) notFound();

  const [reviews, moreDesigns] = await Promise.all([
    getReviewsByDesign(design.id),
    getDesignsByCreator(design.creator_id, design.id),
  ]);

  return (
    <DesignDetailClient
      design={design}
      reviews={reviews}
      moreDesigns={moreDesigns.slice(0, 4)}
    />
  );
}
