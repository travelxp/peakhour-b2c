"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { driveAbilities } from "@/lib/drive/files-state";
import { isSharing, usePinConsent, usePinStatus } from "@/lib/api/pin";
import { useAuth } from "@/providers/auth-provider";

/**
 * First run's opt-in to the shared network (PL-6, C-PL6-4): UNTICKED unless this business already shares. Ticking records
 * the consent through the same ledger the Shopify app's Benchmarks page writes; not ticking changes nothing. Unticking a box
 * that was ticked withdraws, so the box never says something the ledger does not.
 *
 * ★THE LABEL IS THE CONSENT TEXT THE API SERVES, under the version the answer is recorded with (the api's one table of
 * consent texts), never a copy kept here. ★ADMIN OR OWNER ONLY, like the api: for anyone else the box is off with the
 * reason, as SUM-5's Ask button is for a viewer.
 */

export const SHARE_EXPLAINER = "Only shown once at least 20 similar businesses take part. No business is ever named.";
/** Why the box is off for an editor or viewer. The api refuses their answer with 403, so the box says so instead of failing. */
export const ADMIN_ONLY = "Sharing your business's results is an owner's choice, so it takes an admin or owner. Ask one of them to decide.";

export interface ShareResultsViewProps {
  /** The consent text, as the api serves it; absent until the status loads. */
  label?: string;
  checked: boolean;
  /** The status has not loaded yet, or an answer is being recorded. */
  busy?: boolean;
  /** Why this user cannot answer (a role below admin); the box is off and says so. */
  blockedReason?: string;
  error?: string;
  onChange: (share: boolean) => void;
}

export function ShareResultsView(p: ShareResultsViewProps) {
  const off = p.busy || p.blockedReason !== undefined || p.label === undefined;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 py-3">
      {/* A disabled control shows no tooltip of its own, so the reason sits on a wrapper (hover) and is read out by the box. */}
      <span title={p.blockedReason} className="inline-flex">
        <Checkbox
          id="first-run-share"
          checked={p.checked}
          disabled={off}
          onCheckedChange={(v) => p.onChange(v === true)}
          aria-describedby={p.blockedReason ? "first-run-share-admin-only" : undefined}
          className="mt-0.5"
        />
      </span>
      <div className="min-w-0">
        {/* Until the api's words load the box is off and shows none: a placeholder would be words nobody consents to. */}
        <label htmlFor="first-run-share" className="text-sm font-medium">
          {p.label ?? ""}
        </label>
        <p className="text-xs text-muted-foreground">{SHARE_EXPLAINER}</p>
        {p.blockedReason ? (
          <p id="first-run-share-admin-only" className="text-xs text-muted-foreground">
            {p.blockedReason}
          </p>
        ) : null}
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
  const { org, orgs } = useAuth();
  const role = orgs?.find((o) => o._id === org?._id)?.role;
  const status = usePinStatus();
  const consent = usePinConsent("first_run");
  const offer = status.data?.consent;
  // While an answer is in flight, and once it is recorded, the box shows that answer, not the status it replaced (a
  // re-read that fails after a save must not flip the box back to what the ledger no longer says).
  const answered = (consent.isPending || consent.isSuccess) && consent.variables !== undefined;
  const checked = answered ? consent.variables!.share : isSharing(status.data);
  // A status that could not be read blocks the box only when there is no answer to show at all.
  const unknown = status.isError && status.data === undefined && !answered;
  // The api's own answer when it gave one; the org role otherwise (the same hierarchy the api enforces).
  const canAnswer = offer ? offer.canAnswer : driveAbilities(role).isAdmin;
  return (
    <ShareResultsView
      label={offer?.text}
      checked={checked}
      busy={status.isPending || unknown || consent.isPending}
      blockedReason={canAnswer ? undefined : ADMIN_ONLY}
      error={
        unknown
          ? "We could not check whether you share your results. Reload the page to try again."
          : consent.isError
            ? "We could not save that. Please try again."
            : undefined
      }
      onChange={(share) => {
        if (offer) consent.mutate({ share, version: offer.version });
      }}
    />
  );
}
