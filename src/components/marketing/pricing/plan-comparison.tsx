import Link from "next/link";
import { Check, Minus } from "lucide-react";
import {
  formatMonthly,
  formatYearly,
  featureLabel,
  type ResolvedProductTier,
} from "@/lib/pricing";

/** The signup CTA resolved from the platform stage (see `signupCta`). */
export interface SignupCta {
  label: string;
  href: string;
  disabled?: boolean;
}

/**
 * The per-pillar plan comparison — a data-driven Free-vs-Paid matrix. Columns
 * are the product's own tiers (bundle plans removed upstream by `productTiers`),
 * cheapest-first so Free leads. Rows are the union of every feature any tier
 * grants, with a leading Peaks-allowance row; a check means the tier includes
 * that feature. Labels prefer the catalog's own `featureDetails.name` and fall
 * back to `featureLabel(key)` so an unmapped key never renders raw.
 *
 * The tier CTAs follow the platform stage: when signup is `open` each column
 * shows its own action ("Start free" / "Get Paid"); otherwise they mirror the
 * platform CTA ("Join the waitlist"), and collapse to a disabled "Launching
 * soon" when signup is closed — never a working link into a closed funnel.
 *
 * Server component — no client state. Annual pricing is shown as a subline
 * rather than an interactive toggle, so the table stays fully SSR'd.
 */
export function PlanComparison({
  tiers,
  cta,
  openSignup,
}: {
  tiers: ResolvedProductTier[];
  cta: SignupCta;
  openSignup: boolean;
}) {
  if (tiers.length === 0) return null;

  // Label lookup across every tier's catalog detail, then the ordered union of
  // feature keys (first-seen order, cheapest tier first) for the row list.
  const labelByKey = new Map<string, string>();
  for (const tier of tiers) {
    for (const detail of tier.featureDetails ?? []) {
      if (!labelByKey.has(detail.key)) labelByKey.set(detail.key, detail.name);
    }
  }
  const orderedKeys: string[] = [];
  const seen = new Set<string>();
  for (const tier of tiers) {
    for (const key of tier.features) {
      if (!seen.has(key)) {
        seen.add(key);
        orderedKeys.push(key);
      }
    }
  }
  const tierFeatureSets = tiers.map((t) => new Set(t.features));
  const showPeaksRow = tiers.some((t) => typeof t.peaksIncluded === "number");

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-140 border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="w-[38%] p-0 align-bottom" />
            {tiers.map((tier) => {
              const isFree = tier.pricing.monthly === 0;
              const rec = tier.highlightAsRecommended;
              return (
                <th
                  key={tier.key}
                  scope="col"
                  className={`relative border-b p-5 text-left align-top ${
                    rec ? "rounded-t-2xl bg-brand-soft/60" : ""
                  }`}
                >
                  {rec && (
                    <span className="absolute -top-3 left-5 inline-flex items-center rounded-full bg-brand-gradient px-2.5 py-0.5 text-[11px] font-bold text-brand-contrast shadow-sm">
                      Recommended
                    </span>
                  )}
                  <div className="text-base font-bold tracking-tight">{tier.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span
                      className="text-3xl font-extrabold tabular-nums tracking-tight"
                      style={{ fontFamily: "var(--font-space-grotesk)" }}
                    >
                      {isFree ? "Free" : formatMonthly(tier.pricing)}
                    </span>
                    {!isFree && (
                      <span className="text-sm text-muted-foreground">/mo</span>
                    )}
                  </div>
                  <div className="mt-1 min-h-4 text-xs text-muted-foreground">
                    {!isFree && tier.pricing.yearly > 0
                      ? `${formatYearly(tier.pricing)} billed yearly`
                      : isFree
                        ? "No card needed"
                        : ""}
                  </div>
                  {cta.disabled ? (
                    <span
                      aria-disabled="true"
                      className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border-2 border-dashed px-4 py-2.5 text-sm font-bold text-muted-foreground"
                    >
                      {cta.label}
                    </span>
                  ) : (
                    <Link
                      href={cta.href}
                      className={`mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                        rec
                          ? "bg-brand-gradient text-brand-contrast shadow-sm"
                          : "border-2 hover:border-brand hover:text-brand"
                      }`}
                    >
                      {openSignup
                        ? isFree
                          ? "Start free"
                          : `Get ${tier.name}`
                        : cta.label}
                    </Link>
                  )}
                  {!isFree && tier.pricing.trialDays > 0 && (
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      {tier.pricing.trialDays}-day free trial
                    </p>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {showPeaksRow && (
            <tr>
              <th
                scope="row"
                className="border-b py-3.5 pr-4 text-left text-sm font-medium"
              >
                AI credits (Peaks) / month
              </th>
              {tiers.map((tier) => (
                <td
                  key={tier.key}
                  className={`border-b py-3.5 text-center text-sm font-bold tabular-nums ${
                    tier.highlightAsRecommended ? "bg-brand-soft/40" : ""
                  }`}
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {typeof tier.peaksIncluded === "number"
                    ? tier.peaksIncluded.toLocaleString()
                    : "—"}
                </td>
              ))}
            </tr>
          )}
          {orderedKeys.map((key) => (
            <tr key={key}>
              <th
                scope="row"
                className="border-b py-3.5 pr-4 text-left text-sm font-medium"
              >
                {labelByKey.get(key) ?? featureLabel(key)}
              </th>
              {tiers.map((tier, i) => (
                <td
                  key={tier.key}
                  className={`border-b py-3.5 text-center ${
                    tier.highlightAsRecommended ? "bg-brand-soft/40" : ""
                  }`}
                >
                  {tierFeatureSets[i].has(key) ? (
                    <Check
                      className="mx-auto size-4 text-brand-strong"
                      strokeWidth={2.5}
                      aria-label="Included"
                    />
                  ) : (
                    <Minus
                      className="mx-auto size-4 text-muted-foreground/40"
                      aria-label="Not included"
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
