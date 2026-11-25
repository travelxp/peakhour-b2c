import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { CtaBand } from "@/components/marketing/seo/cta-band";
import { Section } from "@/components/marketing/seo/section";
import { cardCls, eyebrowCls, ghostBtn, h2Cls, primaryBtn, wrap } from "@/components/marketing/seo/styles";
import { getPricing, findBundleTier, hasCountryOverride, moduleBadge, PRICE_AT_SIGNUP, resolveCountry, suiteCtaLabel, suiteTrialDays } from "@/lib/pricing";
import { getPublicCatalog, publicMarketingIntegrations, signupCta } from "@/lib/catalog";
import { pricingHeroTrial, trialStart } from "@/lib/trial-copy";
import { badgedComingSoonKeys } from "@/lib/pillar-channels";
import {
  PRICING_PILLAR_ORDER,
  pricingPillar,
  suiteModuleSlugs,
} from "@/lib/pricing-catalog";
import { pageMeta } from "@/lib/seo/metadata";
import { pathFor } from "@/lib/seo/resolve";
import { Breadcrumbs } from "@/components/marketing/seo/breadcrumbs";
import { ContextualLinks } from "@/components/marketing/seo/contextual-links";
import { SuiteCard } from "@/components/marketing/pricing/suite-card";
import { ChannelsStrip } from "@/components/marketing/pricing/channels-strip";
import { PricingFaq } from "@/components/marketing/pricing/pricing-faq";

export const metadata = pageMeta("pricing");

