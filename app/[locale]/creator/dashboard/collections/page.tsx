/**
 * Creator Dashboard — Collections page (Phase 12).
 *
 * Replaces the Phase 6 placeholder with a functional collection list.
 * Server Component: data fetched server-side; mutations handled client-side
 * via route handlers and router.refresh().
 *
 * Route: /[locale]/creator/dashboard/collections
 */
import { notFound, redirect } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { getServerUser } from '@/lib/auth';
import { getDashboardCreator } from '@/services/dashboard.service';
import { getMyCollections } from '@/services/collection.service';
import { DashboardCollectionList } from '@/features/creator/dashboard/DashboardCollectionList';

interface Props {
  params: { locale: string };
}

export default async function DashboardCollectionsPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;
  const dict   = getDictionary(locale);

  // Auth guard
  const user = await getServerUser();
  if (!user) {
    redirect(`/${locale}/auth/login?next=/${locale}/creator/dashboard/collections`);
  }

  // Only approved creators can access collection management
  const creator = await getDashboardCreator();
  if (!creator || creator.status !== 'approved') return null;

  // Fetch the creator's collections server-side
  const collections = await getMyCollections();

  const dashboardBase = `/${locale}/creator/dashboard`;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
        {dict.dashboard.collections}
      </h2>
      <DashboardCollectionList
        collections={collections}
        locale={locale}
        dict={dict}
        dashboardBase={dashboardBase}
      />
    </div>
  );
}
