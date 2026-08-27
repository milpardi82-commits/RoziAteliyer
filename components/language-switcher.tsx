'use client';

import { Globe } from 'lucide-react';
import { useLocale } from '@/components/locale-provider';
import type { Locale } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { locale, switchLocale } = useLocale();
  const target: Locale = locale === 'fa' ? 'en' : 'fa';

  return (
    <button
      onClick={() => switchLocale(target)}
      className="flex items-center gap-1.5 rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={locale === 'fa' ? 'Switch to English' : 'تغییر به فارسی'}
    >
      <Globe size={19} />
      <span className="text-[13px] font-medium">
        {locale === 'fa' ? 'EN' : 'فا'}
      </span>
    </button>
  );
}
