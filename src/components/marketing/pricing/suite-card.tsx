import Link from "next/link";
import { ArrowRight, Check, Zap } from "lucide-react";
import {
  formatMonthly,
  formatYearly,
  formatPeaks,
  formatFoundingMonthly,
  formatFoundingYearly,
  hasFoundingOffer,
  type ResolvedProductTier,
} from "@/lib/pricing";
import type { SignupCta } from "@/components/marketing/pricing/plan-cards";
import { pricingPillar } from "@/lib/pricing-catalog";
import type { PillarSlug } from "@/lib/pillars";

/**
 * Peakhour Suite — one plan, all five modules.
 *
 * This replaces "pick a pillar, pay per pillar" as the thing the pricing hub
 * sells. The arithmetic that made the old shape untenable: five modules at
 * ₹1,499 is ₹7,495/month to assemble what the homepage describes, so in
 * practice nobody assembled it and every visitor bought one module and never
 * met the platform.
 *
 * Everything here is read from the catalog. The price, the Peaks allowance and
 * the launch discount all come from the `suite` row in `cfg_plans`; the module
 * names come from the same list the rest of the site renders. If the plan is
 * not in this environment's catalog the card does not render at all — see the
 * caller — rather than inventing a price.
 */
export function SuiteCard({
  tier,
  includedSlugs,
  cta,
  openSignup,
}: {
  tier: ResolvedProductTier;
  /** ★THE MODULES THIS PLAN ACTUALLY COMPOSES, resolved by the caller from the
   *  catalog. Passed in rather than read from the static order constant here:
   *  that constant is what the site KNOWS ABOUT, and the plan's products are
   *  what it GRANTS. Rendering the constant put a module in this list that the
   *  hub ladder, six inches above, had just marked "Soon". */
  includedSlugs: PillarSlug[];
  cta: SignupCta;
  openSignup: boolean;
}) {
  const p = tier.pricing;
  const founding = hasFoundingOffer(p);
  const peaks = tier.peaksIncluded;

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-brand bg-card p-6 shadow-lg sm:p-9">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        {/* ── The offer ─────────────────────────────────────────────── */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-contrast shadow-sm">
              Everything, one price
            </span>
            {founding && (
              <span className="inline-flex items-center rounded-full border border-brand/40 bg-brand-soft/60 px-2.5 py-1 text-[11px] font-bold text-brand-ink dark:bg-brand/10 dark:text-brand">
                Launch offer · {p.foundingDiscountPct}% off
              </span>
            )}
          </div>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty sm:text-4xl">
            {tier.name}
          </h2>
          {tier.tagline && (
            <p className="mt-2 max-w-md text-muted-foreground">{tier.tagline}</p>
          )}

          {/* Price. When a founding offer is live the list price stays on the
              page, struck through — a launch price with nothing to compare it
              to is just a price. */}
          <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span
              className="text-5xl font-extrabold tabular-nums tracking-tight"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              {founding ? formatFoundingMonthly(p) : formatMonthly(p)}
            </span>
            <span className="pb-1.5 text-sm text-muted-foreground">/month</span>
            {founding && (
              <span
                className="pb-1.5 text-lg font-bold tabular-nums text-muted-foreground line-through decoration-2"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                {formatMonthly(p)}
              </span>
            )}
          </div>
          {/* ★GUARDED ON A YEARLY PRICE EXISTING, as the identical line in
              PlanCards is. Every seeded Suite row carries one today, so this is
              latent — until a monthly-only supersede makes the card announce
              "₹0 billed yearly" beside a real monthly price. */}
          {p.yearly > 0 && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            {founding ? (
              <>
                {formatFoundingYearly(p)} billed yearly{" "}
                <span className="line-through">{formatYearly(p)}</span> · launch pricing,
                for a limited period
              </>
            ) : (
              <>{formatYearly(p)} billed yearly</>
            )}
          </p>
          )}

          {typeof peaks === "number" && (
            <div className="mt-6 rounded-2xl border border-brand/40 bg-brand-soft/50 px-4 py-3.5 dark:bg-brand/10">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span
                  className="text-2xl font-extrabold tabular-nums tracking-tight"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {formatPeaks(peaks)}
                </span>
                <span className="text-sm font-bold">Peaks a month</span>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="size-3.5 shrink-0 text-brand-strong" aria-hidden />
                Peaks power AI actions across all five modules.
              </p>
            </div>
          )}

          {cta.disabled ? (
            <span
              aria-disabled="true"
              className="mt-6 inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border-2 border-dashed px-5 py-3.5 text-sm font-bold text-muted-foreground sm:w-auto"
            >
              {cta.label}
            </span>
          ) : (
            <Link
              href={cta.href}
              className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:w-auto"
            >
              {openSignup ? "Get Peakhour Suite" : cta.label}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          )}
          {p.trialDays > 0 && (
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              {p.trialDays}-day free trial · card required
            </p>
          )}
        </div>

        {/* ── What's in it ──────────────────────────────────────────── */}
        <div className="lg:border-l lg:pl-12">
          {/* ★WHAT SUITE COMPOSES, NOT A STATIC FIVE. `PRICING_PILLAR_ORDER`
              is a constant; the plan's `products` is the catalog. Ungated, the
              hub ladder said "Soon" for a hidden module and this list, directly
              below it, said the same module was included — the contradiction
              this PR removed from the ladder and the price cards.

              The count is counted for the same reason: "All five" is a fact
              about today's catalog, not about this component. */}
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-label">
            {includedSlugs.length > 0
              ? `All ${includedSlugs.length} modules included`
              : "What's included"}
          </p>
          <ul className="mt-4 space-y-3.5">
            {includedSlugs.map((slug) => {
              const meta = pricingPillar(slug);
              const Icon = meta.icon;
              return (
                <li key={slug} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                    <Icon className="size-3.5 text-brand-strong" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">Peakhour {meta.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {meta.promise}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0 text-brand-strong" strokeWidth={3} aria-hidden />
            One login, one Peaks wallet, one invoice. New modules are included as
            they ship.
          </p>
        </div>
      </div>
    </div>
  );
}
