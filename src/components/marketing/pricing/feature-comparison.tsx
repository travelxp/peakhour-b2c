import { Check, Minus, ChevronDown } from "lucide-react";
import { formatPeaks, type ResolvedProductTier } from "@/lib/pricing";
import { comparisonRows } from "@/lib/pricing-features";

/**
 * The full Pro-vs-Free feature matrix, collapsed behind a disclosure.
 *
 * It used to be the FIRST thing on the page, which asked every visitor to read
 * a thirty-row grid before learning what either plan costs. The cards above now
 * carry the decision; this is the reference someone opens when they want to
 * check one specific thing, so it starts closed and costs nothing until then.
 *
 * A native `<details>` rather than a client accordion: the page is a server
 * component, the content is real markup either way (so it is in the HTML for
 * search and for anyone printing the page), and it works with JS disabled.
 *
 * Rows come from `comparisonRows`, which renames catalog features into customer
 * language, drops plumbing, and merges duplicates. Columns follow the order the
 * tiers arrive in — Pro first, matching the cards.
 *
 * Renders nothing below two columns: a "comparison" of one plan against itself
 * is a feature list, and Presence — which sells a single plan — already has
 * that on its card.
 */
export function FeatureComparison({
  tiers,
  columnLabels,
}: {
  tiers: ResolvedProductTier[];
  /** Public plan names ("Pro", "Free") — index-aligned with `tiers`. */
  columnLabels: string[];
}) {
  if (tiers.length < 2) return null;
  const rows = comparisonRows(tiers);
  const showPeaksRow = tiers.some((t) => typeof t.peaksIncluded === "number");
  if (rows.length === 0 && !showPeaksRow) return null;

  // Growth's plans grant exactly the same capabilities today — the whole
  // difference is the allowance. A grid of matched ticks looks like a rendering
  // fault unless the page says out loud that it isn't one.
  const capabilitiesMatch =
    rows.length > 0 && rows.every((row) => row.included.every(Boolean));

  return (
    <details className="group rounded-3xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-3xl px-5 py-4 text-sm font-bold transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:px-6">
        View full feature comparison
        <ChevronDown
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="overflow-x-auto border-t px-5 pb-5 sm:px-6 sm:pb-6">
        {capabilitiesMatch && (
          <p className="pt-4 text-sm text-muted-foreground">
            Both plans include the same capabilities here — what changes is your
            monthly Peaks, and so how much of it you can run.
          </p>
        )}
        <table className="w-full min-w-120 border-separate border-spacing-0">
          <caption className="sr-only">
            Feature comparison across the {columnLabels.join(" and ")} plans
          </caption>
          <thead>
            <tr>
              <th className="w-[46%] p-0" />
              {tiers.map((tier, i) => (
                <th
                  key={tier.key}
                  scope="col"
                  className={`border-b py-4 text-sm font-bold ${
                    i === 0 ? "text-brand-strong" : ""
                  }`}
                >
                  {columnLabels[i] ?? tier.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showPeaksRow && (
              <tr>
                <th
                  scope="row"
                  className="border-b py-3.5 pr-4 text-left text-sm font-medium"
                >
                  Peaks a month
                </th>
                {tiers.map((tier) => (
                  <td
                    key={tier.key}
                    className="border-b py-3.5 text-center text-sm font-bold tabular-nums"
                    style={{ fontFamily: "var(--font-space-grotesk)" }}
                  >
                    {typeof tier.peaksIncluded === "number"
                      ? formatPeaks(tier.peaksIncluded)
                      : "—"}
                  </td>
                ))}
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.key}>
                <th
                  scope="row"
                  className="border-b py-3.5 pr-4 text-left text-sm font-medium"
                >
                  {row.label}
                </th>
                {row.included.map((included, i) => (
                  <td key={tiers[i].key} className="border-b py-3.5 text-center">
                    {included ? (
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
    </details>
  );
}
