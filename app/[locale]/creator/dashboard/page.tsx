/**
 * Creator Dashboard — Overview page (default tab).
 *
 * Fetches all dashboard data in a single server call.
 * Renders the stats overview and a preview of the most recent designs.
 *
 * Route: /[locale]/creator/dashboard
 */
import { notFound, redirect } from 'next/navigation';
import { locales, type Locale, getDictionary } from '@/lib/i18n';
import { getServerUser } from '@/lib/auth';
import { getCreatorDashboardData } from '@/services/dashboard.service';
import { DashboardOverview } from '@/features/creator/dashboard/DashboardOverview';
import { DashboardDesignList } from '@/features/creator/dashboard/DashboardDesignList';

interface Props {
  params: { locale: string };
}

export default async function DashboardOverviewPage({ params }: Props) {
  if (!locales.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;
  const dict   = getDictionary(locale);

  // Auth guard (belt-and-suspenders after middleware + layout)
  const user = await getServerUser();
  if (!user) {
    redirect(`/${locale}/auth/login?next=/${locale}/creator/dashboard`);
  }

  // Fetch all dashboard data: creator + stats + first page of designs
  const data = await getCreatorDashboardData({ page: 1, pageSize: 5 });

  // If no data, the layout's gate will handle the not-creator state.
  // Here we simply render nothing if somehow data is missing after layout's gate.
  if (!data) return null;

  const base = `/${locale}`;

  return (
    <div className="space-y-10">
      {/* Stats overview */}
      <DashboardOverview
        creator={data.creator}
        stats={data.stats}
        locale={locale}
        dict={dict}
      />

      {/* Recent designs preview (first 5) */}
      <div>
        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {dict.dashboard.myDesigns}
        </h3>
        <DashboardDesignList
          designs={data.designs}
          total={data.designs_total}
          hasMore={data.designs_has_more}
          page={1}
          locale={locale}
          dict={dict}
          base={base}
        />
      </div>
    </div>
  );
}
