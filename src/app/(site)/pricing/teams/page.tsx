import { headers } from "next/headers";
import Link from "next/link";
import { Check } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getPricing, findBundleTier, agencyCardPrice, formatPeaks, suiteTrialDays } from "@/lib/pricing";
import { getPublicCatalog, signupCta } from "@/lib/catalog";
import { pageMeta } from "@/lib/seo/metadata";
import { pathFor } from "@/lib/seo/resolve";
import { Breadcrumbs } from "@/components/marketing/seo/breadcrumbs";
import { ContextualLinks } from "@/components/marketing/seo/contextual-links";
import { cardCls, eyebrowCls, ghostBtn, primaryBtn, wrap } from "@/components/marketing/seo/styles";

export const metadata = pageMeta("pricing.teams");

function countryFrom(header: string | null): string {
  return header && /^[A-Za-z]{2}$/.test(header) ? header.toUpperCase() : "DEFAULT";
}

const AGENCY_FEATURES = [
  "Everything in Peakhour Suite, fully unlocked",
  "One unit = one client business",
  "Central billing across every client",
  "Priority support & onboarding",
];

const ENTERPRISE_FEATURES = [
  "Everything in Agency",
  "SLAs & uptime guarantees",
  "Dedicated success manager",
  "Security review & DPA",
];

/**
 * /pricing/teams — Agency & Enterprise. These are account-level bundle plans
 * (not a pillar tier), so they live here rather than in any pillar's table.
 * Price + Peaks allowance are read live from the catalog when the bundle is
 * publicly listed (`findBundleTier`), with a sensible fallback otherwise; the
 * holistic feature story is static marketing copy.
 */
