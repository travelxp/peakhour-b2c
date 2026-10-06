import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getPricing, findBundleTier, suiteCtaLabel } from "@/lib/pricing";
import { getPublicCatalog, publicMarketingIntegrations, signupCta } from "@/lib/catalog";
import { badgedComingSoonKeys } from "@/lib/pillar-channels";
import {
  PRICING_PILLAR_ORDER,
  pricingPillar,
  suiteModuleSlugs,
} from "@/lib/pricing-catalog";
import { pageMetadata } from "@/lib/seo";
import { SuiteCard } from "@/components/marketing/pricing/suite-card";
import { ChannelsStrip } from "@/components/marketing/pricing/channels-strip";
import { TeamsCtaBand } from "@/components/marketing/pricing/teams-cta";
import { PricingFaq } from "@/components/marketing/pricing/pricing-faq";

export const metadata = pageMetadata({
  title: "Pricing — Peakhour Suite, Agency and Enterprise",
  description:
    "Peakhour Suite is one plan for Commerce, Content, Growth, Support and Presence — one login, one Peaks wallet, one price. Every business starts with a free Suite trial, no card. Agency and Enterprise plans for teams.",
  path: "/pricing",
});

function countryFrom(header: string | null): string {
  return header && /^[A-Za-z]{2}$/.test(header) ? header.toUpperCase() : "DEFAULT";
}

/**
 * /pricing — the pricing hub. One catalog (billing plan D19): Peakhour Suite
 * for a business, Agency and Enterprise for teams (their own page, reached by
 * the band below). There is no free tier and there are no per-module plans: a
 * new business starts on a Suite trial, and when it ends buys Suite or Agency
 * to continue.
 *
 * ★THE PER-MODULE LADDER, THE FREE PRESENCE BAND AND THE FOUR PAID MODULE CARDS
 * WENT, with the per-module pricing pages they linked to (P4.7). Each one sold
 * a Free and a Pro tier the catalog no longer has.
 *
 * Prices, the trial length and which modules Suite includes are read from the
 * live pricing API (env-gated server-side); module identity and copy are static
 * (lib/pricing-catalog). Without a Suite in this environment's catalog the page
 * names no price and no trial rather than inventing either.
 */
export default async function PricingPage() {
  const h = await headers();
  const country = countryFrom(h.get("x-vercel-ip-country"));

  const [pricing, catalog] = await Promise.all([
    getPricing(country),
    getPublicCatalog(),
  ]);
  // Same rule the homepage runs — the channel strip below states connector
  // availability, so it has to answer from the same place the integrations
  // grid does.
  const published = catalog ? publicMarketingIntegrations(catalog.integrations) : [];
  const comingSoonKeys = badgedComingSoonKeys({
    published,
    all: catalog?.integrations ?? [],
  });
  const signupMode = catalog?.platform?.signupMode ?? "open";
  const openSignup = signupMode === "open";
  const cta = signupCta(signupMode);

  const suite = findBundleTier(pricing, "suite");
  // What Suite composes AND this site renders: the hero list and the card ask
  // the same question, so a module cannot read "Included" in one and be
  // missing from the other.
  const included = new Set(suiteModuleSlugs(pricing));
  const trialDays = suite?.pricing.trialDays ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                Pricing
              </span>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-pretty sm:text-5xl">
                Everything a business does online.
                <br />
                <span className="font-serif font-normal italic text-brand-gradient">
                  One plan.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                Commerce, Content, Growth, Support and Presence — five products,
                one login, one Peaks wallet, one price.
                {trialDays > 0
                  ? ` Every business starts with a free ${trialDays}-day trial of all of it.`
                  : ""}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {!cta.disabled && (
                  <Link
                    href={cta.href}
                    className="group inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {openSignup ? suiteCtaLabel(trialDays) : cta.label}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
                {suite && (
                  <Link
                    href="#suite"
                    className="inline-flex items-center rounded-xl border-2 px-6 py-3 text-sm font-bold transition-colors hover:border-brand hover:text-brand"
                  >
                    See what&rsquo;s included
                  </Link>
                )}
              </div>
              {/* No card: the signup trial collects none (D19). Only stated
                  when there is a trial to start. */}
              {trialDays > 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  <span aria-hidden className="font-bold text-brand-label">
                    ✓
                  </span>{" "}
                  No card to start · one Peaks wallet · cancel anytime
                </p>
              )}
            </div>

            {/* The five modules, in a dark panel: what one plan covers. No
                per-module price — there is no per-module plan to price (D19).
                Each row links to the module's own page. */}
            <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink p-3 text-on-ink shadow-2xl">
              <ul className="flex flex-col gap-1.5">
                {PRICING_PILLAR_ORDER.map((slug) => {
                  const pillar = pricingPillar(slug);
                  const Icon = pillar.icon;
                  const isIn = included.has(slug);
                  return (
                    <li key={slug}>
                      <Link
                        href={`/${slug}`}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 transition-colors hover:bg-white/5"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                          <Icon className="size-4" strokeWidth={2} aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">
                            {pillar.name}
                          </span>
                          <span className="block truncate text-xs text-on-ink-dim">
                            {pillar.promise}
                          </span>
                        </span>
                        {/* ★"Included" ONLY WHERE THE CATALOG SAYS SO
                            (`suiteModuleSlugs`); a module Suite does not
                            compose here reads "Soon", never a price. */}
                        <span
                          className={`ml-auto shrink-0 text-sm font-bold tabular-nums ${
                            isIn ? "text-success" : "text-on-ink-dim"
                          }`}
                          style={{ fontFamily: "var(--font-space-grotesk)" }}
                        >
                          {isIn ? "Included" : "Soon"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Peakhour Suite ───────────────────────────────────────────── */}
        {suite && (
          // ★`scroll-mt` BECAUSE THE HEADER IS `sticky top-0`: `/pricing/teams`
          // and the hero link to `#suite`, and without this they land with the
          // card's badge behind the header.
          <section id="suite" className="scroll-mt-20 pb-16 sm:pb-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <SuiteCard
                tier={suite}
                includedSlugs={[...included]}
                cta={cta}
                openSignup={openSignup}
              />
            </div>
          </section>
        )}

        {/* ── Agency / Enterprise ──────────────────────────────────────── */}
        <section className="pb-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <TeamsCtaBand />
          </div>
        </section>

        {/* ── Channels ─────────────────────────────────────────────────── */}
        <section className="pb-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rounded-3xl border bg-muted/30 p-8 sm:p-10">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                  <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                  Works where you already run
                </span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                  Bring Peakhour into your stack
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Your modules light up inside the tools you already use, each
                  one the moment it opens. Each card shows what runs there.
                </p>
              </div>
              <div className="mt-8">
                <ChannelsStrip comingSoonKeys={comingSoonKeys} />
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="pb-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="mb-8">
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                Good to know
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty">
                Questions, answered simply
              </h2>
            </div>
            <PricingFaq />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
