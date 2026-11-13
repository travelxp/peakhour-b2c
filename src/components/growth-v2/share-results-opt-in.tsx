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
  // While an answer is in flight the box shows the answer being recorded, not the status it replaces.
  const checked = consent.isPending && consent.variables !== undefined ? consent.variables : isSharing(status.data);
  return (
    <ShareResultsView
      checked={checked}
      busy={status.isPending || consent.isPending}
      error={consent.isError ? "We could not save that. Please try again." : undefined}
      onChange={(share) => consent.mutate(share)}
    />
  );
}
