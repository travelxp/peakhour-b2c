"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { useCreditsRateCard } from "@/hooks/use-credits";
import { googleAdsApi, type GoogleAdAccount, type GoogleSettableStatus } from "@/lib/api/google-ads";
import {
  GOOGLE_LAUNCH_USE_CASE,
  formatGoogleMoney,
  googleAdsErrorMessage,
  googleAdsNeedsReconnect,
  googleCopyProblem,
  googleCreateNote,
  googleLaunchChargeSentence,
  googleStatusAction,
  googleStatusLabel,
  linesOf,
} from "@/lib/google-ads-view";
import { ADS_CHANNEL_PARAM, getAdsChannel, panelConnection, type AdsChannelKey } from "../ads-channels";

/**
 * ★★G-15 — the Google Ads panel, inside the shared Ads hub
 * (`/dashboard/ads?channel=google`). The hub owns the header, selector and
 * CronToolbar; this owns everything below them.
 *
 * ── WHAT IT DOES ─────────────────────────────────────────────────────────
 *
 * Creates a Google **Search** campaign — one Responsive Search Ad — always
 * PAUSED, lists the business's Google campaigns, and starts or pauses them.
 * Every call goes through the managed routes (`lib/google-ads-surface.ts`),
 * so each campaign is an `ad_campaigns` row the monitor, the spend caps and
 * the kill switch see from the start (G-09).
 *
 * ★THE LIST IS OUR ROWS, like LinkedIn's, not a live read from Google: a
 * create that Google has not confirmed is a row here before it is a campaign
 * there, and the panel says so ("don't create it again").
 *
 * ★STARTING IS THE LAUNCH: Google refuses a campaign with no location or
 * keyword, which the audience step (`/dashboard/ads` → Audience, G-06)
 * writes; the api answers why, and the panel shows it.
 *
 * ⏸SEARCH ONLY. The api creates Search campaigns and nothing else, so this
 * panel names no other campaign type (the plan's G-15 row).
 */

const ACCOUNT_PARAM = "customer";
const LIST_STALE_MS = 60_000;

interface ApiIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
  account?: { extra?: Record<string, unknown> };
}

export function GoogleAdsPanel({ channelKey }: { channelKey: AdsChannelKey }) {
  const integrations = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () => api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });
  // The one rule every panel reads (D-03b): shown when connected or stale.
  const { isConnected, needsReauth } = useMemo(
    () => panelConnection(integrations.data?.integrations ?? [], getAdsChannel("google")),
    [integrations.data],
  );

  if (integrations.isLoading) return <SkeletonStack />;
  if (integrations.isError) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Couldn't check your connections"
        description="We couldn't load your integration status just now. Refresh in a moment — your campaigns are unaffected."
      />
    );
  }
  if (!isConnected) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Connect Google Ads to run Search campaigns"
        description="Connect the Google account that manages your Google Ads, and you can create Search campaigns here — always paused until you start them."
        action={{ label: "Connect Google Ads", href: "/dashboard/integrations" }}
      />
    );
  }
  return (
    <div className="space-y-6">
      {needsReauth ? <ReconnectBanner /> : null}
      <ConnectedView channelKey={channelKey} />
    </div>
  );
}

function ReconnectBanner() {
  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="flex items-center justify-between gap-4 p-4 text-sm">
        <span>
          Your Google Ads connection is <span className="font-medium">stale</span>. Starting, pausing and creating
          campaigns need it reconnected.
        </span>
        <Link href="/dashboard/integrations" className="font-medium text-warning-on-tint underline underline-offset-4">
          Reconnect
        </Link>
      </CardContent>
    </Card>
  );
}