/**
 * /pricing — the pricing hub. One catalog (billing plan D19): Peakhour Suite
 * for a business, Agency and Enterprise for teams (their own page, reached by
 * the band below). There is no free tier and there are no per-module plans: a
 * new account's first business starts on a Suite trial, once per person
 * (P3.1d), and when it ends buys Suite or Agency to continue; every other
 * business pays first.
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
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string | string[] }>;
}) {
  const h = await headers();
  const query = (await searchParams).country;
  // ★ONE RESOLUTION, SHARED WITH /shopify: a chosen country (?country=XX), else
  // the edge geo header. Both pages call this, so one visitor is never quoted
  // two currencies.
  const country = resolveCountry(query, h.get("x-vercel-ip-country"));
  const carried = hasCountryOverride(query) ? country : null;

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
  const knownMode = catalog?.platform?.signupMode;
  const signupMode = knownMode ?? "open";
  const trialWhen = trialStart(knownMode, suiteTrialDays(pricing));
  const openSignup = signupMode === "open";
  const cta = signupCta(signupMode, suiteTrialDays(pricing));

  const suite = findBundleTier(pricing, "suite");
  // What Suite composes AND this site renders: the hero list and the card ask
  // the same question, so a module cannot read "Included" in one and be
  // missing from the other.
  const included = new Set(suiteModuleSlugs(pricing));
  // The one trial rule /auth reads too (`suiteTrialDays`): no trial, no promise.
  const trialDays = suiteTrialDays(pricing) ?? 0;
  const heroTrial = pricingHeroTrial(trialDays, knownMode);

  return (
    <div className="flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <Header />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="bg-[linear-gradient(180deg,var(--daylight-hero)_0%,var(--background)_92%)]">
          <div className={`${wrap} grid items-center gap-8 py-8 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-16`}>
            <div className="min-w-0">
              <Breadcrumbs
                crumbs={[
                  { label: "Home", href: pathFor("home") },
                  { label: "Pricing", href: pathFor("pricing") },
                ]}
              />
              <p className={`${eyebrowCls} mt-5`}>Pricing</p>
              <h1 className="mt-3 text-[2.2rem] font-black leading-[1.04] tracking-[-0.04em] text-balance sm:text-5xl lg:text-[3.5rem]">
                One plan for everything{" "}
                <span className="daylight-mark whitespace-nowrap">Peakhour does.</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg text-foreground/80 sm:text-xl">
                Peakhour Suite covers Commerce, Content, Growth, Support and
                Presence for one business, with one login and one Peaks wallet.
                Running many businesses? Agency and Enterprise are for you.
                {heroTrial ? ` ${heroTrial}` : null}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {!cta.disabled && (
                  <Link href={cta.href} className={primaryBtn}>
                    {openSignup ? suiteCtaLabel(trialDays) : cta.label}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
                  </Link>
                )}
                {suite && (
                  <Link href="#suite" className={ghostBtn}>
                    See what&rsquo;s included
                  </Link>
                )}
              </div>
              {/* No card: the signup trial collects none (D19). Only stated
                  when there is a trial to start. */}
              {trialWhen !== "none" && (
                <p className="mt-4 text-sm text-muted-foreground">
                  <span aria-hidden className="font-bold text-brand-strong">
                    ✓
                  </span>{" "}
                  {trialWhen === "now" ? "No card to start · one Peaks wallet · cancel anytime" : "No card for the trial · one Peaks wallet · cancel anytime"}
                </p>
              )}
            </div>

            {/* What one plan covers. No per-module price,
                there is no per-module plan to price (D19). Each row links to
                the module's own page. */}
            <div className={`${cardCls} min-w-0 p-2 shadow-[var(--daylight-shadow)] sm:p-3`}>
              <ul className="flex flex-col">
                {PRICING_PILLAR_ORDER.map((slug) => {
                  const pillar = pricingPillar(slug);
                  const Icon = pillar.icon;
                  const isIn = included.has(slug);
                  const badge = moduleBadge(Boolean(suite), isIn);
                  return (
                    <li key={slug}>
                      <Link
                        href={`/${slug}`}
                        className="flex items-start gap-3.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 sm:py-3"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                          <Icon className="size-4" strokeWidth={2} aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">
                            {pillar.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {pillar.promise}
                          </span>
                        </span>
                        {/* ★"Included" ONLY WHERE THE CATALOG SAYS SO
                            (`suiteModuleSlugs`); a module Suite does not
                            compose here reads "Soon", never a price. With no
                            Suite at all (an outage, or an env with no
                            pricing) the catalog has said nothing about any
                            module, so no badge: "Soon" on a live product is
                            false. */}
                        {badge && (
                          <span
                            className={`ml-auto shrink-0 pt-0.5 text-sm font-bold tabular-nums ${
                              isIn ? "text-[color:var(--daylight-ok)]" : "text-muted-foreground"
                            }`}
                            style={{ fontFamily: "var(--font-space-grotesk)" }}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {!suite && (
                <p className="px-3 pb-2 pt-3 text-xs text-muted-foreground sm:px-4">
                  {PRICE_AT_SIGNUP}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Peakhour Suite ───────────────────────────────────────────── */}
        {suite && (
          // ★`scroll-mt` BECAUSE THE HEADER IS `sticky top-0`: `/pricing/teams`
          // and the hero link to `#suite`, and without this they land with the
          // card's badge behind the header.
          <section id="suite" className="scroll-mt-20 py-8 sm:py-12">
            <div className={wrap}>
              <SuiteCard
                tier={suite}
                includedSlugs={[...included]}
                cta={cta}
                openSignup={openSignup}
                trialWhen={trialWhen}
                country={country}
                scopeAction="/pricing#suite"
              />
            </div>
          </section>
        )}

        {/* ── Agency / Enterprise ──────────────────────────────────────── */}
        <div className="pt-4 sm:pt-6">
          <CtaBand
            headline="Running many businesses?"
            body="Agency and Enterprise give each client business every module, with volume Peaks, one unit per client and central billing."
            primary={{ label: "See Agency and Enterprise plans", href: "/pricing/teams" }}
          />
        </div>

        {/* ── Channels ─────────────────────────────────────────────────── */}
        <Section
          id="channels"
          tone="muted"
          eyebrow="Where it runs"
          title="Use Peakhour where you already work"
          intro="Each card shows what runs in that tool, and whether it is live yet."
        >
          <ChannelsStrip comingSoonKeys={comingSoonKeys} country={carried} />
        </Section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section id="faq" aria-labelledby="faq-h" className="scroll-mt-20 py-12 sm:py-16">
          <div className={`${wrap} grid grid-cols-1 gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14`}>
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className={eyebrowCls}>Good to know</p>
              <h2 id="faq-h" className={h2Cls}>
                Questions merchants ask first
              </h2>
            </div>
            <div className="min-w-0 border-t-2 border-foreground">
              <PricingFaq trialDays={trialDays} signupMode={knownMode} />
            </div>
          </div>
        </section>

        {/* ── Related ──────────────────────────────────────────────────── */}
        <section aria-labelledby="related-h" className="pb-12 sm:pb-16">
          <div className={wrap}>
            <h2 id="related-h" className="text-2xl font-extrabold tracking-tight">
              Keep reading
            </h2>
            <ContextualLinks
              className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              links={[
                { label: "Peaks, what pays for the AI work", href: pathFor("peaks"), note: "What Peaks pay for, and how top-ups work." },
                { label: "Agency and Enterprise plans", href: pathFor("pricing.teams"), note: "Many businesses under one account." },
                { label: "Peakhour for Shopify", href: pathFor("shopify"), note: "Install it and be billed through Shopify." },
                { label: "How Peakhour works", href: pathFor("how.it.works"), note: "Connect, approve, then let it run." },
              ]}
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
