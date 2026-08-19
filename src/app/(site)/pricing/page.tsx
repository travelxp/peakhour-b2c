import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import {
  getPricing,
  pillarProducts,
  fromMonthly,
  formatMonthly,
  formatPeaks,
  freeTier,
  findBundleTier,
} from "@/lib/pricing";
import { getPublicCatalog, publicMarketingIntegrations, signupCta } from "@/lib/catalog";
import { badgedComingSoonKeys } from "@/lib/pillar-channels";
import {
  PRICING_PILLAR_ORDER,
  PAID_PILLAR_ORDER,
  pricingPillar,
} from "@/lib/pricing-catalog";
import { PILLARS } from "@/lib/pillars";
import { pageMetadata } from "@/lib/seo";
import { PillarPriceCard } from "@/components/marketing/pricing/pillar-price-card";
import { SuiteCard } from "@/components/marketing/pricing/suite-card";
import { ChannelsStrip } from "@/components/marketing/pricing/channels-strip";
import { TeamsCtaBand } from "@/components/marketing/pricing/teams-cta";
import { PricingFaq } from "@/components/marketing/pricing/pricing-faq";

export const metadata = pageMetadata({
  title: "Pricing — one plan, five modules",
  description:
    "Peakhour Suite is one plan for Commerce, Content, Growth, Support and Presence — one login, one Peaks wallet, one price. Every module has a free tier. Agency and Enterprise plans for teams.",
  path: "/pricing",
});

function countryFrom(header: string | null): string {
  return header && /^[A-Za-z]{2}$/.test(header) ? header.toUpperCase() : "DEFAULT";
}

