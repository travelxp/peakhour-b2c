import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getPublicCatalog, signupCta } from "@/lib/catalog";
import { PILLARS, PILLAR_ORDER, type PillarSlug } from "@/lib/pillars";

/**
 * Shared template for the five pillar marketing pages. Server component;
 * content comes from lib/pillars.ts and the signup CTA from the live platform
 * catalog (same resolver + fallback as the homepage), so the CTA can never
 * disagree with the signup flow. Polish is CSS-only.
 */
export async function PillarPage({ slug }: { slug: PillarSlug }) {
  const pillar = PILLARS[slug];
  const Icon = pillar.icon;

  const catalog = await getPublicCatalog();
  const cta = signupCta(catalog?.platform?.signupMode ?? "open");

  const others = PILLAR_ORDER.filter((s) => s !== slug).map((s) => PILLARS[s]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main>
        {/* Hero */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <nav
                aria-label="Breadcrumb"
                className="text-sm font-medium text-muted-foreground"
              >
                <ol className="flex items-center gap-1.5">
                  <li>
                    <Link href="/" className="transition-colors hover:text-brand">
                      Home
                    </Link>
                  </li>
                  <li aria-hidden className="opacity-40">
                    ›
                  </li>
                  <li aria-current="page" className="text-foreground">
                    {pillar.name}
                  </li>
                </ol>
              </nav>
              <span className="mt-5 inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                {pillar.eyebrow}
              </span>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-pretty sm:text-5xl">
                {pillar.headline}{" "}
                <span className="font-serif font-normal italic text-brand-gradient">
                  {pillar.accent}
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                {pillar.lede}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {!cta.disabled && (
                  <Link
                    href={cta.href}
                    className="group inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {cta.label}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
                <Link
                  href="/pricing"
                  className="inline-flex items-center rounded-xl border-2 px-6 py-3 text-sm font-bold transition-colors hover:border-brand hover:text-brand"
                >
                  See pricing
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                <span aria-hidden className="font-bold text-brand-label">
                  ✓
                </span>{" "}
                {pillar.freeLabel} — no credit card
              </p>
            </div>

            {/* "What you get back" — outcomes in a dark panel */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-6 text-zinc-100 shadow-2xl">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-gradient shadow-inner">
                  <Icon className="size-5 text-brand-contrast" strokeWidth={2} aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                    What you get back
                  </p>
                  <p className="text-lg font-bold">{pillar.name}</p>
                </div>
              </div>
              <ul className="mt-5 flex flex-col gap-3">
                {pillar.outcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-3 text-sm text-zinc-300">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                    {outcome}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* What it does — capabilities */}
        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                What it does
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                Everything the {pillar.name} pillar handles for you.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {pillar.features.map((feature) => (
                <div
                  key={feature.title}
                  className="flex flex-col gap-3 rounded-2xl border bg-background p-6 transition-all hover:-translate-y-1 hover:border-foreground hover:shadow-xl"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft">
                    <Check className="size-5 text-brand-ink" strokeWidth={2.5} aria-hidden />
                  </div>
                  <h3 className="text-base font-bold tracking-tight">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Part of the platform — cross-links to the other pillars */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                One platform, five pillars
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                {pillar.name} shares one brain with the rest.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Your catalog, your brand voice, your customers — every pillar
                learns from the same place. Add the others when you&rsquo;re ready.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((other) => {
                const OtherIcon = other.icon;
                return (
                  <Link
                    key={other.slug}
                    href={`/${other.slug}`}
                    className="group flex items-center gap-3 rounded-2xl border bg-background p-5 transition-all hover:-translate-y-1 hover:border-foreground hover:shadow-md"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient">
                      <OtherIcon className="size-5 text-brand-contrast" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="font-bold">{other.name}</span>
                    <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 px-6 py-16 text-center text-zinc-100 shadow-2xl">
              <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-pretty sm:text-4xl">
                Try {pillar.name}{" "}
                <span className="font-serif font-normal italic text-brand-gradient">
                  free.
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-zinc-400">
                {pillar.freeLabel} — no credit card. Your first Peaks are on us.
              </p>
              {!cta.disabled && (
                <Link
                  href={cta.href}
                  className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-7 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                >
                  {cta.label}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
