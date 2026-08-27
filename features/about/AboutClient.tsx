'use client';

/**
 * About page — Client Component.
 * Presents Rozi Atelier's story, mission, values, and creator CTA.
 */
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Globe, Heart, Leaf, Star, Users } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-nav';
import { useLocale } from '@/components/locale-provider';

export function AboutClient() {
  const { locale, dict, isRTL } = useLocale();
  const base = `/${locale}`;
  const a = dict.about;

  const values = [
    { title: a.value1Title, desc: a.value1Desc, icon: Star },
    { title: a.value2Title, desc: a.value2Desc, icon: Heart },
    { title: a.value3Title, desc: a.value3Desc, icon: Globe },
    { title: a.value4Title, desc: a.value4Desc, icon: CheckCircle2 },
  ];

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      {/* ── Page header ── */}
      <section className="border-b border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{a.pageBadge}</p>
          <h1 className="font-display text-[clamp(2.8rem,6vw,5rem)] font-medium leading-tight tracking-[-0.045em]">
            {a.pageTitle}
          </h1>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:grid lg:grid-cols-2 lg:gap-16 lg:px-12 lg:py-28">
        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{a.missionBadge}</p>
          <h2 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{a.missionTitle}</h2>
          <p className="mt-6 text-base leading-8 text-muted-foreground">{a.missionDesc}</p>
        </div>
        <div className="mt-12 overflow-hidden rounded-2xl lg:mt-0">
          <img
            src="https://images.pexels.com/photos/5117322/pexels-photo-5117322.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop"
            alt={a.missionTitle}
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      {/* ── Story ── */}
      <section className="border-y border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-3xl">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{a.storyBadge}</p>
            <h2 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{a.storyTitle}</h2>
            <div className="mt-8 space-y-5 text-base leading-8 text-muted-foreground">
              <p>{a.storyP1}</p>
              <p>{a.storyP2}</p>
              <p>{a.storyP3}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{a.valuesBadge}</p>
        <h2 className="mb-12 font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{a.valuesTitle}</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map(({ title, desc, icon: Icon }) => (
            <div key={title} className="rounded-2xl border border-border bg-[#f7f6f2] p-6">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon size={20} />
              </div>
              <h3 className="mb-2 text-[15px] font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Team ── */}
      <section className="border-t border-border/60 bg-[#f2efe8]">
        <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{a.teamBadge}</p>
          <h2 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{a.teamTitle}</h2>
          <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground">{a.teamDesc}</p>
          <div className="mt-12 grid gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { name: 'Elena Marchetti', role: isRTL ? 'مدیر هنری' : 'Art Director', handle: 'elena-marchetti', img: 'https://images.pexels.com/photos/5393535/pexels-photo-5393535.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop' },
              { name: 'Kenji Watanabe', role: isRTL ? 'طراح ارشد' : 'Lead Designer', handle: 'kenji-watanabe', img: 'https://images.pexels.com/photos/6925033/pexels-photo-6925033.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop' },
              { name: 'Amara Okafor', role: isRTL ? 'مدیر جامعه' : 'Community Lead', handle: 'amara-okafor', img: 'https://images.pexels.com/photos/8036823/pexels-photo-8036823.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop' },
              { name: 'Isabella Costa', role: isRTL ? 'مدیر محصول' : 'Product Manager', handle: 'isabella-costa', img: 'https://images.pexels.com/photos/22690802/pexels-photo-22690802.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop' },
            ].map(({ name, role, handle, img }) => (
              <Link key={handle} href={`${base}/artists/${handle}`} className="group rounded-2xl bg-background p-5 transition-shadow hover:shadow-md">
                <div className="mb-4 aspect-square overflow-hidden rounded-xl bg-muted">
                  <img src={img} alt={name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <p className="font-semibold">{name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{role}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Join CTA ── */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground/70">{a.joinBadge}</p>
          <h2 className="font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">{a.joinTitle}</h2>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-primary-foreground/75">{a.joinDesc}</p>
          <Link
            href={`${base}/become-creator`}
            className="group mt-8 inline-flex items-center gap-3 rounded-full bg-background px-6 py-3.5 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5"
          >
            {a.joinCta}
            {isRTL
              ? <ArrowRight size={16} className="transition-transform group-hover:-translate-x-1 rotate-180" />
              : <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            }
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
