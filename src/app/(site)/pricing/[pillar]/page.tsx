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
  productTiers,
  type ResolvedProduct,
} from "@/lib/pricing";
import { getPublicCatalog, publicMarketingIntegrations, signupCta } from "@/lib/catalog";
import { badgedComingSoonKeys } from "@/lib/pillar-channels";
import {
  PRICING_PILLAR_ORDER,
  pricingPillar,
  isPillarSlug,
  CHANNELS,
  type ChannelKey,
} from "@/lib/pricing-catalog";
import { type PillarSlug } from "@/lib/pillars";
import { pageMetadata } from "@/lib/seo";
import { PlanComparison } from "@/components/marketing/pricing/plan-comparison";
import { StatusChip } from "@/components/marketing/pricing/status-chip";
import { ChannelTile } from "@/components/marketing/pricing/channel-tile";
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
    title: `${p.name} pricing — Free & Paid plans`,
    description: `${p.promise} Compare the free and paid ${p.name} plans, see what runs where, and start free.`,
    path: `/pricing/${pillar}`,
  });
}

function countryFrom(header: string | null): string {
  return header && /^[A-Za-z]{2}$/.test(header) ? header.toUpperCase() : "DEFAULT";
}

/**
 * /pricing/[pillar] — a single pillar's plans. The Free-vs-Paid comparison
 * table (bundle plans filtered out), what running it inside each channel gets
 * you, a link to the pillar's full story, and the Agency/Enterprise CTA.
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
  const channelSoon = (key: ChannelKey) => {
    const connector = CHANNELS[key].connectorKey;
    return connector !== undefined && badged.has(connector);
  };
  // The "Runs in …" pill is a flat sentence with nowhere to hang a state, so
  // it names only what the catalog vouches for. The cards below carry the
  // full set, each with its own chip — nothing is hidden, it just stops being
  // asserted in a place that cannot qualify it.
  const runsInLive = meta.runsIn.filter((key) => !channelSoon(key));

  const product: ResolvedProduct | undefined = pillarProducts(pricing, slug)[0];
  const tiers = product ? productTiers(product) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
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

            <div className="mt-6 flex items-start gap-4 sm:gap-5">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient shadow-sm">
                <Icon className="size-6 text-brand-contrast" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-pretty sm:text-4xl">
                  {meta.name}
                </h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">{meta.lede}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusChip status={product?.status} />
                  <span className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    One shared Peaks wallet
                  </span>
                  {runsInLive.length > 0 && (
                    <span className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Runs in {runsInLive.map((c) => CHANNELS[c].name.replace(" App", "").replace(" Plugin", "")).join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Plans ────────────────────────────────────────────────────── */}
        <section className="pb-4">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            {tiers.length > 0 ? (
              <div className="rounded-3xl border bg-background p-5 shadow-sm sm:p-8">
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <p className="text-sm font-semibold text-muted-foreground">
                    Same product, same polish — Paid just lifts your limits.
                  </p>
                </div>
                <PlanComparison tiers={tiers} cta={cta} openSignup={openSignup} />
              </div>
            ) : slug === "presence" ? (
              <div className="rounded-3xl border border-brand/30 bg-brand-soft/40 p-10 text-center dark:bg-brand/5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success-on-tint">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden />
                  Always free
                </span>
                <h2 className="mt-4 text-2xl font-extrabold tracking-tight">
                  {meta.name} is free — get started in minutes
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                  {meta.freeLabel} — no credit card. Claim your business, keep every
                  listing right, and reply to reviews with AI drafts.
                </p>
                {!cta.disabled && (
                  <Link
                    href={cta.href}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {openSignup ? "Start free" : cta.label}
                    <ArrowRight className="size-4" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-brand/30 bg-brand-soft/40 p-10 text-center dark:bg-brand/5">
                <h2 className="text-2xl font-extrabold tracking-tight">
                  {meta.name} is coming soon
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                  We&rsquo;re putting the finishing touches on {meta.name}. Join the
                  waitlist and we&rsquo;ll let you know the moment it&rsquo;s live —
                  and get you set up first.
                </p>
                <Link
                  href="/auth?intent=waitlist"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  Join the waitlist
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── Channel usage ────────────────────────────────────────────── */}
        {meta.runsIn.length > 0 && (
          <section className="py-14">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                  <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                  How to use it
                </span>
                <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-pretty sm:text-3xl">
                  Turn it on where you work
                </h2>
                <p className="mt-3 text-muted-foreground">
                  {meta.name} runs inside these — install once and you&rsquo;re live.
                </p>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {meta.runsIn.map((key) => {
                  const ch = CHANNELS[key];
                  const external = ch.href.startsWith("http");
                  const soon = channelSoon(key);
                  const shell = "flex flex-col rounded-2xl border bg-background p-5";
                  const head = (
                    <>
                      <div className="flex items-center gap-3">
                        <ChannelTile
                          channel={key}
                          className="size-9 rounded-lg text-xs"
                          iconClassName="size-[18px]"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 font-bold">
                            {ch.name}
                            {soon && <StatusChip status="coming_soon" />}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {ch.billed}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 flex-1 text-sm text-muted-foreground">
                        {ch.blurb}
                      </p>
                    </>
                  );
                  // An off-site link is an install path. Don't offer one for a
                  // connector the catalog can't vouch for — the listing it
                  // points at doesn't exist yet. Internal links stay: those
                  // pages are real either way.
                  if (soon && external) {
                    return (
                      <div key={key} className={shell}>
                        {head}
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={key}
                      href={ch.href}
                      {...(external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className={`group ${shell} transition-all hover:-translate-y-1 hover:border-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`}
                    >
                      {head}
                      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-strong">
                        Open channel guide
                        <ArrowRight
                          className="size-3.5 transition-transform group-hover:translate-x-1"
                          aria-hidden
                        />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Learn more + Teams CTA ───────────────────────────────────── */}
        <section className="pb-24">
          <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 sm:px-6">
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
