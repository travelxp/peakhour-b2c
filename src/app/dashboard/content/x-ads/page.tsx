"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Megaphone, Plus } from "lucide-react";
import {
  xAdsApi,
  dollarsToMicros,
  microsToDollars,
  type XCampaign,
} from "@/lib/api/x-ads";

interface ApiIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
}

const ACCOUNT_PARAM = "account";
const ANALYTICS_RANGE_DAYS = 30;

export default function XAdsDashboardPage() {
  const integrations = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () =>
      api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });

  const xAdsConnection = useMemo(
    () => integrations.data?.integrations.find((i) => i.provider === "x_ads"),
    [integrations.data]
  );
  const isConnected = xAdsConnection?.connected === true;

  if (integrations.isLoading) {
    return <PageShell loading />;
  }

  if (!isConnected) {
    return (
      <PageShell>
        <EmptyState
          icon={Megaphone}
          title="Connect X Ads to launch campaigns"
          description="Once connected, you can create and manage promoted-tweet campaigns from here."
          action={{ label: "Connect X Ads", href: "/dashboard/integrations" }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ConnectedView />
    </PageShell>
  );
}

function ConnectedView() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const queryAccountId = params.get(ACCOUNT_PARAM) ?? null;

  const accounts = useQuery({
    queryKey: ["x-ads-accounts"],
    queryFn: () => xAdsApi.listAccounts(),
  });

  // Auto-select first account if none chosen and there's at least one.
  // Depend on the id (a primitive) rather than accounts.data (a fresh array
  // reference on every refetch) so the effect doesn't refire on every refetch.
  const firstAccountId = accounts.data?.[0]?.id;
  useEffect(() => {
    if (!queryAccountId && firstAccountId) {
      const url = new URL(window.location.href);
      url.searchParams.set(ACCOUNT_PARAM, firstAccountId);
      router.replace(url.pathname + url.search);
    }
  }, [queryAccountId, firstAccountId, router]);

  const accountId = queryAccountId ?? firstAccountId ?? null;

  function changeAccount(next: string) {
    const url = new URL(window.location.href);
    url.searchParams.set(ACCOUNT_PARAM, next);
    router.replace(url.pathname + url.search);
  }

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
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
    },
    enabled: !!accountId && (campaigns.data?.length ?? 0) > 0,
  });

  const setStatus = useMutation({
    mutationFn: ({ campaignId, status }: { campaignId: string; status: "ACTIVE" | "PAUSED" }) =>
      xAdsApi.setCampaignStatus(accountId!, campaignId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["x-ads-campaigns", accountId] });
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
          <Select value={accountId ?? undefined} onValueChange={changeAccount}>
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
                      setStatus.mutate({ campaignId: c.id, status: next })
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

function PageShell({ children, loading }: { children?: React.ReactNode; loading?: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">X Ads</h2>
        <p className="text-muted-foreground">
          Launch and manage promoted-tweet campaigns on X.
        </p>
      </div>
      {loading ? <SkeletonStack /> : children}
    </div>
  );
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
