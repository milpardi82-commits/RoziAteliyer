/**
 * Creator Dashboard — Collection Detail page (Phase 12).
 *
 * Displays the designs within a single creator-owned collection.
 * Provides add/remove design controls.
 *
 * Route: /[locale]/creator/dashboard/collections/[id]
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { getServerUser } from '@/lib/auth';
import { getDashboardCreator, getCreatorDesignSummary } from '@/services/dashboard.service';
import { getCollectionWithItems } from '@/services/collection.service';
import { DashboardCollectionDetail } from '@/features/creator/dashboard/DashboardCollectionDetail';

interface Props {
  params: { locale: string; id: string };
}

export default async function DashboardCollectionDetailPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;
  const dict   = getDictionary(locale);

  // Auth guard
  const user = await getServerUser();
  if (!user) {
    redirect(`/${locale}/auth/login?next=/${locale}/creator/dashboard/collections`);
  }

  // Only approved creators
  const creator = await getDashboardCreator();
  if (!creator || creator.status !== 'approved') return null;

  // Fetch collection + items (RLS ensures this is the creator's own collection)
  const result = await getCollectionWithItems(params.id);
  if (!result) notFound();

  const { collection, items } = result;

  // Verify collection belongs to this creator (service layer + RLS handles this,
  // but add explicit check so we show 404 rather than empty data for wrong creator)
  if (collection.creator_id !== creator.id) notFound();

  // Fetch creator's own designs for the add-design panel (first 100, all statuses)
  const { designs: creatorDesigns } = await getCreatorDesignSummary(creator.id, {
    page: 1,
    pageSize: 100,
    statusFilter: 'all',
  });

  const dashboardBase = `/${locale}/creator/dashboard`;

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        href={`${dashboardBase}/collections`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {dict.dashboard.collectionBackToList}
      </Link>

      {/* Collection title */}
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
          {collection.name}
        </h2>
        {collection.description && (
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {collection.description}
          </p>
        )}
      </div>

      <DashboardCollectionDetail
        collection={collection}
        items={items}
        creatorDesigns={creatorDesigns}
        locale={locale}
        dict={dict}
      />
    </div>
  );
}
