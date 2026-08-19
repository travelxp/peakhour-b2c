import Link from "next/link";
import { Check, Zap } from "lucide-react";
import {
  formatMonthly,
  formatYearly,
  formatPeaks,
  type ResolvedProductTier,
} from "@/lib/pricing";
import { tierGrants } from "@/lib/pricing-features";
import type { PlanHighlight } from "@/lib/pricing-catalog";

/** The signup CTA resolved from the platform stage (see `signupCta`). */
export interface SignupCta {
  label: string;
  href: string;
  disabled?: boolean;
}

/**
 * Display names for the two tiers a pillar sells.
 *
 * The catalog names them for the catalog — "Peakhour.ai Commerce: Paid" — which
 * is right in the CMS and wrong on a price card, both as a heading and inside a
 * CTA ("Get Peakhour.ai Commerce: Paid"). The public plan vocabulary is Pro and
 * Free; the API still decides what each one costs and grants.
 */
const PRO_NAME = "Pro";
const FREE_NAME = "Free";

/** Bullets the tier actually grants, in the order marketing listed them. */
function grantedHighlights(
  tier: ResolvedProductTier,
  highlights: PlanHighlight[],
  limit: number,
): PlanHighlight[] {
  return highlights
    .filter((h) => !h.key || tierGrants(tier, h.key))
    .slice(0, limit);
}

/**
 * A zero price in the currency this visitor is being quoted.
 *
 * The free tier's own `displayPrefix` is not that currency: a plan with no
 * price matrix falls back to the catalog default, so the live response quotes
 * `$` on the free tier of a product whose paid tier is priced in `₹`. Rendering
 * both as they arrive puts "$0" beside "₹1,499" on one row of cards. Zero is
 * zero in every currency, so the symbol comes from the tier that genuinely
 * carries a country-resolved price.
 *
 * With no paid tier there is nothing to ask, and the free tier's own prefix is
 * the same unreliable default — Presence quoted "$0" to an India-resolved
 * visitor. The word is right where the symbol would be a guess.
 */
function zeroPrice(paid?: ResolvedProductTier): string {
  const prefix = paid?.pricing.displayPrefix;
  return prefix ? `${prefix}0` : "Free";
}

/** The Peaks block, deliberately the loudest thing under the price on both cards. */
function PeaksBlock({
  peaks,
  multiple,
  emphasis,
}: {
  peaks: number;
  /** "10×" the free grant — shown on Pro only, and only when it is real. */
  multiple?: number;
  emphasis: boolean;
}) {
  return (
    <div
      className={`mt-6 rounded-2xl border px-4 py-3.5 ${
        emphasis ? "border-brand/40 bg-brand-soft/50" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className="text-2xl font-extrabold tabular-nums tracking-tight"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          {formatPeaks(peaks)}
        </span>
        <span className="text-sm font-bold">Peaks a month</span>
        {multiple !== undefined && (
          <span className="inline-flex items-center rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-bold text-brand-contrast">
            {multiple}× Free
          </span>
        )}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Zap className="size-3.5 shrink-0 text-brand-strong" aria-hidden />
        Peaks power AI actions across Peakhour.
      </p>
    </div>
  );
}

function HighlightList({ items }: { items: PlanHighlight[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-6 space-y-2.5">
      {items.map((h) => (
        <li key={h.key ?? h.label} className="flex items-start gap-2.5 text-sm">
          <Check
            className="mt-0.5 size-4 shrink-0 text-brand-strong"
            strokeWidth={2.5}
            aria-hidden
          />
          <span>{h.label}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanCta({
  cta,
  label,
  primary,
}: {
  cta: SignupCta;
  label: string;
  primary: boolean;
}) {
  if (cta.disabled) {
    return (
      <span
        aria-disabled="true"
        className="mt-6 inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border-2 border-dashed px-4 py-3 text-sm font-bold text-muted-foreground"
      >
        {cta.label}
      </span>
    );
  }
  return (
    <Link
      href={cta.href}
      className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
        primary
          ? "bg-brand-gradient text-brand-contrast shadow-sm"
          : "border-2 hover:border-brand hover:text-brand"
      }`}
    >
      {label}
    </Link>
  );
}

