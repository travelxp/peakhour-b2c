import { headers } from "next/headers";
import Link from "next/link";
import { Check } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getPricing, findBundleTier, formatMonthly } from "@/lib/pricing";
import { getPublicCatalog, signupCta } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Agency & Enterprise plans",
  description:
    "Every Peakhour pillar across many businesses — one unit per client, volume Peaks and central billing on Agency, plus SSO, SLAs and a dedicated team on Enterprise.",
  path: "/pricing/teams",
});

function countryFrom(header: string | null): string {
  return header && /^[A-Za-z]{2}$/.test(header) ? header.toUpperCase() : "DEFAULT";
}

const AGENCY_FEATURES = [
  "All five pillars, fully unlocked",
  "One unit = one client business",
  "Central billing across every client",
  "Priority support & onboarding",
];

const ENTERPRISE_FEATURES = [
  "Everything in Agency",
  "SSO & advanced roles",
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
  const cta = signupCta(signupMode);

  const agency = findBundleTier(pricing, "agency");
  const enterprise = findBundleTier(pricing, "enterprise");

  const agencyPrice = agency ? formatMonthly(agency.pricing) : "$299";
  const agencyPeaks =
    typeof agency?.peaksIncluded === "number"
      ? agency.peaksIncluded.toLocaleString()
      : "25,000";
  const enterprisePeaks =
    typeof enterprise?.peaksIncluded === "number"
      ? enterprise.peaksIncluded.toLocaleString()
      : "100,000";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <nav
              aria-label="Breadcrumb"
              className="text-sm font-medium text-muted-foreground"
            >
              <ol className="flex items-center justify-center gap-1.5">
                <li>
                  <Link href="/pricing" className="transition-colors hover:text-brand">
                    Pricing
                  </Link>
                </li>
                <li aria-hidden className="opacity-40">
                  ›
                </li>
                <li aria-current="page" className="text-foreground">
                  Agency &amp; Enterprise
                </li>
              </ol>
            </nav>
            <span className="mt-6 inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
              <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
              For teams &amp; partners
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-pretty sm:text-5xl">
              Built for many businesses{" "}
              <span className="font-serif font-normal italic text-brand-gradient">
                at once.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Whether you manage a roster of clients or run a large brand, get
              every pillar under one roof — with the billing, credits and controls
              that scale.
            </p>
          </div>
        </section>

        {/* ── Cards ────────────────────────────────────────────────────── */}
        <section className="pb-16">
          <div className="mx-auto grid max-w-4xl gap-6 px-4 sm:px-6 md:grid-cols-2">
            {/* Agency */}
            <div className="flex flex-col rounded-3xl border bg-background p-8 shadow-md">
              <span className="inline-flex self-start items-center rounded-full bg-brand-gradient px-3 py-1 text-xs font-bold text-brand-contrast">
                Most chosen by agencies
              </span>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight">Agency</h2>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span
                  className="text-4xl font-extrabold tracking-tight"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {agencyPrice}
                </span>
                <span className="text-sm text-muted-foreground">
                  / month, per business unit
                </span>
              </div>
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
                  className="mt-7 inline-flex items-center justify-center rounded-xl bg-foreground px-5 py-3 text-sm font-bold text-background transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  {openSignup ? "Start an Agency plan" : cta.label}
                </Link>
              )}
            </div>

            {/* Enterprise */}
            <div className="flex flex-col rounded-3xl border border-white/10 bg-zinc-900 p-8 text-zinc-100 shadow-2xl">
              <span className="inline-flex self-start items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">
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
                <span className="text-sm text-zinc-400">custom terms</span>
              </div>
              <p className="mt-3 text-sm text-zinc-400">
                Everything in Agency, plus the security, scale and support a large
                organization needs.
              </p>
              <ul className="mt-6 flex flex-1 flex-col gap-3">
                <li className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                  <span>
                    <strong className="font-semibold tabular-nums">{enterprisePeaks}+</strong>{" "}
                    Peaks / month, custom
                  </span>
                </li>
                {ENTERPRISE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/contact"
                className="mt-7 inline-flex items-center justify-center rounded-xl bg-brand-gradient px-5 py-3 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                Talk to sales
              </Link>
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-xl px-4 text-center text-sm text-muted-foreground">
            Not sure which fits?{" "}
            <Link href="/contact" className="font-semibold text-foreground underline underline-offset-2">
              Talk to our team
            </Link>{" "}
            — we&rsquo;ll size it to your client roster.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