function ConnectedView({ channelKey }: { channelKey: AdsChannelKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryAccountId = params.get(ACCOUNT_PARAM);

  const accounts = useQuery({
    queryKey: ["google-ads-accounts"],
    queryFn: () => googleAdsApi.listAdAccounts(),
    retry: false,
    staleTime: LIST_STALE_MS,
  });

  // The X and Meta panels' rule: build the URL from useSearchParams, and write
  // nothing until the hub has pinned `?channel=`.
  const isActiveChannel = params.get(ADS_CHANNEL_PARAM) === channelKey;
  const setAccountParam = useCallback(
    (next: string) => {
      const search = new URLSearchParams(params.toString());
      search.set(ACCOUNT_PARAM, next);
      router.replace(`${pathname}?${search.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const list = accounts.data?.adAccounts;
  const firstAccountId = list?.[0]?.id;
  // A `?customer=` that is not in the list is ignored, not trusted.
  const known = list?.some((a) => a.id === queryAccountId) ? queryAccountId : null;
  useEffect(() => {
    if (isActiveChannel && !known && firstAccountId) setAccountParam(firstAccountId);
  }, [isActiveChannel, known, firstAccountId, setAccountParam]);
  const accountId = known ?? firstAccountId ?? null;
  const account = list?.find((a) => a.id === accountId);

  if (accounts.isLoading) return <SkeletonStack />;
  // A failed read is NOT "no ad accounts".
  if (accounts.isError) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="Couldn't load your Google Ads accounts"
        description={googleAdsErrorMessage(accounts.error, "Google Ads didn't return your accounts. Try again in a moment.")}
        action={googleAdsNeedsReconnect(accounts.error) ? { label: "Check connection", href: "/dashboard/integrations" } : undefined}
      />
    );
  }
  if ((list ?? []).length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No Google Ads accounts found"
        description="The Google account you connected manages no Google Ads accounts. Create one in Google Ads, then reconnect."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Google Ads account</Label>
        <Select value={accountId ?? undefined} onValueChange={setAccountParam}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Choose an account" />
          </SelectTrigger>
          <SelectContent>
            {(list ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
                {a.currencyCode ? ` (${a.currencyCode})` : ""}
                {a.testAccount ? " — test account" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {account ? (
        <>
          <CampaignsSection account={account} />
          <CreateCampaignCard account={account} />
        </>
      ) : null}
    </div>
  );
}

// ── Campaigns ────────────────────────────────────────────────────────────

function CampaignsSection({ account }: { account: GoogleAdAccount }) {
  const queryClient = useQueryClient();
  const rateCard = useCreditsRateCard();
  const launchRow = rateCard.data?.useCases.find((u) => u.useCase === GOOGLE_LAUNCH_USE_CASE);

  const campaigns = useQuery({
    queryKey: ["google-ads-campaigns"],
    queryFn: () => googleAdsApi.listCampaigns(),
    retry: false,
    staleTime: LIST_STALE_MS,
  });
  const rows = useMemo(
    () => (campaigns.data?.campaigns ?? []).filter((c) => c.adAccountId === undefined || c.adAccountId === account.id),
    [campaigns.data, account.id],
  );

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: GoogleSettableStatus }) => googleAdsApi.setStatus(v.id, v.status),
    onSuccess: (_d, v) => {
      toast.success(v.status === "ACTIVE" ? "Campaign started on Google Ads." : "Campaign paused on Google Ads.");
      void queryClient.invalidateQueries({ queryKey: ["google-ads-campaigns"] });
    },
    onError: (err) => toast.error(googleAdsErrorMessage(err, "Google Ads didn't take that change. Try again in a moment.")),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search campaigns</CardTitle>
        <CardDescription>{googleLaunchChargeSentence(launchRow)}</CardDescription>
      </CardHeader>
      <CardContent>
        {campaigns.isLoading ? (
          <SkeletonStack />
        ) : campaigns.isError ? (
          <p className="text-sm text-destructive-on-tint">
            {googleAdsErrorMessage(campaigns.error, "We couldn't load your Google campaigns. Try again in a moment.")}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Search campaigns yet. Create one below — it starts paused.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Daily budget</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const action = googleStatusAction(c);
                const note = googleCreateNote(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {note ? <div className="text-xs text-muted-foreground">{note}</div> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{googleStatusLabel(c)}</Badge>
                    </TableCell>
                    <TableCell>{formatGoogleMoney(c.budget?.daily, c.currency ?? account.currencyCode)}</TableCell>
                    <TableCell className="text-right">
                      {action.status ? (
                        <Button
                          size="sm"
                          variant={action.status === "ACTIVE" ? "default" : "outline"}
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: c.id, status: action.status })}
                        >
                          {action.label}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{action.reason}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Create ───────────────────────────────────────────────────────────────

function CreateCampaignCard({ account }: { account: GoogleAdAccount }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [typedCurrency, setTypedCurrency] = useState("");
  const [headlines, setHeadlines] = useState("");
  const [descriptions, setDescriptions] = useState("");
  const [finalUrl, setFinalUrl] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notPolitical, setNotPolitical] = useState(false);
  // The account's own billing currency when the connection recorded it (the
  // api refuses any other, CURRENCY_MISMATCH); typed only when it did not.
  const currency = account.currencyCode ?? typedCurrency;

  const searchAd = { headlines: linesOf(headlines), descriptions: linesOf(descriptions), finalUrl: finalUrl.trim() };
  const amount = Number(budget);
  const copyProblem = googleCopyProblem(searchAd);
  const problem =
    name.trim().length === 0
      ? "Name the campaign."
      : !(amount > 0)
        ? "Set a daily budget above zero."
        : !/^[A-Za-z]{3}$/.test(currency)
          ? "Set the budget's three-letter currency."
          : copyProblem;

  const create = useMutation({
    mutationFn: () =>
      googleAdsApi.createCampaign({
        adAccountId: account.id,
        name: name.trim(),
        dailyBudget: { amount, currencyCode: currency.toUpperCase() },
        searchAd,
        ...(endDate ? { endsAt: new Date(`${endDate}T23:59:59`).toISOString() } : {}),
        ...(notPolitical ? { notPolitical: true } : {}),
      }),
    onSuccess: (res) => {
      if (res.pending) {
        toast.warning(res.message ?? "Google Ads didn't confirm the campaign yet. We'll check within the hour — don't create it again.");
      } else {
        toast.success("Search campaign created, paused. Start it when you're ready.");
        setOpen(false);
      }
      void queryClient.invalidateQueries({ queryKey: ["google-ads-campaigns"] });
    },
    onError: (err) => toast.error(googleAdsErrorMessage(err, "We couldn't create the campaign. Try again in a moment.")),
  });

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        New Search campaign
      </Button>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>New Search campaign</CardTitle>
        <CardDescription>
          One text ad shown on Google Search. It is created paused and spends nothing until you start it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Campaign name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </Field>
        <div className="flex gap-4">
          <Field label="Daily budget">
            <Input type="number" min="0" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-40" />
          </Field>
          <Field label="Currency">
            <Input value={currency} onChange={(e) => setTypedCurrency(e.target.value)} maxLength={3} className="w-24" disabled={!!account.currencyCode} />
          </Field>
          <Field label="End date (optional)">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-44" />
          </Field>
        </div>
        <Field label="Headlines — one per line, 3 to 15, up to 30 characters each">
          <Textarea rows={4} value={headlines} onChange={(e) => setHeadlines(e.target.value)} />
        </Field>
        <Field label="Descriptions — one per line, 2 to 4, up to 90 characters each">
          <Textarea rows={3} value={descriptions} onChange={(e) => setDescriptions(e.target.value)} />
        </Field>
        <Field label="Landing page">
          <Input value={finalUrl} onChange={(e) => setFinalUrl(e.target.value)} placeholder="https://" />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={notPolitical} onCheckedChange={(v) => setNotPolitical(v === true)} />
          <span>
            This campaign is not political advertising. Google asks every campaign to declare it; we never declare it for
            you.
          </span>
        </label>
        {problem ? <p className="text-sm text-muted-foreground">{problem}</p> : null}
        <div className="flex gap-2">
          <Button disabled={!!problem || create.isPending} onClick={() => create.mutate()}>
            Create paused
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SkeletonStack() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
