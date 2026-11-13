import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  CreditCard,
  LayoutDashboard,
  MessageCircle,
  PauseCircle,
  ShieldCheck,
  Store,
} from "lucide-react";
import { StatusChip } from "@/components/marketing/pricing/status-chip";
import { SuiteCard } from "@/components/marketing/pricing/suite-card";
import { TeamsCtaBand } from "@/components/marketing/pricing/teams-cta";
import type { SignupCta } from "@/lib/catalog";
import { CHANNELS, suiteModuleSlugs } from "@/lib/pricing-catalog";
import {
  findBundleTier,
  formatPeaks,
  hasMonthlyOffer,
  offerMonthly,
  PRICE_AT_SIGNUP,
  suiteTrialDays,
  type PricingResponse,
} from "@/lib/pricing";
import { safeJsonLd } from "@/lib/json-ld";
import {
  SHOPIFY_CLOSING,
  SHOPIFY_GROUPS,
  SHOPIFY_HERO,
  SHOPIFY_MORE,
  SHOPIFY_OWNER_WHATSAPP,
  SHOPIFY_SEO,
  SHOPIFY_STEPS,
  SHOPIFY_TRUST,
  shopifyFaq,
  shopifyHeroTicks,
  shopifyInstallCta,
  shopifyJsonLd,
  shopifyTrust,
  type ShopifyInstallCta,
} from "@/lib/shopify-features";
import { SITE, cn } from "@/lib/utils";
import { ShopifyAutopilotDemo } from "./shopify-autopilot-demo";
import { ShopifyHeroDemo } from "./shopify-hero-demo";
import { ShopifyJobs } from "./shopify-jobs";
import { ShopifyOwnerChat } from "./shopify-owner-chat";

/*
 * Layout rhythm. One container, one section padding and one heading scale, so
 * no section opens a gap of its own: sections are py-14 on a phone and py-20
 * from sm, and a heading block sits mt-8 (mt-10 from sm) above what it
 * introduces.
 */
const wrap = "mx-auto max-w-6xl px-4 sm:px-6";
const section = "py-14 sm:py-20";
const eyebrow = "text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground";
const h2 = "mt-3 text-[2rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-balance sm:text-5xl";
const sub = "mt-3 max-w-2xl text-lg text-muted-foreground";
const primaryBtn =
  "group inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3.5 text-[15px] font-bold text-brand-contrast shadow-[0_8px_20px_-8px_var(--brand)] transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const ghostBtn =
  "inline-flex items-center rounded-full px-6 py-3.5 text-[15px] font-bold shadow-[inset_0_0_0_2px_var(--foreground)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** One icon per trust line, keyed by the line so coming soon's shorter list keeps them. */
const TRUST_ICONS: Record<string, typeof Check> = {
  [SHOPIFY_TRUST[0]]: Store,
  [SHOPIFY_TRUST[1]]: CreditCard,
  [SHOPIFY_TRUST[2]]: LayoutDashboard,
  [SHOPIFY_TRUST[3]]: Clock3,
};
const OWNER_ICONS: Record<string, typeof Check> = {
  ask: MessageCircle,
  approve: BadgeCheck,
  confirm: ShieldCheck,
  pause: PauseCircle,
};
/** Pillar dots: identity only, never a fill behind text. */
const MORE_DOTS: Record<string, string> = {
  "/support": "var(--daylight-dot-support)",
  "/content": "var(--daylight-dot-content)",
  "/growth": "var(--daylight-dot-growth)",
  "/presence": "var(--daylight-dot-presence)",
};

/**
 * The body of /shopify ("Peakhour for Shopify"), between the Header and the
 * Footer, on the Daylight palette (the page wraps itself in .theme-daylight).
 * Pure: every fact it states (price, trial, credit allowance, whether the
 * connector is coming soon) arrives as a prop from the page, so a test can
 * render it from a fixture. See lib/shopify-features.ts for the copy.
 */
