"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Megaphone, RefreshCw, Target } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { useCreditsRateCard } from "@/hooks/use-credits";
import { flattenMetaIntegration } from "@/lib/integrations-meta";
import {
  metaAdsApi,
  type MetaAdAccount,
  type MetaAdSet,
  type MetaAdsLevel,
  type MetaCampaign,
  type MetaSettableStatus,
} from "@/lib/api/meta-ads";
import {
  META_LAUNCH_USE_CASE,
  formatMetaMoney,
  metaAdsErrorMessage,
  metaAdsNeedsReconnect,
  metaBudgetLabel,
  metaInsightsRange,
  metaLaunchChargeSentence,
  metaNotServingBecause,
  metaStatusToggle,
  sumReported,
} from "@/lib/meta-ads-view";
import { ADS_CHANNEL_PARAM, type AdsChannelKey } from "../ads-channels";

/**
 * ★★M-16 — the Meta (Facebook + Instagram) panel, inside the shared Ads hub
 * (`/dashboard/ads?channel=meta`). The hub owns the header, selector and
 * CronToolbar; this owns everything below them.
 *
 * ── WHAT IT SHOWS, AND WHY IN THIS SHAPE ─────────────────────────────────
 *
 * Meta is three levels — campaign → ad set → ad — and delivery needs all three
 * ACTIVE (§1.2). So the table expands a campaign into its ad sets and an ad set
 * into its ads, and a node that is ACTIVE under a paused parent says it is not
 * serving, because its badge alone would claim it is.
 *
 * Every list is read LIVE from Meta through the managed routes (M-13's
 * contract, `lib/meta-ads-surface.ts`), like X and unlike LinkedIn, whose list
 * is local rows. A stale connection therefore lists nothing, and says so.
 *
 * ── ★THE CONVERSIONS DATASET CARD IS THE ONLY WAY M-09 CAN EVER RUN ──────
 *
 * M-19 shipped the routes that choose where purchases are sent and M-09 shipped
 * the sweep that sends them — and **no client called either route**, so no
 * business could choose a dataset and the sweep was a no-op for every one of
 * them. The sweep's own header: *"NO-OPS FOR EVERY BUSINESS until a human has
 * chosen a dataset"*. That human act is this card.
 *
 * ── ⏸NOT HERE, DELIBERATELY ───────────────────────────────────────────────
 *
 * No "Create campaign". See `lib/api/meta-ads.ts`: a Meta campaign is three
 * levels plus a special-ad-category declaration and a creative, and no row has
 * designed that flow. An empty-shell create would be a campaign that can never
 * serve.
 */

const ACCOUNT_PARAM = "adAccount";
const INSIGHTS_DAYS = 30;

interface ApiIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
  account?: { extra?: Record<string, unknown> };
}

