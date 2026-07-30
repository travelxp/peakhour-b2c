"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import {
  toastUnhandledApiError,
  toastAdAccountNotAuthorized,
  toastAdAccountForbidden,
  RECONNECT_NUANCE,
} from "@/lib/toast-errors";
import {
  reconnectHref,
  ADS_LINKEDIN_PATH,
  LINKEDIN_ADS_PROVIDER,
} from "@/lib/integrations-connect";
import {
  linkedInAdsApi,
  type ManagedCampaign,
  type ManagedCampaignStatus,
} from "@/lib/api/linkedin-ads";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdvertisingDeclarationCard } from "@/components/ads/advertising-declaration-card";
import { EmptyState } from "@/components/molecules/empty-state";
import { AlertTriangle, Archive, Megaphone, Pause, Play, RefreshCw, Rocket, Target } from "lucide-react";
import { TargetingDialog, editorTargeting } from "./targeting-dialog";

/**
 * LinkedIn Ads panel (G1 MVP) — the Growth pillar's first live surface,
 * rendered inside the shared Ads hub (`/dashboard/ads?channel=linkedin`).
 * The hub owns the page header, channel selector, and CronToolbar; this
 * component owns everything below it, including its own connection gate.
 *
 * Lists the business's MANAGED campaigns (Peakhour-created via
 * Boost-to-Campaign / the WhatsApp BOOST workflow — all born as
 * non-serving LinkedIn drafts) with live performance, and owns the one
 * spend-enabling action in the product: Activate, behind an explicit
 * confirm. Campaigns created directly in LinkedIn's own Campaign
 * Manager are out of scope here (no import yet).
 */

interface ApiIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
}

/** Reconnect CTAs come back HERE, not to /dashboard/settings — this is the
 *  surface whose work the reconnect was meant to unblock. */
const RECONNECT_HREF = reconnectHref(ADS_LINKEDIN_PATH, LINKEDIN_ADS_PROVIDER);

const STATUS_BADGE: Record<ManagedCampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  paused: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  completed: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  archived: "bg-muted/60 text-muted-foreground",
};

function formatMoney(value: number | undefined, currency?: string): string {
  if (typeof value !== "number") return "—";
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      // Unknown ISO code — fall through to the plain render.
    }
  }
  const rounded = Math.round(value * 100) / 100;
  return currency ? `${currency} ${rounded}` : String(rounded);
}

// channelKey is part of the shared panel signature (see PANELS in the hub);
// this panel owns no search params, so it doesn't need it.
export function LinkedInAdsPanel() {
  const integrations = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () =>
      api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });

  const adsConnection = useMemo(
    () => integrations.data?.integrations?.find((i) => i.provider === "linkedin_ads"),
    [integrations.data],
  );
  const isConnected =
    adsConnection?.connected === true || adsConnection?.status === "needs_reauth";

  return (
    <div className="space-y-6">
      {/* Before the connection gate, deliberately: a revoked connection is a
          state that makes the protective auto-pause fail PERMANENTLY, and the
          gate below renders an EmptyState — which used to hide this warning in
          the one case it matters most. */}
      <SpendAlarmBanner />
      {/* Above the gate for the same reason, plus one of its own: the
          declaration governs every campaign create including the autonomous
          ones, and a business can make it before it connects. Not on
          /dashboard/optimizer — that page is FeatureGate'd on
          growth.optimizer, so a business entitled to ads but not the
          optimizer could boost campaigns and never be able to declare. */}
      <AdvertisingDeclarationCard />
      {integrations.isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : integrations.isError ? (
        <EmptyState
          icon={RefreshCw}
          title="Couldn't check your connections"
          description="We couldn't load your integration status just now. Refresh in a moment — your campaigns are unaffected."
        />
      ) : !isConnected ? (
        <EmptyState
          icon={Megaphone}
          title="Connect LinkedIn Ads to get started"
          description="Connect your LinkedIn ad account, then boost your best organic posts into campaigns from the Content → LinkedIn → Boost tab. Campaigns are created as drafts — nothing spends until you activate it."
          action={{ label: "Connect LinkedIn Ads", href: RECONNECT_HREF }}
        />
      ) : (
        <>
          {adsConnection?.status === "needs_reauth" ? (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
              <CardContent className="flex items-center justify-between gap-4 p-4 text-sm">
                <span>
                  Your LinkedIn Ads connection is{" "}
                  <span className="font-medium">stale</span>. Reconnect to
                  boost posts, sync metrics, or change campaigns — the list
                  below still works.
                </span>
                <Link
                  href={RECONNECT_HREF}
                  className="font-medium text-amber-900 underline underline-offset-4 dark:text-amber-200"
                >
                  Reconnect
                </Link>
              </CardContent>
            </Card>
          ) : null}
          <CampaignsPanel />
        </>
      )}
    </div>
  );
}