export function ShopifyPageView({
  pricing,
  country = "DEFAULT",
  comingSoon,
  signup,
}: {
  pricing: PricingResponse | null;
  /** The country `pricing` was fetched for (`resolveCountry`). */
  country?: string;
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

  const trust = shopifyTrust(comingSoon);
  const jobs = SHOPIFY_GROUPS.filter((g) => g.id !== "control");
  const control = SHOPIFY_GROUPS.find((g) => g.id === "control");

  return (
    <main>
      {/* No-JS: every feature panel, not only the first tab. */}
      <noscript suppressHydrationWarning>
        <style dangerouslySetInnerHTML={{ __html: "[data-jobs-panel][hidden]{display:block!important}" }} />
      </noscript>
      {jsonLd.map((graph, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(graph) }}
        />
      ))}

      {/* Hero */}
      <section className="bg-[linear-gradient(180deg,var(--daylight-hero)_0%,var(--background)_88%)]">
        <div className={cn(wrap, "grid grid-cols-1 items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-20")}>
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="text-sm font-medium text-muted-foreground">
              <ol className="flex items-center gap-1.5">
                <li>
                  <Link href="/" className="transition-colors hover:text-foreground">
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
            <p className={cn(eyebrow, "mt-5")}>{SHOPIFY_HERO.eyebrow}</p>
            <h1 className="mt-3 text-[2.6rem] font-black leading-[1.02] tracking-[-0.04em] text-balance sm:text-6xl lg:text-[4.25rem]">
              {SHOPIFY_HERO.headline} <span className="daylight-mark">{SHOPIFY_HERO.accent}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground sm:text-xl">{SHOPIFY_HERO.lede}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <InstallActions install={install} />
              <a href="#pricing" className={ghostBtn}>
                {SHOPIFY_HERO.pricing}
              </a>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm font-semibold text-muted-foreground">
              {shopifyHeroTicks(trialDays, comingSoon).map((tick) => (
                <li key={tick} className="inline-flex items-center gap-1.5">
                  {/* An icon, not `&check;`: JSX only decodes the XHTML entity
                      set, so the HTML5 name rendered as the literal text. */}
                  <Check aria-hidden className="size-4 shrink-0 text-[var(--daylight-ok)]" strokeWidth={3} />
                  {tick}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            <ShopifyHeroDemo />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section aria-label="What to expect" className="border-y">
        <ul className={cn(wrap, "grid sm:grid-cols-2", trust.length > 2 && "lg:grid-cols-4")}>
          {trust.map((t) => {
            const Icon = TRUST_ICONS[t] ?? Check;
            return (
              <li
                key={t}
                className="flex items-center gap-3 border-b py-4 text-[15px] font-bold last:border-b-0 sm:border-b-0 sm:py-5 sm:pr-4 sm:even:border-l sm:even:pl-5 lg:border-l lg:pl-5 lg:first:border-l-0 lg:first:pl-0"
              >
                <Icon aria-hidden className="size-5 shrink-0 text-brand" strokeWidth={2.25} />
                {t}
              </li>
            );
          })}
        </ul>
      </section>

      {/* What it does */}
      <section id="features" className={cn(section, "scroll-mt-20")}>
        <div className={wrap}>
          <p className={eyebrow}>What it does</p>
          <h2 className={h2}>Five jobs Peakhour takes off your plate.</h2>
          <p className={sub}>
            Pick a job to see it in the app. Every feature here is built and in the app today, and{" "}
            <a href="#control" className="font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4">
              you stay in charge of all of it
            </a>
            .
          </p>
          <div className="mt-8 sm:mt-10">
            <ShopifyJobs groups={jobs} />
          </div>
        </div>
      </section>

      {/* Peakhour on WhatsApp, for the merchant: the page's one dark band */}
      <section id="whatsapp" aria-labelledby="whatsapp-h" className="scroll-mt-20 bg-ink text-on-ink">
        <div className={cn(wrap, "grid grid-cols-1 items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16")}>
          <div className="min-w-0">
            <p className={cn(eyebrow, "text-on-ink-dim")}>{SHOPIFY_OWNER_WHATSAPP.eyebrow}</p>
            <h2 id="whatsapp-h" className={h2}>
              {SHOPIFY_OWNER_WHATSAPP.headline} <span className="text-brand">{SHOPIFY_OWNER_WHATSAPP.accent}</span>
            </h2>
            <p className="mt-4 max-w-xl text-lg text-on-ink/85">{SHOPIFY_OWNER_WHATSAPP.lede}</p>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-1">
              {SHOPIFY_OWNER_WHATSAPP.points.map((p) => {
                const Icon = OWNER_ICONS[p.id] ?? Check;
                return (
                  <li key={p.id} className="flex gap-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10">
                      <Icon aria-hidden className="size-[18px] text-brand" />
                    </span>
                    <span>
                      <b className="block text-[17px]">{p.title}</b>
                      <span className="text-[15px] text-on-ink-dim">{p.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-7 text-sm text-on-ink-dim">{SHOPIFY_OWNER_WHATSAPP.note}</p>
          </div>
          <ShopifyOwnerChat />
        </div>
      </section>

      {/* You stay in charge */}
      {control && (
        <section id="control" className={cn(section, "scroll-mt-20")}>
          <div className={cn(wrap, "grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16")}>
            <div className="min-w-0">
              <p className={eyebrow}>{control.name}</p>
              <h2 className={h2}>Switch it on one task at a time. Stop it in a second.</h2>
              <p className={sub}>{control.blurb}</p>
              <ul className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {control.features.map((f) => (
                  <li key={f.id} id={f.id} className="scroll-mt-24">
                    <b className="block">{f.title}</b>
                    <span className="text-[15px] text-muted-foreground">{f.does}</span>
                  </li>
                ))}
              </ul>
            </div>
            <ShopifyAutopilotDemo />
          </div>
        </section>
      )}

      {/* Get started: only with an App Store install to start from */}
      {install.kind === "install" && (
        <section aria-labelledby="start-h" className="pb-14 sm:pb-20">
          <div className={wrap}>
            <p className={eyebrow}>Get started</p>
            <h2 id="start-h" className={h2}>
              From install to first answer in one sitting.
            </h2>
            <ol className="mt-8 grid gap-6 sm:mt-10 md:grid-cols-3">
              {SHOPIFY_STEPS.map((s, i) => (
                <li key={s.title} className="border-t-[3px] border-foreground pt-5">
                  <span className="block text-4xl font-black leading-none text-brand">{i + 1}</span>
                  <b className="mt-3 block text-xl tracking-tight">{s.title}</b>
                  <span className="mt-1.5 block text-muted-foreground">{s.body}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* The rest of Peakhour */}
      <section className="border-t bg-muted py-14 sm:py-20">
        <div className={wrap}>
          <p className={eyebrow}>The rest of Peakhour</p>
          <h2 className={h2}>Your plan covers more than your store.</h2>
          <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {SHOPIFY_MORE.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="group flex flex-col gap-2 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: MORE_DOTS[m.href] ?? "var(--brand)" }} />
                  {m.title}
                  <ArrowRight
                    className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
                <span className="text-[15px] text-muted-foreground">{m.body}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className={cn(section, "scroll-mt-20")}>
        <div className={wrap}>
          <p className={eyebrow}>Pricing</p>
          <h2 className={cn(h2, "mb-8 sm:mb-10")}>
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
              country={country}
              scopeAction="/shopify#pricing"
            />
          ) : (
            <p className="text-muted-foreground">{PRICE_AT_SIGNUP}</p>
          )}
          <div className="mt-4">
            <TeamsCtaBand />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-h" className="scroll-mt-20 pb-14 sm:pb-20">
        <div className={cn(wrap, "grid grid-cols-1 gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16")}>
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className={eyebrow}>FAQ</p>
            <h2 id="faq-h" className={h2}>
              Questions merchants ask before they install.
            </h2>
            <p className={sub}>Setup, WhatsApp, control, privacy and pricing, in short answers.</p>
          </div>
          <div className="border-t-2 border-foreground">
            {faqs.map((faq, i) => (
              <details key={faq.q} open={i === 0} className="group border-b">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-extrabold tracking-tight sm:py-5 [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span
                    aria-hidden
                    className="text-2xl font-medium leading-none text-muted-foreground transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-5 text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing band */}
      <section className="pb-14 sm:pb-20">
        <div className={wrap}>
          <div className="flex flex-col items-start justify-between gap-7 rounded-[28px] bg-brand-gradient px-6 py-10 text-white sm:px-10 sm:py-14 lg:flex-row lg:items-center lg:px-14">
            <div className="max-w-2xl">
              <h2 className="text-[2rem] font-black leading-[1.04] tracking-[-0.035em] text-balance sm:text-5xl">
                {SHOPIFY_CLOSING.headline}
              </h2>
              <p className="mt-4 text-lg text-white/90">{SHOPIFY_CLOSING.body}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <InstallActions install={install} onBrand />
              <a
                href="#pricing"
                className="inline-flex items-center rounded-full px-6 py-3.5 text-[15px] font-bold text-white shadow-[inset_0_0_0_2px_#fff] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {SHOPIFY_HERO.pricing}
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/**
 * The install button, or (coming soon) the chip and the platform's signup
 * button. One decision, used by the hero and the closing band.
 */
function InstallActions({ install, onBrand = false }: { install: ShopifyInstallCta; onBrand?: boolean }) {
  const btn = onBrand
    ? "group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-bold text-on-ink transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    : primaryBtn;
  if (install.kind === "install") {
    return (
      <a href={install.href} target="_blank" rel="noopener noreferrer" className={btn}>
        {install.label}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
      </a>
    );
  }
  return (
    <>
      {!onBrand && <StatusChip status="coming_soon" />}
      {!install.signup.disabled && (
        <Link href={install.signup.href} className={btn}>
          {install.signup.label}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      )}
    </>
  );
}
