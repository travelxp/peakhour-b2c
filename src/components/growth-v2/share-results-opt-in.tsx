"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { isSharing, usePinConsent, usePinStatus } from "@/lib/api/pin";

/**
 * First run's opt-in to the shared network (PL-6, C-PL6-4): UNTICKED unless this business already shares. Ticking records
 * the consent through the same ledger the Shopify app's Benchmarks page writes; not ticking changes nothing. Unticking a box
 * that was ticked withdraws, so the box never says something the ledger does not.
 */

export const SHARE_LABEL = "Share my results, anonymised, so Peakhour can compare me with similar businesses";
export const SHARE_EXPLAINER = "Only shown once at least 20 similar businesses take part. No business is ever named.";

export interface ShareResultsViewProps {
  checked: boolean;
  /** The status has not loaded yet, or an answer is being recorded. */
  busy?: boolean;
  error?: string;
  onChange: (share: boolean) => void;
}

export function ShareResultsView(p: ShareResultsViewProps) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 py-3">
      <Checkbox id="first-run-share" checked={p.checked} disabled={p.busy} onCheckedChange={(v) => p.onChange(v === true)} className="mt-0.5" />
      <div className="min-w-0">
        <label htmlFor="first-run-share" className="text-sm font-medium">
          {SHARE_LABEL}
        </label>
        <p className="text-xs text-muted-foreground">{SHARE_EXPLAINER}</p>
        {p.error ? (
          <p role="alert" className="text-xs text-destructive-on-tint">
            {p.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ShareResultsOptIn() {
  const status = usePinStatus();
  const consent = usePinConsent("first_run");
  // While an answer is in flight, and once it is recorded, the box shows that answer, not the status it replaced (a
  // re-read that fails after a save must not flip the box back to what the ledger no longer says).
  const answered = (consent.isPending || consent.isSuccess) && consent.variables !== undefined;
  const checked = answered ? consent.variables! : isSharing(status.data);
  // A status that could not be read blocks the box only when there is no answer to show at all.
  const unknown = status.isError && status.data === undefined && !answered;
  // ★A FAILED STATUS READ IS NOT "NOT SHARING": an unticked box would tell a business that shares that it does not, and a
  // tick would write a needless second opt-in. The box stays disabled and says why.
  return (
    <ShareResultsView
      checked={checked}
      busy={status.isPending || unknown || consent.isPending}
      error={
        unknown
          ? "We could not check whether you share your results. Reload the page to try again."
          : consent.isError
            ? "We could not save that. Please try again."
            : undefined
      }
      onChange={(share) => consent.mutate(share)}
    />
  );
}
