"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/molecules/empty-state";
import { Megaphone, Plus, RefreshCw } from "lucide-react";
import {
  xAdsApi,
  dollarsToMicros,
  microsToDollars,
  type XCampaign,
} from "@/lib/api/x-ads";
import { ADS_CHANNEL_PARAM, type AdsChannelKey } from "../ads-channels";

/**
 * X Ads panel, rendered inside the shared Ads hub
 * (`/dashboard/ads?channel=x`). The hub owns the page header, channel
 * selector, and CronToolbar; this component owns everything below it,
 * including its own connection gate and ad-account selector.
 *
 * Was `/dashboard/content/x-ads` — that route now redirects here.
 */

interface ApiIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
}

const ACCOUNT_PARAM = "account";
const ANALYTICS_RANGE_DAYS = 30;

export function XAdsPanel({ channelKey }: { channelKey: AdsChannelKey }) {
  const integrations = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () =>
      api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });

  const xAdsConnection = useMemo(
    () => integrations.data?.integrations?.find((i) => i.provider === "x_ads"),
    [integrations.data]
  );
  // A stale connection is still a connection — show the panel with a reconnect
  // banner, not the "Connect X Ads" empty state, matching what the hub's
  // channel picker assumes when it counts needs_reauth as connected. NOTE the
  // asymmetry with LinkedIn Ads: its campaign list is a local DB read, so it
  // keeps working while stale, whereas every X list is fetched live through a
  // connection the api requires to be "active" — hence the different banner
  // copy and the accounts error branch below.
  const needsReauth = xAdsConnection?.status === "needs_reauth";
  const isConnected = xAdsConnection?.connected === true || needsReauth;

  if (integrations.isLoading) {
    return <PanelShell loading />;
  }

  // isPending/isLoading are false on error in TanStack v5, so without this an
  // API blip would tell an already-connected customer to "Connect X Ads".
  if (integrations.isError) {
    return (
      <PanelShell>
        <EmptyState
          icon={Megaphone}
          title="Couldn't check your connections"
          description="We couldn't load your integration status just now. Refresh in a moment — your campaigns are unaffected."
        />
      </PanelShell>
    );
  }

  if (!isConnected) {
    return (
      <PanelShell>
        <EmptyState
          icon={Megaphone}
          title="Connect X Ads to launch campaigns"
          description="Once connected, you can create and manage promoted-tweet campaigns from here."
          action={{ label: "Connect X Ads", href: "/dashboard/integrations" }}
        />
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      {needsReauth ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex items-center justify-between gap-4 p-4 text-sm">
            <span>
              Your X Ads connection is <span className="font-medium">stale</span>.
              Reconnect to load your ad accounts and campaigns — unlike LinkedIn
              Ads, X campaigns are read live from X, so nothing lists until the
              connection is refreshed.
            </span>
            <Link
              href="/dashboard/integrations"
              className="font-medium text-amber-900 underline underline-offset-4 dark:text-amber-200"
            >
              Reconnect
            </Link>
          </CardContent>
        </Card>
      ) : null}
      <ConnectedView channelKey={channelKey} />
    </PanelShell>
  );
}

