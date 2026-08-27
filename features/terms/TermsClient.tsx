'use client';

/**
 * Terms & Privacy page — Client Component.
 * Presents Rozi Atelier's legal terms and privacy policy.
 */
import { Mail } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';

export function TermsClient() {
  const { dict } = useLocale();
  const t = dict.terms;

  const sections = [
    { title: t.section1Title, content: t.section1Content },
    { title: t.section2Title, content: t.section2Content },
    { title: t.section3Title, content: t.section3Content },
    { title: t.section4Title, content: t.section4Content },
    { title: t.section5Title, content: t.section5Content },
  ];

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      {/* ── Page header ── */}
      <section className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{t.pageBadge}</p>
          <h1 className="font-display text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-tight tracking-[-0.045em]">
            {t.pageTitle}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t.lastUpdated}: {t.lastUpdatedDate}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:grid lg:grid-cols-[1fr_2fr] lg:gap-16 lg:px-12 lg:py-24">

        {/* ── Sticky sidebar TOC ── */}
        <nav className="mb-10 lg:mb-0">
          <div className="sticky top-24 space-y-1">
            {sections.map(({ title }, i) => (
              <a
                key={i}
                href={`#section-${i + 1}`}
                className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {title}
              </a>
            ))}
          </div>
        </nav>

        {/* ── Content ── */}
        <div className="space-y-12">
          {sections.map(({ title, content }, i) => (
            <section key={i} id={`section-${i + 1}`}>
              <h2 className="font-display text-2xl font-medium tracking-[-0.04em]">{title}</h2>
              <p className="mt-4 text-[15px] leading-8 text-muted-foreground">{content}</p>
            </section>
          ))}

          {/* ── Contact ── */}
          <section className="rounded-2xl border border-border bg-[#f7f6f2] p-8">
            <h2 className="font-display text-xl font-medium">{t.contactTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.contactDesc}</p>
            <a
              href={`mailto:${t.contactEmail}`}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
            >
              <Mail size={15} />
              {t.contactEmail}
            </a>
          </section>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
