"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
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
import { EmptyState } from "@/components/molecules/empty-state";
import { Archive, Megaphone, Pause, Play, RefreshCw, Rocket } from "lucide-react";

/**
 * Ads Manager (G1 MVP) — the Growth pillar's first live surface.
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

export default function AdsPage() {
  const integrations = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () =>
      api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });

  const adsConnection = useMemo(
    () => integrations.data?.integrations.find((i) => i.provider === "linkedin_ads"),
    [integrations.data],
  );
  const isConnected =
    adsConnection?.connected === true || adsConnection?.status === "needs_reauth";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ad Campaigns</h2>
        <p className="text-muted-foreground">
          Boost your proven LinkedIn posts into campaigns — created as
          non-spending drafts you activate when ready
        </p>
      </div>

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
          action={{ label: "Connect LinkedIn Ads", href: "/dashboard/integrations" }}
        />
      ) : (
        <>
          {adsConnection?.status === "needs_reauth" ? (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
              <CardContent className="flex items-center justify-between gap-4 p-4 text-sm">
                <span>
                  Your LinkedIn Ads connection is{" "}
                  <span className="font-medium">stale</span>. Reconnect to
                  boost posts or change campaigns — the list below still works.
                </span>
                <a
                  href="/dashboard/integrations"
                  className="font-medium text-amber-900 underline underline-offset-4 dark:text-amber-200"
                >
                  Reconnect
                </a>
              </CardContent>
            </Card>
          ) : null}
          <CampaignsPanel />
        </>
      )}
    </div>
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
    const err = campaigns.error;
    const needsReauth = err instanceof ApiError && err.code === "NEEDS_REAUTH";
    return (
      <EmptyState
        icon={RefreshCw}
        title={needsReauth ? "LinkedIn Ads needs a reconnect" : "Couldn't load campaigns"}
        description={
          needsReauth
            ? "Your LinkedIn Ads connection went stale. Reconnect to manage campaigns."
            : "Try refreshing in a moment. If the problem persists, check your LinkedIn Ads connection."
        }
        action={
          needsReauth
            ? { label: "Reconnect", href: "/dashboard/integrations" }
            : undefined
        }
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
          Campaigns are created in LinkedIn as drafts under a paused group —
          they cannot spend until you activate them. Finish audience targeting
          in LinkedIn Campaign Manager before activating; the protective
          monitor auto-pauses any campaign that reaches its total budget.
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
          action: {
            label: "Reconnect",
            onClick: () => { window.location.href = "/dashboard/integrations"; },
          },
        });
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
      } else {
        toast.error("Couldn't update the campaign. Try again in a moment.");
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
            onClick: () => { window.location.href = "/dashboard/integrations"; },
          },
        });
      } else {
        toast.error("Couldn't refresh metrics right now.");
      }
    },
  });

  const busy = status.isPending || sync.isPending;
  const perf = campaign.performance;
  const canActivate =
    ["draft", "review", "paused"].includes(campaign.status) &&
    Boolean(campaign.platformCampaignId && campaign.platformCampaignGroupId);
  const canPause = campaign.status === "active";
  const canArchive = !["archived"].includes(campaign.status);
  const canSync = Boolean(campaign.platformCampaignId);

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

        <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive this campaign?</AlertDialogTitle>
              <AlertDialogDescription>
                Archiving &ldquo;{campaign.name}&rdquo; stops it permanently on
                LinkedIn{campaign.status === "active" ? " (it is currently active)" : ""} —
                archived campaigns can&apos;t be reactivated.
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
                Activating &ldquo;{campaign.name}&rdquo; un-pauses its LinkedIn
                campaign group and submits the campaign for delivery at{" "}
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
                . Make sure its audience targeting is finished in LinkedIn
                Campaign Manager first.
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
