/**
 * Artist profile page — Server Component.
 *
 * Fetches creator + designs on the server. Passes to Client Component
 * for the interactive follow/favourite behaviour.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n';
import { getCreatorByHandle, getDesignsByCreator } from '@/services';
import { ArtistProfileClient } from '@/features/artist-profile/ArtistProfileClient';

interface Props {
  params: { locale: string; handle: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const creator = await getCreatorByHandle(params.handle);
  if (!creator) return {};
  return {
    title: `${creator.display_name} — Rozi Atelier`,
    description: creator.bio ?? `Surface design artist from ${creator.location}`,
  };
}

export default async function ArtistProfilePage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();

  const creator = await getCreatorByHandle(params.handle);
  if (!creator) notFound();

  const designs = await getDesignsByCreator(creator.id);

  return <ArtistProfileClient creator={creator} initialDesigns={designs} />;
}
