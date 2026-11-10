import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BrandBackdrop } from "@/components/marketing/brand-backdrop";
import { Reveal } from "@/components/marketing/reveal";
import { RevealNoScript } from "@/components/marketing/reveal-noscript";
import { ChannelTile } from "@/components/marketing/pricing/channel-tile";
import { StatusChip } from "@/components/marketing/pricing/status-chip";
import { SuiteCard } from "@/components/marketing/pricing/suite-card";
import { TeamsCtaBand } from "@/components/marketing/pricing/teams-cta";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { SignupCta } from "@/lib/catalog";
import { CHANNELS, suiteModuleSlugs } from "@/lib/pricing-catalog";
import {
  findBundleTier,
  formatPeaks,
  hasMonthlyOffer,
  offerMonthly,
  suiteTrialDays,
  type PricingResponse,
} from "@/lib/pricing";
import { safeJsonLd } from "@/lib/json-ld";
import {
  SHOPIFY_GROUPS,
  SHOPIFY_HERO,
  SHOPIFY_MORE,
  SHOPIFY_SEO,
  shopifyFaq,
  shopifyHeroTicks,
  shopifyInstallCta,
  shopifyJsonLd,
  shopifyTrust,
} from "@/lib/shopify-features";
import { SITE } from "@/lib/utils";

const eyebrow =
  "inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label";
const primaryBtn =
  "group inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

/**
 * The body of /shopify ("Peakhour for Shopify"), between the Header and the
 * Footer. Pure: every fact it states (price, trial, credit allowance, whether
 * the connector is coming soon) arrives as a prop from the page, so a test can
 * render it from a fixture. See lib/shopify-features.ts for the copy.
 */