function ConnectedView({ channelKey }: { channelKey: AdsChannelKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const queryAccountId = params.get(ACCOUNT_PARAM) ?? null;

  const accounts = useQuery({
    queryKey: ["x-ads-accounts"],
    queryFn: () => xAdsApi.listAccounts(),
  });

  // Build every URL from useSearchParams, never window.location: the hub
  // writes the same URL (the `channel` param), and router navigation commits in
  // a transition, so a window.location read can still hold the superseded URL —
  // this effect would then clobber a channel switch the user just made.
  //
  // isActiveChannel covers the OTHER window: on a cold load the hub is still
  // pinning `?channel=` while this panel is already mounted, and writing
  // `account` from those param-less searchParams would drop the channel the pin
  // is about to add. (A switch AWAY from X is handled by the hub unmounting this
  // panel synchronously via its pendingChannel state, not by this guard.)
  const isActiveChannel = params.get(ADS_CHANNEL_PARAM) === channelKey;
  const setAccountParam = useCallback(
    (next: string) => {
      const search = new URLSearchParams(params.toString());
      search.set(ACCOUNT_PARAM, next);
      router.replace(`${pathname}?${search.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Auto-select first account if none chosen and there's at least one.
  // Depend on the id (a primitive) rather than accounts.data (a fresh array
  // reference on every refetch) so the effect doesn't refire on every refetch.
  const firstAccountId = accounts.data?.[0]?.id;
  useEffect(() => {
    if (isActiveChannel && !queryAccountId && firstAccountId) {
      setAccountParam(firstAccountId);
    }
  }, [isActiveChannel, queryAccountId, firstAccountId, setAccountParam]);

  const accountId = queryAccountId ?? firstAccountId ?? null;

  const campaigns = useQuery({
    queryKey: ["x-ads-campaigns", accountId],
    queryFn: () => xAdsApi.listCampaigns(accountId!),
    enabled: !!accountId,
  });

  const analytics = useQuery({
    queryKey: [
      "x-ads-analytics",
      accountId,
      campaigns.data?.map((c) => c.id).join(","),
    ],
    queryFn: () => {
      const ids = (campaigns.data ?? []).map((c) => c.id);
      if (ids.length === 0) {
        return Promise.resolve([]);
      }
      const end = new Date();
      const start = new Date(
        end.getTime() - ANALYTICS_RANGE_DAYS * 24 * 60 * 60 * 1000
      );
      return xAdsApi.analytics({
        accountId: accountId!,
        campaignIds: ids,
        // Date-only: the api validates ^\d{4}-\d{2}-\d{2}$, so a full ISO
        // timestamp 400s and every KPI silently renders "—".
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      });
    },
    enabled: !!accountId && (campaigns.data?.length ?? 0) > 0,
  });

  // Capture accountId in mutation variables (not the outer closure) so a
  // mid-flight account switch can't redirect onSuccess invalidation to the
  // newly-selected account's cache while the response was for the previous one.
  const setStatus = useMutation({
    mutationFn: ({
      accountId: forAccount,
      campaignId,
      status,
    }: {
      accountId: string;
      campaignId: string;
      status: "ACTIVE" | "PAUSED";
    }) => xAdsApi.setCampaignStatus(forAccount, campaignId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["x-ads-campaigns", variables.accountId],
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : "Couldn't update campaign status.";
      toast.error(message);
    },
  });

  const totals = useMemo(() => {
    const list = analytics.data ?? [];
    if (list.length === 0) return null;
    return list.reduce(
      (acc, a) => {
        acc.spend += a.spend;
        acc.impressions += a.impressions;
        acc.engagements += a.engagements;
        return acc;
      },
      { spend: 0, impressions: 0, engagements: 0 }
    );
  }, [analytics.data]);

  const cpe = totals && totals.engagements > 0 ? totals.spend / totals.engagements : null;
  const account = accounts.data?.find((a) => a.id === accountId);

  if (accounts.isLoading) {
    return <SkeletonStack />;
  }

  // A failed fetch is NOT "no ad accounts". /ad-accounts requires a connection
  // with status "active", so a stale (needs_reauth) connection 404s here — and
  // any upstream X error 400s — both of which used to render as "your X account
  // doesn't have any ad accounts", sending the user to ads.x.com for nothing.
  if (accounts.isError) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="Couldn't load your ad accounts"
        description="X didn't return your ad accounts. If your X Ads connection is stale, reconnect it — otherwise try again in a moment."
        action={{ label: "Check connection", href: "/dashboard/integrations" }}
      />
    );
  }

  if ((accounts.data ?? []).length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No ad accounts found"
        description="Your X account doesn't have any ad accounts associated. Set one up at ads.x.com first."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Account selector + KPIs */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Ad account
          </Label>
          <Select value={accountId ?? undefined} onValueChange={setAccountParam}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose an ad account" />
            </SelectTrigger>
            <SelectContent>
              {(accounts.data ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {accountId && (
          <CreateCampaignDialog
            accountId={accountId}
            onCreated={() =>
              queryClient.invalidateQueries({ queryKey: ["x-ads-campaigns", accountId] })
            }
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={`Spend (${ANALYTICS_RANGE_DAYS}d)`}
          value={totals ? formatCurrency(totals.spend, account?.currency) : undefined}
          loading={analytics.isLoading}
        />
        <KpiCard
          title="Impressions"
          value={totals ? compact(totals.impressions) : undefined}
          loading={analytics.isLoading}
        />
        <KpiCard
          title="Engagements"
          value={totals ? compact(totals.engagements) : undefined}
          loading={analytics.isLoading}
        />
        <KpiCard
          title="CPE"
          value={cpe != null ? formatCurrency(cpe, account?.currency) : "—"}
          subtitle="Cost per engagement"
          loading={analytics.isLoading}
        />
      </div>

      {/* Campaigns table */}
      <Card>
        <CardContent className="p-0">
          {campaigns.isLoading ? (
            <div className="p-5">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : campaigns.isError ? (
            // A failed fetch is not "no campaigns". Same trap the ad-accounts
            // list had: telling someone with live campaigns to create their
            // first one. Reachable when the api refuses the chosen account
            // (403) or X is briefly unavailable.
            <div className="p-8">
              <EmptyState
                icon={RefreshCw}
                title="Couldn't load campaigns"
                description="X didn't return this account's campaigns. Try again in a moment, or pick a different ad account."
              />
            </div>
          ) : (campaigns.data ?? []).length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Megaphone}
                title="No campaigns yet"
                description="Create your first campaign to start promoting tweets."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Daily budget</TableHead>
                  <TableHead className="text-right">Spend (30d)</TableHead>
                  <TableHead className="w-24 text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(campaigns.data ?? []).map((c) => (
                  <CampaignRow
                    key={c.id}
                    campaign={c}
                    spend={analytics.data?.find((a) => a.id === c.id)?.spend}
                    currency={account?.currency}
                    onToggle={(next) =>
                      setStatus.mutate({ accountId: accountId!, campaignId: c.id, status: next })
                    }
                    pending={
                      setStatus.isPending && setStatus.variables?.campaignId === c.id
                    }
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Drilldowns into line items, promoted tweets, and per-campaign analytics
        are coming. Pause/resume and campaign creation are live.
      </p>
    </div>
  );
}

function CampaignRow({
  campaign,
  spend,
  currency,
  onToggle,
  pending,
}: {
  campaign: XCampaign;
  spend: number | undefined;
  currency: string | undefined;
  onToggle: (next: "ACTIVE" | "PAUSED") => void;
  pending: boolean;
}) {
  const isActive = campaign.status === "ACTIVE";
  return (
    <TableRow>
      <TableCell className="font-medium">{campaign.name}</TableCell>
      <TableCell>
        <Badge variant={isActive ? "default" : "secondary"}>
          {campaign.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCurrency(microsToDollars(campaign.dailyBudgetAmountLocalMicro), currency)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {spend != null ? formatCurrency(spend, currency) : "—"}
      </TableCell>
      <TableCell className="text-right">
        <Switch
          checked={isActive}
          onCheckedChange={(next) => onToggle(next ? "ACTIVE" : "PAUSED")}
          disabled={pending}
          aria-label={`${isActive ? "Pause" : "Activate"} campaign ${campaign.name}`}
        />
      </TableCell>
    </TableRow>
  );
}

function CreateCampaignDialog({
  accountId,
  onCreated,
}: {
  accountId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fundingId, setFundingId] = useState<string>("");
  const [dailyBudget, setDailyBudget] = useState("10");
  const [error, setError] = useState<string | null>(null);

  const fundingInstruments = useQuery({
    queryKey: ["x-ads-funding", accountId],
    queryFn: () => xAdsApi.listFundingInstruments(accountId),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      xAdsApi.createCampaign({
        accountId,
        name: name.trim(),
        fundingInstrumentId: fundingId,
        dailyBudgetAmountLocalMicro: dollarsToMicros(parseFloat(dailyBudget)),
        status: "PAUSED",
        startTime: new Date().toISOString(),
      }),
    onSuccess: () => {
      setOpen(false);
      setName("");
      setFundingId("");
      setDailyBudget("10");
      setError(null);
      onCreated();
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Failed to create campaign.");
    },
  });

  const dailyDollars = parseFloat(dailyBudget);
  const valid =
    name.trim().length > 0 &&
    fundingId.length > 0 &&
    Number.isFinite(dailyDollars) &&
    dailyDollars > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-1.5" />
          Create campaign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create campaign</DialogTitle>
          <DialogDescription>
            Starts paused so you can attach line items and promoted tweets before going live.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="x-camp-name">Name</Label>
            <Input
              id="x-camp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. April brand awareness"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="x-camp-funding">Funding instrument</Label>
            <Select value={fundingId} onValueChange={setFundingId}>
              <SelectTrigger id="x-camp-funding">
                <SelectValue placeholder={
                  fundingInstruments.isLoading ? "Loading…" : "Choose a funding source"
                } />
              </SelectTrigger>
              <SelectContent>
                {(fundingInstruments.data ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.description} ({f.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="x-camp-budget">Daily budget</Label>
            <Input
              id="x-camp-budget"
              type="number"
              min="1"
              step="1"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              In the funding instrument&apos;s currency. Stored as micros server-side.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="status">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!valid || create.isPending}
            aria-busy={create.isPending}
          >
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Panel-level wrapper. Header + CronToolbar now live in the Ads hub shell. */
function PanelShell({ children, loading }: { children?: React.ReactNode; loading?: boolean }) {
  return <div className="space-y-6">{loading ? <SkeletonStack /> : children}</div>;
}

function SkeletonStack() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  loading,
}: {
  title: string;
  value?: string | number;
  subtitle?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{value ?? "—"}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatCurrency(amount: number, currency: string | undefined): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency ?? "$"} ${amount.toFixed(2)}`;
  }
}