/**
 * The two plans a pillar sells, Pro first.
 *
 * Pro leads and carries the weight — the thin brand border, the "Most popular"
 * label, the filled CTA. Free stays neutral on purpose: it is the low-risk way
 * in, not the loser of a comparison, so it gets the same typography and the
 * same Peaks treatment, just none of the emphasis.
 *
 * Every bullet is grounded — `grantedHighlights` drops any capability the tier
 * does not actually grant, so a catalog change can quietly shorten a card but
 * can never leave it advertising something the plan no longer includes.
 *
 * Server component; the annual price is a subline rather than a toggle, so the
 * whole block stays SSR'd.
 */
export function PlanCards({
  pro,
  free,
  proHighlights,
  freeHighlights,
  cta,
  openSignup,
}: {
  pro?: ResolvedProductTier;
  free?: ResolvedProductTier;
  proHighlights: PlanHighlight[];
  freeHighlights: PlanHighlight[];
  cta: SignupCta;
  openSignup: boolean;
}) {
  if (!pro && !free) return null;

  // Only claim a multiple when both grants are real numbers and Pro is
  // genuinely larger — "1× Free" is noise and a missing allowance is not a 0.
  const proPeaks = pro?.peaksIncluded;
  const freePeaks = free?.peaksIncluded;
  const multiple =
    typeof proPeaks === "number" && typeof freePeaks === "number" && freePeaks > 0
      ? Math.round(proPeaks / freePeaks)
      : undefined;

  return (
    <div
      className={`grid items-start gap-6 ${pro && free ? "lg:grid-cols-2" : "mx-auto max-w-xl"}`}
    >
      {pro && (
        <div className="relative rounded-3xl border border-brand bg-card p-6 shadow-md sm:p-8">
          <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-contrast shadow-sm">
            Most popular
          </span>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-extrabold tracking-tight">{PRO_NAME}</h3>
            <span className="text-xs font-semibold text-brand-label">
              For growing businesses
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span
              className="text-4xl font-extrabold tabular-nums tracking-tight"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              {formatMonthly(pro.pricing)}
            </span>
            <span className="text-sm text-muted-foreground">/month</span>
          </div>
          <p className="mt-1 min-h-5 text-sm text-muted-foreground">
            {pro.pricing.yearly > 0
              ? `${formatYearly(pro.pricing)} billed yearly`
              : ""}
          </p>

          {typeof proPeaks === "number" && (
            <PeaksBlock peaks={proPeaks} multiple={multiple} emphasis />
          )}

          <HighlightList items={grantedHighlights(pro, proHighlights, 6)} />

          <PlanCta cta={cta} label={openSignup ? "Get Pro" : cta.label} primary />
          {/* A paid trial always collects a card up front (product decision
              2026-07-28) — say so here, or the Free card's "No card needed"
              reads as if it covered trials too. */}
          {pro.pricing.trialDays > 0 && (
            <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
              {pro.pricing.trialDays}-day free trial · card required
            </p>
          )}
        </div>
      )}

      {free && (
        <div className="rounded-3xl border bg-card p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-extrabold tracking-tight">{FREE_NAME}</h3>
            <span className="text-xs font-semibold text-muted-foreground">
              {/* Presence sells one plan and always will — calling it the way
                  to "try Peakhour" frames the whole product as a trial. And
                  "Free forever" beside a heading and a price that both already
                  read "Free" is the word three times in one corner. */}
              {pro ? "To try Peakhour" : "No card, no expiry"}
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span
              className="text-4xl font-extrabold tabular-nums tracking-tight"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              {zeroPrice(pro)}
            </span>
            {pro && <span className="text-sm text-muted-foreground">/month</span>}
          </div>
          <p className="mt-1 min-h-5 text-sm text-muted-foreground">No card needed</p>

          {typeof freePeaks === "number" && (
            <PeaksBlock peaks={freePeaks} emphasis={false} />
          )}

          <HighlightList items={grantedHighlights(free, freeHighlights, 4)} />

          <PlanCta
            cta={cta}
            label={openSignup ? "Start free" : cta.label}
            primary={false}
          />
          {/* Only where there is a Pro to move to. Presence sells one plan and
              always will; promising an upgrade it does not offer would be the
              one false line on an otherwise grounded card. */}
          {pro && (
            <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
              <span className="font-bold text-foreground">Upgrade later</span> —
              move to Pro whenever you outgrow it. Your work comes with you.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
