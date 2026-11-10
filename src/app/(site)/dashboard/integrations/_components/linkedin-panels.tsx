"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/molecules/status-badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, AlertCircle, ExternalLink, RefreshCw, Loader2, Settings2 } from "lucide-react";
import { LinkedinIcon } from "@/components/brand/brand-icons";
import { ManagePagesDialog } from "./manage-pages-dialog";
import { BRAND_COLORS } from "@/components/brand/brand-colors";

// Auto-poll cadence for the names-pending state: 10 sec between
// attempts, max ~8 attempts (~80 sec) before giving up. peakhour-api's
// linkedin_post_sync background job typically hydrates names within
// ~1 min of OAuth callback (depends on jobs-runner cron interval), so
// 80 sec gives us a comfortable margin.
const NAMES_POLL_INTERVAL_MS = 10_000;

const NAMES_POLL_MAX_ATTEMPTS = 8;

export function LinkedInContentPages({
  extra,
  onRefresh,
  refreshing,
  onChanged,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any>;
  onRefresh: () => void;
  refreshing: boolean;
  onChanged?: () => void;
}) {
  const pages = Array.isArray(extra?.pages) ? extra.pages : [];
  // Deep link from the post-connect "choose your Company Page" prompt
  // (settings banner → /dashboard/integrations?manage_pages=1). Lazy
  // initializer, not an effect: this card mounts only after the
  // connections fetch resolves, so pages are already present — and
  // closing the dialog must not re-open it.
  const searchParams = useSearchParams();
  const [manageOpen, setManageOpen] = useState(
    () => searchParams?.get("manage_pages") === "1" && pages.length > 0,
  );

  // The OAuth callback skips per-Page name hydration to redirect fast
  // (peakhour-api PR #247). Names land within ~1 min via a background
  // job. Detect the "pages exist but all unnamed" state and:
  // 1. Show a "Fetching Page names from LinkedIn…" indicator so the
  // user sees it's an in-progress operation, not a bug
  // 2. Auto-poll /refresh every 10 sec until names arrive (capped at
  //      ~80 sec to avoid hammering the API if the background job
  // stalls — user can still click Refresh manually after that)
  const namesPending =
    pages.length > 0 &&
    pages.every(
      (p: { organizationName?: string }) => !p.organizationName,
    );
  const [attempts, setAttempts] = useState(0);

  // Latest-ref pattern: the parent passes a fresh `onRefresh` closure
  // on every render (it's an inline `() => handleRefresh(provider)`),
  // so depending on it directly would re-fire the effect on every
  // parent re-render and reset the polling timer forever. Hold the
  // latest ref and keep the effect depending only on real state.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  // Reset attempt count once names land — if the user later
  // disconnects + reconnects, the pending state re-opens with a
  // fresh budget. Done during render (React's derive-state pattern)
  // rather than in the effect below, which must not set state
  // synchronously.
  if (!namesPending && attempts !== 0) setAttempts(0);

  useEffect(() => {
    if (!namesPending) return;
    if (refreshing) return; // don't pile on while a refresh is in-flight
    if (attempts >= NAMES_POLL_MAX_ATTEMPTS) return;

    const id = setTimeout(() => {
      setAttempts((a) => a + 1);
      onRefreshRef.current();
    }, NAMES_POLL_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [namesPending, refreshing, attempts]);

  const showPollGaveUp = namesPending && attempts >= NAMES_POLL_MAX_ATTEMPTS;

  return (
    <div className="space-y-1.5 rounded-md border border-border/40 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-micro text-muted-foreground">
          {pages.length === 0
            ? "No company pages found"
            : `${pages.length} company page${pages.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-1">
          {pages.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setManageOpen(true)}
              className="h-6 gap-1 px-1.5 text-micro"
            >
              <Settings2 className="h-2.5 w-2.5" />
              Manage
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-6 gap-1 px-1.5 text-micro"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>
      </div>

      <ManagePagesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        extra={extra}
        onChanged={onChanged}
      />

      {namesPending && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-micro text-muted-foreground"
        >
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          <span>
            {showPollGaveUp
              ? "Page names still loading — tap Refresh to retry."
              : "Fetching Page names from LinkedIn…"}
          </span>
        </div>
      )}

      {pages.length > 0 && (
        <ul className="space-y-0.5 text-micro text-muted-foreground">
          {pages.slice(0, 3).map((p: { organizationId: string; organizationName?: string }) => (
            <li key={p.organizationId} className="truncate">
              • {p.organizationName || `Page ${p.organizationId}`}
            </li>
          ))}
          {pages.length > 3 && (
            <li className="italic opacity-70">+ {pages.length - 3} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ── LinkedIn Ads Status — compact badge + detail dialog ─────────────

export function LinkedInAdsStatus({
  extra,
  onRefresh,
  refreshing,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any>; // TODO: type LinkedIn ads extras
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adAccounts: any[] = extra.adAccounts || []; // TODO: type LinkedIn ad accounts

  // Compute issues
  const issues: Array<{
    accountName: string;
    alert: { title: string; message: string; actionUrl?: string; actionLabel?: string };
  }> = [];

  if (adAccounts.length === 0) {
    issues.push({
      accountName: "LinkedIn Ads",
      alert: {
        title: "No Ad Account found",
        message:
          "You need a LinkedIn Ad Account to run campaigns. Create one, then come back and refresh.",
        actionUrl: "https://www.linkedin.com/campaignmanager/new-advertiser",
        actionLabel: "Create Ad Account on LinkedIn",
      },
    });
  } else {
    for (const acc of adAccounts) {
      const serving = acc.servingStatuses || [];
      if (!serving.includes("RUNNABLE")) {
        const alert = getServingAlert(serving);
        if (alert) {
          issues.push({ accountName: acc.name || acc.id, alert });
        }
      }
    }
  }

  const readyCount = adAccounts.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => (a.servingStatuses || []).includes("RUNNABLE"),
  ).length;

  // All good — compact green summary
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-micro text-success-on-tint">
        <CheckCircle className="h-3 w-3 shrink-0" />
        <span>{adAccounts.length} ad account{adAccounts.length !== 1 ? "s" : ""} ready</span>
      </div>
    );
  }

  // Has issues — compact amber badge that opens dialog
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-micro text-warning-on-tint transition-colors hover:bg-warning/20"
      >
        <AlertCircle className="h-3 w-3 shrink-0" />
        <span className="flex-1 text-left font-medium">
          {issues.length} issue{issues.length !== 1 ? "s" : ""} pending action
        </span>
        {readyCount > 0 && (
          <Badge className="bg-success text-success-foreground text-micro px-1 py-0 shrink-0">
            {readyCount} ready
          </Badge>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex" style={{ color: BRAND_COLORS.linkedin }}>
                <LinkedinIcon className="h-5 w-5" />
              </span>
              LinkedIn Ad Accounts
            </DialogTitle>
            <DialogDescription>
              {adAccounts.length} account{adAccounts.length !== 1 ? "s" : ""} found
              {issues.length > 0 && ` · ${issues.length} need${issues.length === 1 ? "s" : ""} attention`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {/* Ready accounts */}
            {adAccounts
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((a: any) => (a.servingStatuses || []).includes("RUNNABLE"))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((acc: any) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm"
                >
                  <span className="font-medium truncate">{acc.name || acc.id}</span>
                  <StatusBadge status="ready" dot className="text-xs shrink-0" />
                </div>
              ))}

            {/* Issues */}
            {issues.map((issue, i) => (
              <div
                key={i}
                className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{issue.accountName}</span>
                  <Badge
                    variant="outline"
                    className="text-micro text-warning-on-tint border-warning/30 px-1.5 py-0 shrink-0"
                  >
                    Action needed
                  </Badge>
                </div>
                <div className="text-xs text-warning-on-tint space-y-1">
                  <p className="font-medium">{issue.alert.title}</p>
                  <p className="leading-relaxed text-muted-foreground">
                    {issue.alert.message}
                  </p>
                  {issue.alert.actionUrl && (
                    <a
                      href={issue.alert.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
                    >
                      {issue.alert.actionLabel}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                onRefresh();
              }}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh status"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getServingAlert(statuses: string[]): {
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
} | null {
  if (statuses.includes("BILLING_HOLD")) {
    return {
      title: "Payment method needed",
      message: "Add a credit card or payment method to your LinkedIn Ad Account to start running campaigns.",
      actionUrl: "https://www.linkedin.com/campaignmanager",
      actionLabel: "Add payment on LinkedIn",
    };
  }
  if (statuses.includes("ACCOUNT_TOTAL_BUDGET_HOLD")) {
    return {
      title: "Budget limit reached",
      message: "Your ad account has reached its total budget limit. Increase the budget to resume campaigns.",
      actionUrl: "https://www.linkedin.com/campaignmanager",
      actionLabel: "Update budget on LinkedIn",
    };
  }
  if (statuses.includes("ACCOUNT_END_DATE_HOLD")) {
    return {
      title: "Account end date passed",
      message: "Your ad account's end date has passed. Extend the date to resume campaigns.",
      actionUrl: "https://www.linkedin.com/campaignmanager",
      actionLabel: "Update end date on LinkedIn",
    };
  }
  if (statuses.includes("STOPPED")) {
    return {
      title: "Account stopped",
      message: "This ad account has been manually stopped. Reactivate it in LinkedIn Campaign Manager to resume.",
      actionUrl: "https://www.linkedin.com/campaignmanager",
      actionLabel: "Reactivate on LinkedIn",
    };
  }
  if (statuses.includes("RESTRICTED_HOLD")) {
    return {
      title: "Account restricted",
      message: "LinkedIn has restricted this ad account. Contact LinkedIn support for more details.",
      actionUrl: "https://www.linkedin.com/help/lms",
      actionLabel: "Contact LinkedIn support",
    };
  }
  if (statuses.includes("INTERNAL_HOLD")) {
    return {
      title: "Temporarily on hold",
      message: "LinkedIn has placed a temporary hold on this account. This usually resolves automatically — try refreshing later.",
    };
  }
  return {
    title: "Not ready to serve",
    message: "This account isn't ready to run ads yet. Check LinkedIn Campaign Manager for details.",
    actionUrl: "https://www.linkedin.com/campaignmanager",
    actionLabel: "Check on LinkedIn",
  };
}

// ── Manage Pages dialog ────────────────────────────────────────────
//
// Per-page on/off switches backed by PATCH /v1/integrations/linkedin_content/pages.
// The endpoint enforces the org's plan cap server-side and returns 429
// PLAN_LIMIT_REACHED on toggle-on at the cap — we surface that as a
// disabled switch + tooltip pointing at /dashboard/settings/billing.
// Toggle-off is always allowed so legacy over-cap rows can trim down.
