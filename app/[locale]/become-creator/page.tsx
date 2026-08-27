import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { getServerUser } from '@/lib/auth';
import { getMyCreatorApplication, getCreatorByUserId } from '@/services/creator.service';
import { BecomeCreatorClient } from '@/features/creator/BecomeCreatorClient';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!locales.includes(params.locale as Locale)) return {};
  const dict = getDictionary(params.locale as Locale);
  return {
    title: `${dict.creator.pageTitle} — ${dict.brandName}`,
    description: dict.creator.subheadline,
  };
}

/**
 * Become a Creator page — Server Component.
 *
 * Resolves three states before rendering:
 * 1. Not logged in → unauthenticated state (show login CTA)
 * 2. Already a creator → show link to their public profile
 * 3. Has a pending application → show waiting state
 * 4. No application → show the application form
 *
 * The Client Component handles form submission and UI transitions.
 */
export default async function BecomeCreatorPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;

  const user = await getServerUser();

  // Fetch creator status and existing application in parallel (only if authenticated)
  const [creator, application] = user
    ? await Promise.all([
        getCreatorByUserId(user.id, false), // approved creators only
        getMyCreatorApplication(),
      ])
    : [null, null];

  return (
    <BecomeCreatorClient
      locale={locale}
      user={user ? { id: user.id, email: user.email ?? null } : null}
      existingCreator={creator}
      existingApplication={application}
    />
  );
}
