/**
 * Creator Dashboard — My Designs page.
 *
 * Paginated, filterable list of the authenticated creator's own designs.
 * All filtering and pagination happens server-side.
 *
 * Route: /[locale]/creator/dashboard/designs?page=N&status=X
 */
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { getServerUser } from '@/lib/auth';
import { getDashboardCreator, getCreatorDesignSummary } from '@/services/dashboard.service';
import { DashboardDesignList } from '@/features/creator/dashboard/DashboardDesignList';
import type { DesignStatus } from '@/types/design';

interface Props {
  params:      { locale: string };
  searchParams: { page?: string; status?: string };
}

export default async function DashboardDesignsPage({ params, searchParams }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;
  const dict   = getDictionary(locale);

  // Auth guard
  const user = await getServerUser();
  if (!user) {
    redirect(`/${locale}/auth/login?next=/${locale}/creator/dashboard/designs`);
  }

  // Resolve creator (only approved creators can see this page content)
  const creator = await getDashboardCreator();
  if (!creator || creator.status !== 'approved') return null;

  // Parse search params safely
  const page    = Math.max(1, parseInt(searchParams.page  ?? '1', 10) || 1);
  const rawStatus = searchParams.status as DesignStatus | 'all' | undefined;
  const validStatuses: (DesignStatus | 'all')[] = [
    'all', 'draft', 'pending_review', 'approved', 'published', 'archived',
  ];
  const statusFilter = rawStatus && validStatuses.includes(rawStatus) ? rawStatus : 'all';

  const { designs, total, hasMore } = await getCreatorDesignSummary(creator.id, {
    page,
    pageSize: 20,
    statusFilter,
  });

  const base = `/${locale}`;

  return (
    <div className="space-y-6">
      {/* Page header + CTA */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
          {dict.dashboard.myDesigns}
        </h2>
        <Link
          href={`${base}/creator/dashboard/designs/new`}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus size={15} />
          {dict.dashboard.designEditor.newDesignCta}
        </Link>
      </div>
      <DashboardDesignList
        designs={designs}
        total={total}
        hasMore={hasMore}
        page={page}
        locale={locale}
        dict={dict}
        base={base}
      />
    </div>
  );
}
