'use client';

/**
 * Support page — Client Component.
 * Presents FAQ and contact information for Rozi Atelier support.
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';

export function SupportClient() {
  const { dict } = useLocale();
  const s = dict.support;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { q: s.faq1Q, a: s.faq1A },
    { q: s.faq2Q, a: s.faq2A },
    { q: s.faq3Q, a: s.faq3A },
    { q: s.faq4Q, a: s.faq4A },
    { q: s.faq5Q, a: s.faq5A },
  ];

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      {/* ── Page header ── */}
      <section className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{s.pageBadge}</p>
          <h1 className="font-display text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-tight tracking-[-0.045em]">
            {s.pageTitle}
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">{s.pageDesc}</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="grid gap-16 lg:grid-cols-[1.5fr_1fr] lg:gap-20">

          {/* ── FAQ ── */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{s.faqBadge}</p>
            <h2 className="mb-8 font-display text-3xl font-medium tracking-[-0.04em]">{s.faqTitle}</h2>
            <div className="space-y-2">
              {faqs.map(({ q, a }, i) => (
                <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    <span>{q}</span>
                    {openIndex === i
                      ? <ChevronUp size={16} className="shrink-0 text-muted-foreground" />
                      : <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
                    }
                  </button>
                  {openIndex === i && (
                    <div className="border-t border-border/60 px-5 pb-5 pt-4">
                      <p className="text-sm leading-7 text-muted-foreground">{a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Contact ── */}
          <div className="self-start rounded-2xl border border-border bg-[#f7f6f2] p-8">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{s.contactBadge}</p>
            <h2 className="font-display text-2xl font-medium tracking-[-0.04em]">{s.contactTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{s.contactDesc}</p>

            <a
              href={`mailto:${s.contactEmail}`}
              className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
            >
              <Mail size={16} className="text-muted-foreground" />
              {s.contactEmail}
            </a>

            <a
              href={`mailto:${s.contactEmail}`}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {s.contactCta}
            </a>
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