/**
 * Campaigns still SERVING past the budget cap the user set.
 *
 * The api derives `spendAlarm` (at/over cap AND still active), which covers
 * both an auto-pause that failed and one that never ran — including the case
 * that makes this the ONLY protection there is: campaigns created through the
 * Ads Manager get no monitor at all, because the monitoring workflow starts
 * only from the WhatsApp BOOST command.
 *
 * Own component, mounted above the connection gate, sharing CampaignsPanel's
 * queryKey (react-query dedupes, so no extra request).
 */
function SpendAlarmBanner() {
  const campaigns = useQuery({
    queryKey: ["linkedin-managed-campaigns"],
    queryFn: () => linkedInAdsApi.managedCampaigns(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const overCap = (campaigns.data?.campaigns ?? []).filter((r) => r.spendAlarm?.overCap);
  if (overCap.length === 0) return null;

  return (
    // role=alert (implies aria-live=assertive): money still going out past a
    // cap is worth interrupting a screen-reader user for.
    <Card role="alert" className="border-destructive/40 bg-destructive/5">
      <CardContent className="space-y-2 p-4 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium text-destructive">
              {overCap.length === 1
                ? "A campaign is still running past its budget cap"
                : `${overCap.length} campaigns are still running past their budget cap`}
            </p>
            <p className="text-muted-foreground">
              LinkedIn may still be spending on{" "}
              {overCap.length === 1 ? "it" : "them"}.{" "}
              <strong className="font-medium text-foreground">
                Pause {overCap.length === 1 ? "it" : "them"} in LinkedIn Campaign Manager
              </strong>{" "}
              — the Pause button here uses the same connection, so if that is
              what failed it will fail again.
            </p>
            <ul className="space-y-1 pt-1">
              {overCap.map((r) => (
                <li key={r._id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{r.name}</span>
                  {" — "}
                  {formatMoney(r.spendAlarm?.spend, r.currency)} of{" "}
                  {formatMoney(r.spendAlarm?.cap, r.currency)}
                  {r.spendAlarm?.reason ? `. ${r.spendAlarm.reason}.` : "."}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignsPanel() {
  const queryClient = useQueryClient();
  const campaigns = useQuery({
    queryKey: ["linkedin-managed-campaigns"],
    queryFn: () => linkedInAdsApi.managedCampaigns(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["linkedin-managed-campaigns"] });

  if (campaigns.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (campaigns.isError) {
    // The list is a pure local read — no reauth special case exists.
    return (
      <EmptyState
        icon={RefreshCw}
        title="Couldn't load campaigns"
        description="Try refreshing in a moment. If the problem persists, check your LinkedIn Ads connection."
      />
    );
  }

  const rows = campaigns.data?.campaigns ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Rocket}
        title="No campaigns yet"
        description="Head to the Boost tab on your LinkedIn content hub — we rank your recent posts by boost-worthiness, and one click turns the winner into a draft campaign."
        action={{ label: "See boost-worthy posts", href: "/dashboard/content/linkedin" }}
      />
    );
  }

  // ROI strip: blended CPQL across campaigns sharing the first row's
  // currency (defensive — a mixed-currency edge must not make the sum
  // lie). Qualified leads are the billable, conservatively-scored ones.
  const stripCurrency = rows.find((r) => r.performance?.qualifiedLeads)?.currency;
  const stripRows = rows.filter((r) => r.currency === stripCurrency);
  const totalQualified = stripRows.reduce(
    (sum, r) => sum + (r.performance?.qualifiedLeads ?? 0),
    0,
  );
  const totalSpend = stripRows.reduce(
    (sum, r) => sum + (r.budget?.spent ?? r.performance?.spend ?? 0),
    0,
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold leading-none">Managed campaigns</h3>
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wide"
            title="Campaigns Peakhour created from your organic posts. All start as non-spending LinkedIn drafts; Activate is the only action that starts spend."
          >
            Draft-first
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {totalQualified > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-muted/20 px-3 py-2 text-xs">
            <span className="font-medium">Lead ROI</span>
            <span className="tabular-nums">
              {totalQualified} qualified lead{totalQualified === 1 ? "" : "s"}
            </span>
            <span className="tabular-nums">
              CPQL {formatMoney(totalSpend / totalQualified, stripCurrency)}
            </span>
            <span className="text-muted-foreground">
              spend ÷ qualified leads, across {stripCurrency} campaigns — leads land in your Inbox
            </span>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Daily budget</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead
                className="text-right"
                title="Billable qualified leads · cost per qualified lead (spend ÷ qualified leads)"
              >
                Leads · CPQL
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <CampaignRow key={c._id} campaign={c} onChanged={invalidate} />
            ))}
          </TableBody>
        </Table>
        <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
          Campaigns are created in LinkedIn as drafts under a draft group —
          they cannot spend until you activate them. Set the audience with the
          Audience button before activating. Campaigns are watched against
          their total budget and flagged above if spend passes it — automatic
          pausing currently runs only for campaigns started from WhatsApp, so
          treat the flag as your signal to pause in LinkedIn Campaign Manager.
        </p>
      </CardContent>
    </Card>
  );
}

function CampaignRow({
  campaign,
  onChanged,
}: {
  campaign: ManagedCampaign;
  onChanged: () => void;
}) {
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [targetingOpen, setTargetingOpen] = useState(false);

  const status = useMutation({
    mutationFn: (next: "active" | "paused" | "archived") =>
      linkedInAdsApi.setStatus(campaign._id, next),
    onSuccess: (_data, next) => {
      toast.success(
        next === "active"
          ? "Campaign activated — LinkedIn will start delivery once its review passes."
          : next === "paused"
            ? "Campaign paused."
            : "Campaign archived.",
      );
      onChanged();
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "NEEDS_REAUTH" || code === "NOT_CONNECTED") {
        toast.error("LinkedIn Ads needs a reconnect before changing campaigns.", {
          description: RECONNECT_NUANCE,
          action: {
            label: "Reconnect",
            onClick: () => { window.location.href = RECONNECT_HREF; },
          },
        });
      } else if (code === "AD_ACCOUNT_NOT_AUTHORIZED") {
        // A 403 that looks like a token problem and isn't — no Reconnect
        // CTA here, it can't clear it. See toastAdAccountNotAuthorized.
        toastAdAccountNotAuthorized(err, "Changing campaigns");
      } else if (code === "AD_ACCOUNT_FORBIDDEN") {
        // Advertiser-fixable, but in LinkedIn Campaign Manager — so no
        // Reconnect CTA. Deliberately NOT latched like the not-authorised
        // case: once a billing hold is cleared the very same request works,
        // so the button stays live. The helper keeps the request id on the
        // toast — this code is also the api's unattributable-403 catch-all.
        toastAdAccountForbidden(err, "LinkedIn refused this ad account.");
      } else if (code === "INVALID_TRANSITION") {
        toast.error("That status change isn't possible from the campaign's current state.");
        // The row is by definition stale — resync the table.
        onChanged();
      } else if (code === "NO_PLATFORM_ID" || code === "VALIDATION_GROUP_ID_REQUIRED") {
        toast.error(
          "This campaign is missing its LinkedIn identity and can't be changed from here — contact support.",
        );
      } else if (code === "RATE_LIMITED") {
        toast.error("LinkedIn is rate-limiting us — give it a minute and try again.");
      } else if (code === "STATUS_PERSIST_FAILED") {
        // Qualified FAILURE, and the most important message on this
        // surface: the platform change DID apply — for "active" that
        // means LinkedIn is now spending — and only our mirror failed.
        // The server text is hardcoded and says exactly that, so it is
        // shown verbatim; routing this through the generic handler would
        // leave the user unaware that spend had started.
        onChanged();
        toast.warning((err as ApiError).message, { duration: Infinity });
      } else {
        toastUnhandledApiError(err, "update the campaign", "LinkedIn");
      }
    },
  });

  const sync = useMutation({
    mutationFn: () => linkedInAdsApi.syncCampaign(campaign._id),
    onSuccess: () => {
      toast.success("Campaign metrics refreshed.");
      onChanged();
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "NEEDS_REAUTH" || code === "NOT_CONNECTED") {
        toast.error("LinkedIn Ads needs a reconnect before syncing metrics.", {
          action: {
            label: "Reconnect",
            onClick: () => { window.location.href = RECONNECT_HREF; },
          },
        });
      } else if (code === "AD_ACCOUNT_NOT_AUTHORIZED") {
        toastAdAccountNotAuthorized(err, "Refreshing metrics");
      } else if (code === "AD_ACCOUNT_FORBIDDEN") {
        toastAdAccountForbidden(err, "LinkedIn refused this ad account.");
      } else if (code === "RATE_LIMITED") {
        toast.error("LinkedIn is rate-limiting us — give it a minute and try again.");
      } else {
        toastUnhandledApiError(err, "refresh the metrics", "LinkedIn");
      }
    },
  });

  const busy = status.isPending || sync.isPending;
  const perf = campaign.performance;
  const canActivate =
    ["draft", "review", "paused"].includes(campaign.status) &&
    Boolean(campaign.platformCampaignId && campaign.platformCampaignGroupId);
  const canPause = campaign.status === "active";
  // Rows without a platform campaign (WhatsApp-approval "review"
  // markers) are workflow-owned: the server 409s NO_PLATFORM_ID on any
  // status change, so offering actions would only produce dead-end
  // errors. They resolve via the WhatsApp flow (or expire to archived).
  const canArchive =
    !["archived"].includes(campaign.status) && Boolean(campaign.platformCampaignId);
  const canSync = Boolean(campaign.platformCampaignId);
  const canTarget =
    Boolean(campaign.platformCampaignId) &&
    !["archived", "completed"].includes(campaign.status);
  // Editor-shaped targeting (workflow rows carry a legacy free-form
  // object instead — feature-detected by the shared helper).
  const hasAudience =
    (editorTargeting(campaign.targeting)?.facets?.locations?.length ?? 0) > 0;

  return (
    <TableRow>
      <TableCell className="max-w-[260px]">
        <p className="truncate text-sm font-medium" title={campaign.name}>
          {campaign.name}
        </p>
        {campaign.schedule?.durationDays ? (
          <p className="text-[11px] text-muted-foreground">
            {campaign.schedule.durationDays}-day flight
          </p>
        ) : null}
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_BADGE[campaign.status] ?? STATUS_BADGE.draft}`}
        >
          {campaign.status}
        </span>
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {formatMoney(campaign.budget?.daily, campaign.currency)}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {formatMoney(campaign.budget?.spent ?? perf?.spend, campaign.currency)}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {perf ? perf.impressions.toLocaleString() : "—"}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {perf ? perf.clicks.toLocaleString() : "—"}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {perf ? `${(perf.ctr * 100).toFixed(2)}%` : "—"}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {perf?.qualifiedLeads
          ? `${perf.qualifiedLeads} · ${formatMoney(
              (campaign.budget?.spent ?? perf.spend ?? 0) / perf.qualifiedLeads,
              campaign.currency,
            )}`
          : "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {canSync ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              disabled={busy}
              title="Refresh live metrics from LinkedIn"
              aria-label="Refresh live metrics from LinkedIn"
              onClick={() => sync.mutate()}
            >
              <RefreshCw className={`size-3 ${sync.isPending ? "animate-spin" : ""}`} />
            </Button>
          ) : null}
          {canTarget ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={busy}
              title={hasAudience ? "Edit audience targeting" : "Set audience targeting (required before the campaign can serve)"}
              onClick={() => setTargetingOpen(true)}
            >
              <Target className="mr-1 size-3" />
              {hasAudience ? "Audience" : "Set audience"}
            </Button>
          ) : null}
          {canActivate ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-7 px-2 text-xs"
              disabled={busy}
              title="Activate — this is the step that starts real ad spend"
              onClick={() => setConfirmActivate(true)}
            >
              <Play className="mr-1 size-3" />
              Activate
            </Button>
          ) : null}
          {canPause ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={busy}
              onClick={() => status.mutate("paused")}
            >
              <Pause className="mr-1 size-3" />
              Pause
            </Button>
          ) : null}
          {canArchive ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              disabled={busy}
              title="Archive campaign (permanent)"
              aria-label="Archive campaign (permanent)"
              onClick={() => setConfirmArchive(true)}
            >
              <Archive className="size-3" />
            </Button>
          ) : null}
        </div>

        {targetingOpen ? (
          <TargetingDialog
            open={targetingOpen}
            onOpenChange={setTargetingOpen}
            campaign={campaign}
          />
        ) : null}

        <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive this campaign?</AlertDialogTitle>
              <AlertDialogDescription>
                Archiving &ldquo;{campaign.name}&rdquo; stops it permanently on
                LinkedIn{campaign.status === "active" ? " (it is currently active)" : ""} —
                archived campaigns can&apos;t be reactivated here or in Campaign
                Manager.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmArchive(false);
                  status.mutate("archived");
                }}
              >
                Archive permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmActivate} onOpenChange={setConfirmActivate}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start spending on this campaign?</AlertDialogTitle>
              <AlertDialogDescription>
                Activating &ldquo;{campaign.name}&rdquo; also activates its
                LinkedIn campaign group and submits the campaign for delivery at{" "}
                <span className="font-medium">
                  {formatMoney(campaign.budget?.daily, campaign.currency)}/day
                </span>
                {typeof campaign.budget?.total === "number" ? (
                  <>
                    {" "}
                    (up to {formatMoney(campaign.budget.total, campaign.currency)}{" "}
                    total — we auto-pause at that cap)
                  </>
                ) : null}
                .{" "}
                {hasAudience
                  ? "Its audience is set — LinkedIn will review, then deliver."
                  : "No audience is set yet — use the Audience button first, or LinkedIn will reject delivery."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Not yet</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmActivate(false);
                  status.mutate("active");
                }}
              >
                Activate &amp; start spend
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
