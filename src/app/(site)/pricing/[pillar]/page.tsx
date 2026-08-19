import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import {
  getPricing,
  pillarProducts,
  freeTier,
  proTier,
  type ResolvedProduct,
  type ResolvedProductTier,
} from "@/lib/pricing";
import { getPublicCatalog, publicMarketingIntegrations, signupCta } from "@/lib/catalog";
import {
  badgedComingSoonKeys,
  channelIsComingSoon,
} from "@/lib/pillar-channels";
import {
  PRICING_PILLAR_ORDER,
  pricingPillar,
  isPillarSlug,
  type ChannelKey,
} from "@/lib/pricing-catalog";
import { type PillarSlug } from "@/lib/pillars";
import { pageMetadata } from "@/lib/seo";
import { PlanCards } from "@/components/marketing/pricing/plan-cards";
import { ProValueBlocks } from "@/components/marketing/pricing/pro-value-blocks";
import { FeatureComparison } from "@/components/marketing/pricing/feature-comparison";
import { WhereItRuns } from "@/components/marketing/pricing/where-it-runs";
import { StatusChip } from "@/components/marketing/pricing/status-chip";
import { TeamsCtaBand } from "@/components/marketing/pricing/teams-cta";

/** Pre-render the five known pillar slugs. */
export function generateStaticParams() {
  return PRICING_PILLAR_ORDER.map((pillar) => ({ pillar }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pillar: string }>;
}): Promise<Metadata> {
  const { pillar } = await params;
  if (!isPillarSlug(pillar)) return { title: "Pricing — Peakhour.ai" };
  const p = pricingPillar(pillar);
  return pageMetadata({
    title: `${p.name} pricing — Pro & Free plans`,
    description: `${p.promise} Compare Pro and Free, see what runs where, and start free.`,
    path: `/pricing/${pillar}`,
  });
}

function countryFrom(header: string | null): string {
  return header && /^[A-Za-z]{2}$/.test(header) ? header.toUpperCase() : "DEFAULT";
}

/**
 * /pricing/[pillar] — one pillar, two plans.
 *
 * The page reads top to bottom as a decision: a value-led headline about what
 * Pro buys, the two cards (Pro first, Free neutral beside it), the four things
 * that change on Pro, the full matrix folded away for whoever wants it, then
 * where the pillar runs and the Agency/Enterprise door.
 *
 * It replaced a comparison-table-first layout, which put a thirty-row grid of
 * catalog feature names ahead of the price. The table is still here and still
 * generated from the same live catalog — it just isn't the opening argument,
 * and its rows are now written for the person reading them.
 *
 * When the product isn't listed in this env (prod-hidden while in_development),
 * the pillar is still real — we render a waitlist view instead of 404'ing.
 */
export default async function PillarPricingPage({
  params,
}: {
  params: Promise<{ pillar: string }>;
}) {
  const { pillar } = await params;
  if (!isPillarSlug(pillar)) notFound();
  const slug = pillar as PillarSlug;
  const meta = pricingPillar(slug);
  const Icon = meta.icon;

  const h = await headers();
  const country = countryFrom(h.get("x-vercel-ip-country"));
  const [pricing, catalog] = await Promise.all([
    getPricing(country),
    getPublicCatalog(),
  ]);
  const signupMode = catalog?.platform?.signupMode ?? "open";
  const openSignup = signupMode === "open";
  const cta = signupCta(signupMode);

  // The channel cards below state connector availability, so they answer from
  // the same rule the homepage's integrations grid and pillar chips do.
  const published = catalog ? publicMarketingIntegrations(catalog.integrations) : [];
  const badged = new Set(
    badgedComingSoonKeys({ published, all: catalog?.integrations ?? [] }),
  );
  const channelSoon = (key: ChannelKey) => channelIsComingSoon(key, badged);

  const product: ResolvedProduct | undefined = pillarProducts(pricing, slug)[0];
  const pro = product ? proTier(product) : undefined;
  const free = product ? freeTier(product) : undefined;
  // Pro first everywhere — the cards, the table columns, the labels. A reader
  // who scanned the cards should find the same two columns in the same order.
  const comparisonTiers: ResolvedProductTier[] = [pro, free].filter(
    (t): t is ResolvedProductTier => Boolean(t),
  );
  const columnLabels = [pro ? "Pro" : null, free ? "Free" : null].filter(
    (l): l is string => Boolean(l),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="pt-12 sm:pt-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <nav
              aria-label="Breadcrumb"
              className="text-sm font-medium text-muted-foreground"
            >
              <ol className="flex items-center gap-1.5">
                <li>
                  <Link href="/pricing" className="transition-colors hover:text-brand">
                    Pricing
                  </Link>
                </li>
                <li aria-hidden className="opacity-40">
                  ›
                </li>
                <li aria-current="page" className="text-foreground">
                  {meta.name}
                </li>
              </ol>
            </nav>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <Icon className="size-4" strokeWidth={2.5} aria-hidden />
                {meta.name} Pricing
              </span>
              <StatusChip status={product?.status} />
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-[1.1] tracking-tight text-pretty sm:text-4xl">
              {meta.priceHeadline}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              {meta.priceLede}
            </p>
          </div>
        </section>

        {/* ── Plans ────────────────────────────────────────────────────── */}
        <section className="pt-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {pro || free ? (
              <PlanCards
                pro={pro}
                free={free}
                proHighlights={meta.proHighlights}
                freeHighlights={meta.freeHighlights}
                cta={cta}
                openSignup={openSignup}
              />
            ) : (
              <div className="rounded-3xl border border-brand/30 bg-brand-soft/40 p-10 text-center dark:bg-brand/5">
                <h2 className="text-2xl font-extrabold tracking-tight">
                  {meta.name} is coming soon
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                  We&rsquo;re putting the finishing touches on {meta.name}. We&rsquo;ll
                  let you know the moment it&rsquo;s live &mdash; and get you set up
                  first.
                </p>
                {/* Was a hardcoded /auth?intent=waitlist and the words "Join
                    the waitlist", which agree with reality only while
                    signupMode is waitlist_only. Every other CTA on this page
                    already reads `cta`; this one now does too, so when
                    signups open it stops pointing at a waitlist that isn't
                    there. */}
                {!cta.disabled && (
                  <Link
                    href={cta.href}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {cta.label}
                    <ArrowRight className="size-4" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── What changes on Pro ──────────────────────────────────────── */}
        <ProValueBlocks blocks={meta.proValueBlocks} />

        {/* ── Full comparison, folded away ─────────────────────────────── */}
        {comparisonTiers.length > 0 && (
          <section className="pt-10">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <FeatureComparison
                tiers={comparisonTiers}
                columnLabels={columnLabels}
              />
            </div>
          </section>
        )}

        {/* ── Where it runs ────────────────────────────────────────────── */}
        <WhereItRuns
          pillarName={meta.name}
          channels={meta.runsIn}
          isComingSoon={channelSoon}
        />

        {/* ── Learn more + Teams CTA ───────────────────────────────────── */}
        <section className="pt-16 pb-24">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6">
            <Link
              href={`/${slug}`}
              className="group inline-flex items-center gap-2 self-start text-sm font-bold text-brand-strong"
            >
              See everything {meta.name} does
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
            <TeamsCtaBand pillarName={meta.name} />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