export function ShopifyPageView({
  pricing,
  comingSoon,
  signup,
}: {
  pricing: PricingResponse | null;
  /** The catalog marks the shopify connector coming soon (pillar-channels). */
  comingSoon: boolean;
  /** `signupCta(...)`: what the hero shows in place of Install while coming soon. */
  signup: SignupCta;
}) {
  const suite = findBundleTier(pricing, "suite");
  const trialDays = suiteTrialDays(pricing);
  const install = shopifyInstallCta({
    comingSoon,
    installHref: CHANNELS.shopify.href,
    signup,
  });
  const peaks =
    typeof suite?.peaksIncluded === "number" ? formatPeaks(suite.peaksIncluded) : null;
  const faqs = shopifyFaq({ trialDays, peaksIncluded: peaks, comingSoon });
  const jsonLd = shopifyJsonLd({
    url: `${SITE.url.replace(/\/$/, "")}${SHOPIFY_SEO.path}`,
    faqs,
    // The price the card shows: the campaign price when one is live.
    offer: suite
      ? {
          price: hasMonthlyOffer(suite.pricing) ? offerMonthly(suite.pricing) : suite.pricing.monthly,
          currency: suite.pricing.currency,
        }
      : null,
  });
  // The pricing card's button: the same decision as the hero's.
  const cardCta: SignupCta =
    install.kind === "install"
      ? { label: install.label, href: install.href }
      : install.signup;

  return (
    <main>
      <RevealNoScript />
      {jsonLd.map((graph, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(graph) }}
        />
      ))}

      {/* Hero */}
      <section className="relative isolate py-16 sm:py-24">
        <BrandBackdrop />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-sm font-medium text-muted-foreground">
              <ol className="flex items-center gap-1.5">
                <li>
                  <Link href="/" className="transition-colors hover:text-brand">
                    Home
                  </Link>
                </li>
                <li aria-hidden className="opacity-40">
                  &rsaquo;
                </li>
                <li aria-current="page" className="text-foreground">
                  Peakhour for Shopify
                </li>
              </ol>
            </nav>
            <span className={`mt-5 ${eyebrow}`}>
              <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
              {SHOPIFY_HERO.eyebrow}
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-pretty sm:text-5xl">
              {SHOPIFY_HERO.headline}{" "}
              <span className="font-serif font-normal italic text-brand-gradient">
                {SHOPIFY_HERO.accent}
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">{SHOPIFY_HERO.lede}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {install.kind === "install" ? (
                <a
                  href={install.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={primaryBtn}
                >
                  {install.label}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </a>
              ) : (
                <>
                  <StatusChip status="coming_soon" />
                  {!install.signup.disabled && (
                    <Link href={install.signup.href} className={primaryBtn}>
                      {install.signup.label}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  )}
                </>
              )}
              <a
                href="#pricing"
                className="inline-flex items-center rounded-xl border-2 px-6 py-3 text-sm font-bold transition-colors hover:border-brand hover:text-brand"
              >
                {SHOPIFY_HERO.pricing}
              </a>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              {shopifyHeroTicks(trialDays, comingSoon).map((tick) => (
                <li key={tick} className="inline-flex items-center gap-1.5">
                  {/* An icon, not `&check;`: JSX only decodes the XHTML entity
                      set, so the HTML5 name rendered as the literal text. */}
                  <Check aria-hidden className="size-3.5 shrink-0 text-brand-label" strokeWidth={3} />
                  {tick}
                </li>
              ))}
            </ul>
          </div>

          {/* The six groups, in a dark panel */}
          <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink p-6 text-on-ink shadow-2xl">
            <div className="flex items-center gap-3">
              <ChannelTile channel="shopify" className="size-11 rounded-xl text-sm" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-ink-dim">
                  Inside your Shopify admin
                </p>
                <p className="text-lg font-bold">Peakhour</p>
              </div>
            </div>
            <ul className="mt-5 flex flex-col gap-3">
              {SHOPIFY_GROUPS.map((g) => (
                <li key={g.id} className="flex gap-3 text-sm text-on-ink-dim">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                  <a href={`#${g.id}`} className="transition-colors hover:text-on-ink">
                    {g.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section aria-label="What to expect" className="border-y bg-muted/30 py-6">
        <ul className="mx-auto grid max-w-6xl gap-3 px-4 text-sm font-medium sm:px-6 md:grid-cols-2 lg:grid-cols-4">
          {shopifyTrust(comingSoon).map((t) => (
            <li key={t} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-strong" strokeWidth={2.5} aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* Six feature groups */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav aria-label="Feature groups" className="flex flex-wrap gap-2">
            {SHOPIFY_GROUPS.map((g) => (
              <a
                key={g.id}
                href={`#${g.id}`}
                className="rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors hover:border-brand hover:text-brand"
              >
                {g.name}
              </a>
            ))}
          </nav>

          {SHOPIFY_GROUPS.map((g) => (
            <div key={g.id} id={g.id} className="scroll-mt-24 pt-16">
              <Reveal>
                <span className={eyebrow}>
                  <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                  {g.name}
                </span>
                <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                  {g.blurb}
                </h2>
              </Reveal>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {g.features.map((f) => (
                  <Reveal key={f.id}>
                    <article
                      id={f.id}
                      className="flex h-full flex-col gap-3 rounded-2xl border bg-background p-6"
                    >
                      <h3 className="text-lg font-bold tracking-tight">{f.title}</h3>
                      <p className="text-sm">{f.does}</p>
                      <p className="text-sm text-muted-foreground">{f.benefit}</p>
                      <ol className="mt-1 flex flex-col gap-1.5 text-sm text-muted-foreground">
                        {f.steps.map((step, i) => (
                          <li key={step} className="flex gap-2.5">
                            <span
                              aria-hidden
                              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-micro font-bold text-brand-ink"
                            >
                              {i + 1}
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* More than the store */}
      <section className="border-t bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <span className={eyebrow}>
            <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
            The rest of Peakhour
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
            Your plan covers more than your store.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SHOPIFY_MORE.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="group flex flex-col gap-2 rounded-2xl border bg-background p-5 transition-all hover:-translate-y-1 hover:border-foreground hover:shadow-md"
              >
                <span className="flex items-center gap-2 font-bold">
                  {m.title}
                  <ArrowRight
                    className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
                <span className="text-sm text-muted-foreground">{m.body}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-24 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <span className={eyebrow}>
            <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
            Pricing
          </span>
          <h2 className="mb-8 mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
            {comingSoon ? "One plan, everything included." : "One plan, billed through Shopify."}
          </h2>
          {suite ? (
            <SuiteCard
              tier={suite}
              includedSlugs={suiteModuleSlugs(pricing)}
              cta={cardCta}
              openSignup={false}
              // Coming soon, the button is the peakhour.ai signup, so the card is
              // the plain Suite card: its trial is not billed through Shopify.
              channel={comingSoon ? undefined : "shopify"}
            />
          ) : (
            <p className="text-muted-foreground">
              Pricing is not available right now. Check back soon.
            </p>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <span className={eyebrow}>
            <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
            Good to know
          </span>
          <h2 className="mb-6 mt-4 text-3xl font-extrabold tracking-tight text-pretty">
            Questions, answered simply
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq) => (
              <AccordionItem key={faq.q} value={faq.q}>
                <AccordionTrigger className="text-left text-base font-semibold">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <TeamsCtaBand />
        </div>
      </section>
    </main>
  );
}
