/**
 * Dashboard Navigation — sub-navigation tabs for the creator dashboard.
 *
 * Client Component: handles active tab state and navigation.
 * Uses the existing design system (Tailwind, existing color tokens).
 * RTL-aware via useLocale.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, ImageIcon, FolderOpen, User } from 'lucide-react';
import { useLocale } from '@/components/locale-provider';
import type { DashboardSection } from '@/types/dashboard';

interface NavItem {
  section: DashboardSection;
  href: string;
  icon: React.ElementType;
  label: string;
}

interface Props {
  locale: string;
}

export function DashboardNav({ locale }: Props) {
  const { dict } = useLocale();
  const pathname  = usePathname();
  const base      = `/${locale}/creator/dashboard`;
  const d         = dict.dashboard;

  const items: NavItem[] = [
    { section: 'overview',    href: base,                  icon: BarChart2,  label: d.overview },
    { section: 'designs',     href: `${base}/designs`,     icon: ImageIcon,  label: d.myDesigns },
    { section: 'collections', href: `${base}/collections`, icon: FolderOpen, label: d.collections },
    { section: 'profile',     href: `${base}/profile`,     icon: User,       label: d.profile },
  ];

  return (
    <nav className="flex gap-1 border-b border-border">
      {items.map(({ section, href, icon: Icon, label }) => {
        // Active if pathname exactly matches or starts with the sub-path
        const isActive =
          section === 'overview'
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(href);

        return (
          <Link
            key={section}
            href={href}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