export function MetaAdsPanel({ channelKey }: { channelKey: AdsChannelKey }) {
  const integrations = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () => api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });

  // ★THE API REPORTS ONE `facebook` CONNECTION, NOT A `meta_ads` ONE. The ads
  //  capability is a virtual row that `flattenMetaIntegration` derives — the
  //  same expansion /dashboard/integrations uses — so reading `meta_ads`
  //  straight off the list would find nothing and tell a connected merchant to
  //  connect.
  const metaAds = useMemo(
    () =>
      flattenMetaIntegration(integrations.data?.integrations ?? []).find(
        (i) => i.provider === "meta_ads",
      ),
    [integrations.data],
  );
  const needsReauth = metaAds?.status === "needs_reauth";
  const isConnected = metaAds?.connected === true || needsReauth;

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
        title="Connect Meta to manage Facebook and Instagram ads"
        description="Connect your Facebook account with the Ads capability switched on and at least one ad account, and your campaigns will list here."
        action={{ label: "Connect Meta", href: "/dashboard/integrations" }}
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
          Your Meta connection is <span className="font-medium">stale</span>. Meta
          campaigns are read live from Meta, so nothing lists until you reconnect.
        </span>
        <Link
          href="/dashboard/integrations"
          className="font-medium text-warning-on-tint underline underline-offset-4"
        >
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
    queryKey: ["meta-ads-accounts"],
    queryFn: () => metaAdsApi.listAdAccounts(),
    retry: false,
  });

  // The X panel's rule, for its reason: build the URL from useSearchParams
  // (never window.location), and write nothing until the hub has pinned
  // `?channel=`, or this would drop the channel the hub is about to add.
  const isActiveChannel = params.get(ADS_CHANNEL_PARAM) === channelKey;
  const setAccountParam = useCallback(
    (next: string) => {
      const search = new URLSearchParams(params.toString());
      search.set(ACCOUNT_PARAM, next);
      router.replace(`${pathname}?${search.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const list = accounts.data?.accounts;
  const firstAccountId = list?.[0]?.id;
  // ⚠️★A `?adAccount=` THAT IS NOT IN THE LIST IS IGNORED, not trusted. It is a
  //  URL anyone can edit, and the api would refuse it `AD_ACCOUNT_NOT_ALLOWED`
  //  on every call — a panel of errors for a merchant who pasted a stale link.
  const known = list?.some((a) => a.id === queryAccountId) ? queryAccountId : null;
  useEffect(() => {
    if (isActiveChannel && !known && firstAccountId) setAccountParam(firstAccountId);
  }, [isActiveChannel, known, firstAccountId, setAccountParam]);

  const accountId = known ?? firstAccountId ?? null;
  const account = list?.find((a) => a.id === accountId);

  if (accounts.isLoading) return <SkeletonStack />;

  // A failed read is NOT "no ad accounts" — the trap X's panel records.
  if (accounts.isError) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="Couldn't load your ad accounts"
        description={metaAdsErrorMessage(
          accounts.error,
          "Meta didn't return your ad accounts. Try again in a moment.",
        )}
        action={
          metaAdsNeedsReconnect(accounts.error)
            ? { label: "Check connection", href: "/dashboard/integrations" }
            : undefined
        }
      />
    );
  }

  if ((list ?? []).length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No ad accounts found"
        description="The Facebook account you connected has no Meta ad accounts. Create one in Meta Business Settings, then reconnect."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ad account</Label>
        <Select value={accountId ?? undefined} onValueChange={setAccountParam}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Choose an ad account" />
          </SelectTrigger>
          <SelectContent>
            {(list ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {account ? (
        <>
          <CampaignsSection account={account} />
          <DatasetCard account={account} />
        </>
      ) : null}
    </div>
  );
}

// ── Campaigns ────────────────────────────────────────────────────────────

function CampaignsSection({ account }: { account: MetaAdAccount }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const rateCard = useCreditsRateCard();

  const campaigns = useQuery({
    queryKey: ["meta-ads-campaigns", account.id],
    queryFn: () => metaAdsApi.listCampaigns(account.id),
    retry: false,
  });
  const campaignList = campaigns.data?.campaigns;
  const campaignIds = useMemo(() => (campaignList ?? []).map((c) => c.id), [campaignList]);

  const insights = useQuery({
    queryKey: ["meta-ads-insights", account.id, campaignIds.join(",")],
    queryFn: () => {
      const [start, end] = metaInsightsRange(INSIGHTS_DAYS);
      return metaAdsApi.insights(campaignIds, start, end);
    },
    enabled: campaignIds.length > 0,
    retry: false,
  });

  const byCampaign = useMemo(
    () => new Map((insights.data ?? []).map((i) => [i.campaignId, i] as const)),
    [insights.data],
  );
  // ★Summed over every campaign, INCLUDING those Meta sent no row for — a
  //  campaign with no insights row is a campaign Meta did not report, and the
  //  total says how many of them it covers rather than hiding the gap.
  const spend = sumReported(campaignIds.map((id) => byCampaign.get(id)?.spend));
  const impressions = sumReported(campaignIds.map((id) => byCampaign.get(id)?.impressions));
  const clicks = sumReported(campaignIds.map((id) => byCampaign.get(id)?.clicks));

  // Variables carry the account so a mid-flight switch cannot redirect this
  // invalidation to the newly selected account — X's panel's rule.
  const setStatus = useMutation({
    mutationFn: (v: { accountId: string; level: MetaAdsLevel; id: string; status: MetaSettableStatus }) =>
      metaAdsApi.setStatus(v.level, v.id, v.status),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns", v.accountId] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-adsets", v.accountId] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-ads", v.accountId] });
    },
    onError: (err) => {
      toast.error(metaAdsErrorMessage(err, "Couldn't change that status. Nothing was changed — try again."));
    },
  });
  const toggle = (level: MetaAdsLevel, id: string, status: MetaSettableStatus) =>
    setStatus.mutate({ accountId: account.id, level, id, status });
  const pendingId = setStatus.isPending ? setStatus.variables?.id : undefined;

  const launchRow = rateCard.data?.useCases.find((u) => u.useCase === META_LAUNCH_USE_CASE);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi title={`Spend (${INSIGHTS_DAYS}d)`} total={spend} loading={insights.isLoading} render={(n) => formatMetaMoney(n, account.currency)} />
        <Kpi title="Impressions" total={impressions} loading={insights.isLoading} render={(n) => n.toLocaleString("en-US")} />
        <Kpi title="Clicks" total={clicks} loading={insights.isLoading} render={(n) => n.toLocaleString("en-US")} />
      </div>
      {insights.isError ? (
        <p className="text-xs text-muted-foreground" role="status">
          {metaAdsErrorMessage(insights.error, "Meta didn't return performance figures just now.")}
        </p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {campaigns.isLoading ? (
            <div className="p-5">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : campaigns.isError ? (
            <div className="p-8">
              <EmptyState
                icon={RefreshCw}
                title="Couldn't load campaigns"
                description={metaAdsErrorMessage(
                  campaigns.error,
                  "Meta didn't return this account's campaigns. Try again in a moment.",
                )}
              />
            </div>
          ) : (campaignList ?? []).length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Megaphone}
                title="No campaigns on this ad account"
                description="Campaigns you run on this ad account — from Meta Ads Manager or from PeakHour — will list here."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Spend ({INSIGHTS_DAYS}d)</TableHead>
                  <TableHead className="w-24 text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(campaignList ?? []).map((c) => {
                  const open = expanded.has(c.id);
                  const cSpend = byCampaign.get(c.id)?.spend;
                  return (
                    <Fragment key={c.id}>
                      <NodeRow
                        depth={0}
                        name={c.name}
                        status={c.status}
                        budget={metaBudgetLabel(c, account.currency, "campaign").text}
                        spend={
                          cSpend !== undefined
                            ? formatMetaMoney(cSpend, account.currency)
                            : insights.isLoading
                              ? ""
                              : "Not reported"
                        }
                        note={null}
                        open={open}
                        onExpand={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.id)) next.delete(c.id);
                            else next.add(c.id);
                            return next;
                          })
                        }
                        pending={pendingId === c.id}
                        onToggle={(s) => toggle("campaign", c.id, s)}
                      />
                      {open ? (
                        <AdSetRows account={account} campaign={c} pendingId={pendingId} onToggle={toggle} />
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ★§7.0.1 requirement 4 — the price is on screen BEFORE any switch is
          pressed, from the rate card's own row, never a number typed here. */}
      <p className="text-xs text-muted-foreground">{metaLaunchChargeSentence(launchRow)}</p>
    </div>
  );
}

function AdSetRows({
  account,
  campaign,
  pendingId,
  onToggle,
}: {
  account: MetaAdAccount;
  campaign: MetaCampaign;
  pendingId: string | undefined;
  onToggle: (level: MetaAdsLevel, id: string, status: MetaSettableStatus) => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const adSets = useQuery({
    queryKey: ["meta-ads-adsets", account.id, campaign.id],
    queryFn: () => metaAdsApi.listAdSets(account.id, campaign.id),
    retry: false,
  });

  if (adSets.isLoading) return <MessageRow depth={1} text="Loading ad sets…" />;
  if (adSets.isError) {
    return <MessageRow depth={1} text={metaAdsErrorMessage(adSets.error, "Couldn't load this campaign's ad sets.")} />;
  }
  const list = adSets.data?.adSets ?? [];
  if (list.length === 0) return <MessageRow depth={1} text="No ad sets in this campaign yet — nothing under it can serve." />;

  return (
    <>
      {list.map((s) => {
        const open = expanded.has(s.id);
        return (
          <Fragment key={s.id}>
            <NodeRow
              depth={1}
              name={s.name}
              status={s.status}
              budget={metaBudgetLabel(s, account.currency, "adSet").text}
              spend=""
              note={metaNotServingBecause(s.status, { campaign: campaign.status })}
              open={open}
              onExpand={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id);
                  else next.add(s.id);
                  return next;
                })
              }
              pending={pendingId === s.id}
              onToggle={(st) => onToggle("adSet", s.id, st)}
            />
            {open ? <AdRows account={account} campaign={campaign} adSet={s} pendingId={pendingId} onToggle={onToggle} /> : null}
          </Fragment>
        );
      })}
    </>
  );
}

function AdRows({
  account,
  campaign,
  adSet,
  pendingId,
  onToggle,
}: {
  account: MetaAdAccount;
  campaign: MetaCampaign;
  adSet: MetaAdSet;
  pendingId: string | undefined;
  onToggle: (level: MetaAdsLevel, id: string, status: MetaSettableStatus) => void;
}) {
  const ads = useQuery({
    queryKey: ["meta-ads-ads", account.id, adSet.id],
    queryFn: () => metaAdsApi.listAds(account.id, adSet.id),
    retry: false,
  });

  if (ads.isLoading) return <MessageRow depth={2} text="Loading ads…" />;
  if (ads.isError) return <MessageRow depth={2} text={metaAdsErrorMessage(ads.error, "Couldn't load this ad set's ads.")} />;
  const list = ads.data?.ads ?? [];
  if (list.length === 0) return <MessageRow depth={2} text="No ads in this ad set yet — it cannot serve." />;

  return (
    <>
      {list.map((a) => (
        <NodeRow
          key={a.id}
          depth={2}
          name={a.name}
          status={a.status}
          budget=""
          spend=""
          note={metaNotServingBecause(a.status, { campaign: campaign.status, adSet: adSet.status })}
          open={null}
          onExpand={undefined}
          pending={pendingId === a.id}
          onToggle={(st) => onToggle("ad", a.id, st)}
        />
      ))}
    </>
  );
}

const INDENT = ["", "pl-8", "pl-14"] as const;

function NodeRow({
  depth,
  name,
  status,
  budget,
  spend,
  note,
  open,
  onExpand,
  pending,
  onToggle,
}: {
  depth: 0 | 1 | 2;
  name: string;
  status: string;
  budget: string;
  spend: string;
  note: string | null;
  /** `null` for a leaf (an ad), which has nothing to expand. */
  open: boolean | null;
  onExpand: (() => void) | undefined;
  pending: boolean;
  onToggle: (next: MetaSettableStatus) => void;
}) {
  const toggle = metaStatusToggle(status);
  const level = depth === 0 ? "campaign" : depth === 1 ? "ad set" : "ad";
  return (
    <TableRow>
      <TableCell className={INDENT[depth]}>
        <div className="flex items-center gap-1.5">
          {open !== null && onExpand ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={onExpand}
              aria-expanded={open}
              aria-label={`${open ? "Collapse" : "Expand"} ${level} ${name}`}
            >
              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </Button>
          ) : (
            <span className="inline-block size-6" aria-hidden />
          )}
          <div>
            <span className={depth === 0 ? "font-medium" : undefined}>{name}</span>
            {note ? <span className="block text-xs text-warning-on-tint">{note}</span> : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>{status}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{budget}</TableCell>
      <TableCell className="text-right tabular-nums">{spend}</TableCell>
      <TableCell className="text-right">
        {toggle ? (
          <Switch
            checked={status === "ACTIVE"}
            onCheckedChange={() => onToggle(toggle.next)}
            disabled={pending}
            aria-label={`${toggle.next === "ACTIVE" ? "Activate" : "Pause"} ${level} ${name}`}
          />
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function MessageRow({ depth, text }: { depth: 1 | 2; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={5} className={`${INDENT[depth]} text-xs text-muted-foreground`}>
        {text}
      </TableCell>
    </TableRow>
  );
}

// ── The conversions dataset (M-19's routes, M-09's destination) ──────────

function DatasetCard({ account }: { account: MetaAdAccount }) {
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<string>("");
  const [editing, setEditing] = useState(false);

  const selected = useQuery({
    queryKey: ["meta-ads-dataset", "selected"],
    queryFn: () => metaAdsApi.getSelectedDataset(),
    retry: false,
  });
  const datasets = useQuery({
    queryKey: ["meta-ads-dataset", "list", account.id],
    queryFn: () => metaAdsApi.listDatasets(account.id),
    enabled: editing,
    retry: false,
  });

  const save = useMutation({
    mutationFn: (v: { adAccountId: string; datasetId: string }) =>
      metaAdsApi.selectDataset(v.adAccountId, v.datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-dataset"] });
      setEditing(false);
      setChoice("");
      toast.success("Purchases from Meta ads will be sent to that dataset.");
    },
    onError: (err) => toast.error(metaAdsErrorMessage(err, "Couldn't save that choice. Try again.")),
  });

  const current = selected.data?.selected ?? null;
  const options = datasets.data?.datasets ?? [];
  const chosen = options.find((d) => d.id === choice);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-4" />
          Conversions dataset
        </CardTitle>
        <CardDescription>
          For each order that came from a click on a Meta ad, PeakHour sends Meta the
          order&apos;s value and currency, the click id Meta put on the link, and the
          customer&apos;s country, hashed — so Meta can credit your ads. No name, email or
          phone number is sent. Nothing is sent until you choose a dataset. This costs
          no Peaks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {selected.isLoading ? (
          <Skeleton className="h-5 w-64" />
        ) : selected.isError ? (
          <p role="status">
            {metaAdsErrorMessage(selected.error, "Couldn't read which dataset is chosen.")}
          </p>
        ) : current ? (
          <p>
            Sending to <span className="font-medium">{current.name ?? current.id}</span>{" "}
            <span className="text-muted-foreground">
              (dataset {current.id}, ad account {current.adAccountId})
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">No dataset chosen — nothing is being sent.</p>
        )}

        {editing ? (
          <div className="space-y-2">
            {datasets.isLoading ? (
              <Skeleton className="h-9 w-80" />
            ) : datasets.isError ? (
              <p role="status">
                {metaAdsErrorMessage(datasets.error, "Couldn't load this ad account's datasets.")}
              </p>
            ) : options.length === 0 ? (
              <p className="text-muted-foreground">
                This ad account has no datasets. Create one in Meta Events Manager first.
              </p>
            ) : (
              <Select value={choice} onValueChange={setChoice}>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Choose a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((d) => (
                    // ★AN UNAVAILABLE DATASET IS SHOWN, DISABLED, WITH ITS
                    //  REASON — the api's discovery deliberately does not
                    //  filter it, because a dataset that vanishes from a list
                    //  is indistinguishable from one that does not exist.
                    <SelectItem key={d.id} value={d.id} disabled={d.isUnavailable === true}>
                      {d.name}
                      {d.isUnavailable === true ? " — unavailable at Meta" : ""}
                      {d.lastFiredTime ? ` · last event ${d.lastFiredTime.slice(0, 10)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!chosen || save.isPending}
                aria-busy={save.isPending}
                onClick={() => chosen && save.mutate({ adAccountId: account.id, datasetId: chosen.id })}
              >
                {save.isPending ? "Saving…" : "Send conversions here"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={selected.isError}>
            {current ? "Change dataset" : "Choose a dataset"}
          </Button>
        )}

        {/* ⚠️The M-09 hazard, said where the merchant decides. Our event id
            cannot match the one the Facebook & Instagram sales channel's own
            Pixel sends, so a store running both reports each purchase twice. */}
        <p className="text-xs text-muted-foreground">
          If your store also runs Meta&apos;s own Pixel for purchases (for example through the
          Facebook &amp; Instagram sales channel on Shopify), Meta may count those purchases
          twice in this dataset.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function Kpi({
  title,
  total,
  loading,
  render,
}: {
  title: string;
  total: ReturnType<typeof sumReported>;
  loading: boolean;
  render: (n: number) => string;
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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            {/* ★ABSENT IS NOT ZERO: "Not reported" when Meta sent nothing, and
                a partial total says how partial rather than posing as whole. */}
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {total ? render(total.total) : "Not reported"}
            </p>
            {total && total.reported < total.of ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Meta reported this for {total.reported} of {total.of} campaigns.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonStack() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-80" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
