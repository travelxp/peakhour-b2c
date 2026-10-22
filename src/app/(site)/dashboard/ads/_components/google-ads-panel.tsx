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
import { EmptyState } from "@/components/molecules/empty-state";
import { useCreditsRateCard } from "@/hooks/use-credits";
import { googleAdsApi, type GoogleAdAccount, type GoogleCampaign, type GoogleSettableStatus } from "@/lib/api/google-ads";
import {
  GOOGLE_LAUNCH_USE_CASE,
  formatGoogleMoney,
  googleAdsErrorMessage,
  googleAdsNeedsReconnect,
  googleCreateMayExist,
  googleCreateProblem,
  localIsoDay,
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
 * ★★NOTHING HERE INVITES A SECOND CREATE (review rounds 1–2). A 202, or a
 * failure the api marks as possibly sent (`googleCreateMayExist`), closes and
 * clears the form; every create refreshes the list, so the row — and its "don't create it again"
 * note — is what the merchant sees next. A second create would be a second
 * campaign on Google.
 *
 * ★STARTING IS THE LAUNCH, and is confirmed first (round 1, as LinkedIn's):
 * it is charged once and starts spend. Google refuses a campaign with no
 * location or keyword, which the audience step (G-06) writes; the api says so.
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

  // An account with no id cannot be chosen (a Select item may not be empty).
  const list = accounts.data?.adAccounts.filter((a) => a.id.length > 0);
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
          {/* Keyed by account: switching accounts starts a fresh, empty form. */}
          <CreateCampaignCard key={account.id} account={account} />
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
  const chargeSentence = googleLaunchChargeSentence(launchRow);
  const [confirming, setConfirming] = useState<GoogleCampaign | null>(null);

  const campaigns = useQuery({
    queryKey: ["google-ads-campaigns"],
    queryFn: () => googleAdsApi.listCampaigns(),
    retry: false,
    staleTime: LIST_STALE_MS,
  });
  const rows = useMemo(
    // ★THIS ACCOUNT'S ROWS ONLY (round 3): a row with no account would show
    //  under every account, in whichever currency was selected.
    () => (campaigns.data?.campaigns ?? []).filter((c) => c.adAccountId === account.id),
    [campaigns.data, account.id],
  );

  // ★PER ROW (round 1): one campaign's request in flight must not hold
  //  another's Pause — the one a merchant reaches for when it overspends.
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: GoogleSettableStatus }) => googleAdsApi.setStatus(v.id, v.status),
    onMutate: (v) => setPendingIds((s) => new Set(s).add(v.id)),
    onSettled: (_d, _e, v) => {
      setPendingIds((s) => {
        const next = new Set(s);
        next.delete(v.id);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["google-ads-campaigns"] });
    },
    onSuccess: (_d, v) => toast.success(v.status === "ACTIVE" ? "Campaign started on Google Ads." : "Campaign paused on Google Ads."),
    onError: (err) => toast.error(googleAdsErrorMessage(err, "Google Ads didn't take that change. Try again in a moment.")),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search campaigns</CardTitle>
        <CardDescription>{chargeSentence}</CardDescription>
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
                const busy = pendingIds.has(c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {note ? <div className="text-xs text-muted-foreground">{note}</div> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{busy ? "Updating…" : googleStatusLabel(c)}</Badge>
                    </TableCell>
                    <TableCell>{formatGoogleMoney(c.budget?.daily, c.currency ?? account.currencyCode)}</TableCell>
                    <TableCell className="text-right">
                      {action.status ? (
                        <Button
                          size="sm"
                          variant={action.status === "ACTIVE" ? "default" : "outline"}
                          disabled={busy}
                          onClick={() =>
                            action.status === "ACTIVE" ? setConfirming(c) : setStatus.mutate({ id: c.id, status: "PAUSED" })
                          }
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

      <AlertDialog open={confirming !== null} onOpenChange={(o) => (o ? null : setConfirming(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start spending on this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{confirming?.name}&rdquo; starts showing on Google Search at{" "}
              <span className="font-medium">
                {formatGoogleMoney(confirming?.budget?.daily, confirming?.currency ?? account.currencyCode)}/day
              </span>
              . {chargeSentence} Google will refuse it if it has no location or keywords yet — set them with the
              Audience step first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) setStatus.mutate({ id: confirming.id, status: "ACTIVE" });
                setConfirming(null);
              }}
            >
              Start &amp; spend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Create ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  budget: "",
  typedCurrency: "",
  headlines: "",
  descriptions: "",
  finalUrl: "",
  endDate: "",
  notPolitical: false,
};

function CreateCampaignCard({ account }: { account: GoogleAdAccount }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) => setForm((f) => ({ ...f, [k]: v }));
  // ★CLEARED, NOT JUST CLOSED (round 1): a reopened form held the last
  //  campaign — the declaration tick included — one click from a duplicate.
  const closeAndClear = () => {
    setOpen(false);
    setForm(EMPTY_FORM);
  };

  // The account's own billing currency when the connection recorded it (the
  // api refuses any other, CURRENCY_MISMATCH); typed only when it did not.
  // `||`, not `??` (round 3): an account recorded with "" must be typeable.
  const currency = account.currencyCode || form.typedCurrency;
  const searchAd = { headlines: linesOf(form.headlines), descriptions: linesOf(form.descriptions), finalUrl: form.finalUrl.trim() };
  const amount = Number(form.budget);
  const today = localIsoDay(new Date());
  const problem = googleCreateProblem({ name: form.name, budget: form.budget, currency, endDate: form.endDate, searchAd }, today);

  const create = useMutation({
    mutationFn: () =>
      googleAdsApi.createCampaign({
        adAccountId: account.id,
        name: form.name.trim(),
        dailyBudget: { amount, currencyCode: currency.toUpperCase() },
        searchAd,
        ...(form.endDate ? { endsAt: new Date(`${form.endDate}T23:59:59`).toISOString() } : {}),
        ...(form.notPolitical ? { notPolitical: true } : {}),
      }),
    onSuccess: (res) => {
      if (res.pending) {
        toast.warning(res.message ?? "Google Ads didn't confirm the campaign yet. We'll check within the hour — don't create it again.");
      } else {
        toast.success("Search campaign created, paused. Start it when you're ready.");
      }
      // A 202 too: the row is in the list, with its "don't create it again".
      closeAndClear();
    },
    onError: (err) => {
      toast.error(googleAdsErrorMessage(err, "We couldn't create the campaign. Try again in a moment."));
      // ★It may exist on Google (rounds 1–2, the api's own marker): close and
      //  clear, so nothing invites the second create. Any other refusal keeps
      //  the form, to fix and retry as its message asks.
      if (googleCreateMayExist(err)) closeAndClear();
    },
    // Whatever happened, the list is re-read: a create inserts its row first.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["google-ads-campaigns"] }),
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
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={200} />
        </Field>
        <div className="flex gap-4">
          <Field label="Daily budget">
            <Input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => set("budget", e.target.value)} className="w-40" />
          </Field>
          <Field label="Currency">
            <Input
              value={currency}
              onChange={(e) => set("typedCurrency", e.target.value)}
              maxLength={3}
              className="w-24"
              disabled={!!account.currencyCode}
              aria-readonly={!!account.currencyCode}
            />
          </Field>
          <Field label="End date (optional)">
            <Input type="date" min={today} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className="w-44" />
          </Field>
        </div>
        <Field label="Headlines — one per line, 3 to 15, up to 30 characters each">
          <Textarea rows={4} value={form.headlines} onChange={(e) => set("headlines", e.target.value)} />
        </Field>
        <Field label="Descriptions — one per line, 2 to 4, up to 90 characters each">
          <Textarea rows={3} value={form.descriptions} onChange={(e) => set("descriptions", e.target.value)} />
        </Field>
        <Field label="Landing page">
          <Input value={form.finalUrl} onChange={(e) => set("finalUrl", e.target.value)} placeholder="https://" />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={form.notPolitical} onCheckedChange={(v) => set("notPolitical", v === true)} />
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
          {/* Not while a create is in flight (round 3): its answer decides
              whether the form is kept or cleared. */}
          <Button variant="ghost" onClick={closeAndClear} disabled={create.isPending}>
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