/**
 * /pricing — the pricing hub. A free-first value ladder: the free Presence
 * pillar leads as the on-ramp, then the four paid pillars follow as cards, each
 * linking to its own comparison page. Bundle plans (Agency/Enterprise) live on
 * their own page, reached by the CTA band — never mixed into a pillar's table.
 *
 * Prices, tiers and availability are read from the live pricing API (env-gated
 * server-side); pillar identity + copy are static (lib/pricing-catalog). The
 * page degrades gracefully per pillar — a prod-hidden product shows "Coming
 * soon" and links to its waitlist view rather than vanishing.
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

  const presence = pillarProducts(pricing, "presence")[0];
  const presenceFree = presence ? freeTier(presence) : undefined;
  /**
   * Peakhour Suite — the one plan that sells all five modules.
   *
   * Absent until the catalog seeds it (migration 258), and the page has to read
   * correctly either way: with a Suite it leads with the Suite, without one it
   * falls back to the per-module ladder this page has always shown. Nothing
   * here invents a price for a plan the environment does not serve.
   */
  const suite = findBundleTier(pricing, "suite");

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
                {suite ? (
                  <>
                    Everything a business does online.
                    <br />
                    <span className="font-serif font-normal italic text-brand-gradient">
                      One plan.
                    </span>
                  </>
                ) : (
                  <>
                    Get found for free.
                    <br />
                    Then grow,{" "}
                    <span className="font-serif font-normal italic text-brand-gradient">
                      one module at a time.
                    </span>
                  </>
                )}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                {suite
                  ? "Commerce, Content, Growth, Support and Presence — five products, one login, one Peaks wallet, one price. Start free and upgrade when you outgrow it."
                  : "Five products, one login. Start free, add what you need, and pay only for the modules you switch on."}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {!cta.disabled && (
                  <Link
                    href={cta.href}
                    className="group inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {openSignup ? "Start free with Presence" : cta.label}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
                <Link
                  href={suite ? "#suite" : "#pillars"}
                  className="inline-flex items-center rounded-xl border-2 px-6 py-3 text-sm font-bold transition-colors hover:border-brand hover:text-brand"
                >
                  {suite ? "See what's included" : "See all modules"}
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                <span aria-hidden className="font-bold text-brand-label">
                  ✓
                </span>{" "}
                No card to start · one Peaks wallet · cancel anytime
              </p>
            </div>

            {/* The five modules, in a dark panel. With a Suite on sale the
                right-hand column stops being a price list — every module is
                included, and quoting five separate prices beside a single-price
                headline is the contradiction the Suite exists to remove. */}
            <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink p-3 text-on-ink shadow-2xl">
              <ul className="flex flex-col gap-1.5">
                {PRICING_PILLAR_ORDER.map((slug) => {
                  const pillar = pricingPillar(slug);
                  const Icon = pillar.icon;
                  const product = pillarProducts(pricing, slug)[0];
                  const paid = product ? fromMonthly(product) : null;
                  const hasFree = !!(product && freeTier(product));
                  const price = !product
                    ? slug === "presence"
                      ? "Free"
                      : "Soon"
                    : paid
                      ? formatMonthly(paid.pricing)
                      : hasFree
                        ? "Free"
                        : "Soon";
                  const isFree = price === "Free";
                  // `suite` is resolved above; when it exists every module is in it.
                  const included = Boolean(suite);
                  return (
                    <li key={slug}>
                      <Link
                        href={`/pricing/${slug}`}
                        className={`flex items-center gap-3.5 rounded-xl px-4 py-3 transition-colors ${
                          slug === "presence"
                            ? "bg-brand-gradient text-brand-contrast"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                            slug === "presence"
                              ? "bg-white/25"
                              : "bg-white/10"
                          }`}
                        >
                          <Icon className="size-4" strokeWidth={2} aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">
                            {pillar.name}
                          </span>
                          <span
                            className={`block truncate text-xs ${
                              slug === "presence"
                                ? "text-brand-contrast/70"
                                : "text-on-ink-dim"
                            }`}
                          >
                            {pillar.promise}
                          </span>
                        </span>
                        <span
                          className={`ml-auto shrink-0 text-sm font-bold tabular-nums ${
                            slug === "presence" ? "" : included || isFree ? "text-success" : "text-brand"
                          }`}
                          style={{ fontFamily: "var(--font-space-grotesk)" }}
                        >
                          {included ? "Included" : price}
                          {!included && paid && (
                            <span className="text-[10px] font-medium opacity-70">
                              /mo
                            </span>
                          )}
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
          <section id="suite" className="pb-16 sm:pb-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <SuiteCard tier={suite} cta={cta} openSignup={openSignup} />
            </div>
          </section>
        )}

        {/* ── Free module band (Presence) ──────────────────────────────── */}
        <section id="pillars" className="scroll-mt-20 pb-4">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl border border-brand/30 bg-brand-soft/50 shadow-sm dark:bg-brand/5">
              <span
                className="absolute inset-y-0 left-0 w-1.5 bg-brand-gradient"
                aria-hidden
              />
              <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1.35fr_1fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center rounded-full bg-brand-gradient px-3 py-1 text-xs font-bold text-brand-contrast">
                      Start here
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success-on-tint">
                      <span className="size-1.5 rounded-full bg-success" aria-hidden />
                      Free forever
                    </span>
                  </div>
                  <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-brand-ink dark:text-foreground">
                    Presence
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-brand-ink/80 dark:text-muted-foreground">
                    {PILLARS.presence.lede}
                  </p>
                  <div
                    className="mt-5 text-4xl font-extrabold text-brand-ink dark:text-foreground"
                    style={{ fontFamily: "var(--font-space-grotesk)" }}
                  >
                    $0
                    <span className="ml-2 align-middle text-sm font-medium text-brand-ink/70 dark:text-muted-foreground">
                      / forever
                    </span>
                  </div>
                  <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    {[
                      ...PILLARS.presence.features.map((f) => f.title),
                      ...(typeof presenceFree?.peaksIncluded === "number"
                        ? [
                            `${formatPeaks(presenceFree.peaksIncluded)} AI credits (Peaks) each month`,
                          ]
                        : []),
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-sm text-brand-ink dark:text-foreground"
                      >
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-brand-strong"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col justify-center gap-3 rounded-2xl border border-brand/30 bg-background p-6 shadow-sm">
                  <p className="font-serif text-lg font-semibold">
                    Claim your business in 2 minutes
                  </p>
                  <p className="text-sm text-muted-foreground">
                    No credit card, ever. Upgrade to Peakhour Suite only when
                    you&rsquo;re ready.
                  </p>
                  {!cta.disabled && (
                    <Link
                      href={cta.href}
                      className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      {openSignup ? "Start free" : cta.label}
                    </Link>
                  )}
                  <Link
                    href="/pricing/presence"
                    className="inline-flex items-center justify-center rounded-xl border-2 px-5 py-2.5 text-sm font-bold transition-colors hover:border-brand hover:text-brand"
                  >
                    See what&rsquo;s included
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Paid pillars ─────────────────────────────────────────────── */}
        <section className="py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                  <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                  Add as you grow
                </span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                  Four more modules, each with a free tier
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Every module has a free tier to try. One plan — Peakhour
                  Suite — turns all five on together, so there is nothing to
                  assemble and no per-module maths.
                </p>
              </div>
              <p className="shrink-0 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Prices localized at checkout
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {PAID_PILLAR_ORDER.map((slug) => (
                <PillarPriceCard
                  key={slug}
                  slug={slug}
                  product={pillarProducts(pricing, slug)[0]}
                  comingSoonKeys={comingSoonKeys}
                />
              ))}
            </div>
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
                  Your pillars light up inside the tools you already use, each
                  one the moment it opens. Each card shows what runs there.
                </p>
              </div>
              <div className="mt-8">
                <ChannelsStrip comingSoonKeys={comingSoonKeys} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Agency / Enterprise ──────────────────────────────────────── */}
        <section className="pb-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <TeamsCtaBand />
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