export default async function TeamsPricingPage() {
  const h = await headers();
  const country = countryFrom(h.get("x-vercel-ip-country"));
  const [pricing, catalog] = await Promise.all([
    getPricing(country),
    getPublicCatalog(),
  ]);
  const signupMode = catalog?.platform?.signupMode ?? "open";
  const openSignup = signupMode === "open";
  const cta = signupCta(signupMode, suiteTrialDays(pricing));

  const suite = findBundleTier(pricing, "suite");
  const agency = findBundleTier(pricing, "agency");
  const enterprise = findBundleTier(pricing, "enterprise");

  // Agency is sold quarterly and yearly, never monthly (D5): the card quotes
  // the year (`agencyCardPrice`), and with no Agency row says it is priced at
  // checkout instead of the invented "$299/month" it used to fall back to.
  const agencyPrice = agencyCardPrice(agency);
  const agencyPeaks =
    typeof agency?.peaksIncluded === "number"
      ? formatPeaks(agency.peaksIncluded)
      : "250,000";
  const enterprisePeaks =
    typeof enterprise?.peaksIncluded === "number"
      ? formatPeaks(enterprise.peaksIncluded)
      : "1,000,000";

  return (
    <div className="flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <Header />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="bg-[linear-gradient(180deg,var(--daylight-hero)_0%,var(--background)_92%)]">
          <div className={`${wrap} py-8 sm:py-12 lg:pb-6 lg:pt-16`}>
            <div className="max-w-3xl">
              <Breadcrumbs
                crumbs={[
                  { label: "Home", href: pathFor("home") },
                  { label: "Pricing", href: pathFor("pricing") },
                  { label: "Agency & Enterprise", href: pathFor("pricing.teams") },
                ]}
              />
            </div>
            <p className={`${eyebrowCls} mt-5`}>For teams &amp; partners</p>
            <h1 className="mt-3 text-[2.2rem] font-black leading-[1.04] tracking-[-0.04em] text-balance sm:text-5xl lg:text-[3.5rem]">
              One account for{" "}
              <span className="daylight-mark">many client businesses.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-foreground/80 sm:text-xl">
              Agency and Enterprise give each client business every module,
              with volume Peaks and central billing.
            </p>
            {/* ★THIS PAGE SOLD THE TOP OF A LADDER WHOSE MIDDLE RUNG IT NEVER
                MENTIONED. Peakhour Suite now sits directly below Agency, so a
                visitor who lands here from a search and does not need many
                businesses was being shown ₹24,999 as the entry point. Naming
                the rung below is the difference between a price list and a
                ladder. */}
            {/* ★AND ONLY WHEN THE CATALOG SELLS IT. This file already degrades
                through `findBundleTier` everywhere else; an unconditional
                paragraph names a plan that does not exist on an environment
                that has not run migration 258, and links to an `#suite` anchor
                the hub does not render there. */}
            {suite && (
              <p className="mt-4 max-w-xl text-sm text-muted-foreground">
                Running one business?{" "}
                <Link
                  href="/pricing#suite"
                  className="font-bold text-brand-strong underline decoration-2 underline-offset-4"
                >
                  Peakhour Suite
                </Link>{" "}
                gives a single business the same Peakhour, at a fraction of
                this price. These two are for running many.
              </p>
            )}
          </div>
        </section>

        {/* ── Cards ────────────────────────────────────────────────────── */}
        <section className="pb-8 pt-4 sm:pb-12">
          <div className={`${wrap} grid gap-5 md:grid-cols-2 md:gap-6`}>
            {/* Agency */}
            <div className={`${cardCls} flex flex-col rounded-3xl border-2 border-brand p-6 shadow-[var(--daylight-shadow)] sm:p-8`}>
              <span className="inline-flex self-start items-center rounded-full bg-brand-gradient px-3 py-1 text-micro font-bold uppercase tracking-wide text-brand-contrast">
                For agencies
              </span>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight">Agency</h2>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span
                  className="text-4xl font-extrabold tracking-tight"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {agencyPrice ? agencyPrice.price : "Priced at checkout"}
                </span>
                {agencyPrice?.list && (
                  <span className="text-base font-bold text-muted-foreground line-through decoration-2">
                    {agencyPrice.list}
                  </span>
                )}
              </div>
              {agencyPrice && (
                <p className="mt-1 text-sm text-muted-foreground">{agencyPrice.per}</p>
              )}
              {/* The campaign behind the struck-through price: its own name
                  beside its percent, as the Suite badge says it. */}
              {agencyPrice?.offer && (
                <p className="mt-1 text-xs font-bold text-brand-ink">{agencyPrice.offer}</p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">
                Every product, for one business — one unit per client. Add units
                as your roster grows.
              </p>
              <ul className="mt-6 flex flex-1 flex-col gap-3">
                <li className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-strong" strokeWidth={2.5} aria-hidden />
                  <span>
                    <strong className="font-semibold tabular-nums">{agencyPeaks}</strong>{" "}
                    Peaks / month per unit
                  </span>
                </li>
                {AGENCY_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-strong" strokeWidth={2.5} aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              {!cta.disabled && (
                <Link
                  href={cta.href}
                  className={`${primaryBtn} mt-7 justify-center`}
                >
                  {openSignup ? "Start an Agency plan" : cta.label}
                </Link>
              )}
            </div>

            {/* Enterprise */}
            <div className={`${cardCls} flex flex-col rounded-3xl p-6 sm:p-8`}>
              <span className="inline-flex self-start items-center rounded-full bg-muted px-3 py-1 text-micro font-bold uppercase tracking-wide">
                Custom
              </span>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight">Enterprise</h2>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span
                  className="text-4xl font-extrabold tracking-tight"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  Let&rsquo;s talk
                </span>
                <span className="text-sm text-muted-foreground">custom terms</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Everything in Agency, plus the security, scale and support a large
                organization needs.
              </p>
              <ul className="mt-6 flex flex-1 flex-col gap-3">
                <li className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-strong" strokeWidth={2.5} aria-hidden />
                  <span>
                    <strong className="font-semibold tabular-nums">{enterprisePeaks}+</strong>{" "}
                    Peaks / month, custom
                  </span>
                </li>
                {ENTERPRISE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-strong" strokeWidth={2.5} aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/contact"
                className={`${ghostBtn} mt-7 justify-center`}
              >
                Talk to sales
              </Link>
            </div>
          </div>

          <p className={`${wrap} mt-6 text-sm text-muted-foreground`}>
            Not sure which plan fits?{" "}
            <Link href="/contact" className="font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4">
              Write to us
            </Link>{" "}
            and we&rsquo;ll size it to your client roster.
          </p>
        </section>

        <section aria-labelledby="related-h" className="pb-12 sm:pb-16">
          <div className={wrap}>
            <h2 id="related-h" className="text-2xl font-extrabold tracking-tight">
              Keep reading
            </h2>
            <ContextualLinks
              className="mt-5 grid gap-3 sm:grid-cols-3"
              links={[
                { label: "Peakhour pricing", href: pathFor("pricing"), note: "Peakhour Suite for a single business." },
                { label: "Peaks, the AI credits", href: pathFor("peaks"), note: "Volume Peaks and top-ups explained." },
                { label: "How Peakhour works", href: pathFor("how.it.works"), note: "What every module does for each client." },
              ]}
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
