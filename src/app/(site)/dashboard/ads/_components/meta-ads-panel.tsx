"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Megaphone, RefreshCw, Target } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  metaAdsApi,
  type MetaAdAccount,
  type MetaAdSet,
  type MetaAdsLevel,
  type MetaCampaign,
  type MetaSettableStatus,
} from "@/lib/api/meta-ads";
import {
  META_LAUNCH_NOTE,
  formatMetaMoney,
  metaAdsErrorMessage,
  metaAdsNeedsReconnect,
  metaBudgetLabel,
  metaInsightsRange,
  metaNotServingBecause,
  metaStatusToggle,
  metaKpiState,
  metaKpiText,
  metaFigureText,
  metaInsightsIds,
  META_CHOOSE_AD_ACCOUNT,
  metaCoverageLine,
  sumReported,
  type MetaKpiState,
} from "@/lib/meta-ads-view";
import { EditCampaignButton, NewCampaignDialog } from "./meta-campaign-dialogs";
import { getAdsChannel, panelConnection } from "../ads-channels";

/**
 * ★★M-16 — the Meta (Facebook + Instagram) panel, inside the shared Ads hub
 * (`/dashboard/ads?channel=meta`). The hub owns the header and selector;
 * this owns everything below them.
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
 * ── ★NEW CAMPAIGN AND EDIT (MR-F1) ────────────────────────────────────────
 *
 * "New campaign" makes the whole three-level thing (campaign, ad set, ad)
 * PAUSED, never a campaign shell; the pencil beside a campaign edits its name,
 * budget, countries, ages and schedule. Both live in `meta-campaign-dialogs.tsx`
 * and use the managed routes, so the weekly limit, the kill switch and the
 * budget cap see what they make. Turning a campaign on stays this table's
 * switch.
 */

const INSIGHTS_DAYS = 30;

/**
 * ⚠️★EVERY READ HERE SPENDS META'S RATE BUDGET, so none is refetched on a bare
 * tab focus. react-query's default `staleTime` is 0, and `/analytics` costs TWO
 * serial Graph calls per campaign id (the api's own note on
 * `MAX_ANALYTICS_CAMPAIGNS`) — so a 50-campaign account would fire ~100 Graph
 * calls every time the merchant switched back to this tab. That is M-11's
 * quota hazard arriving from the client. A status change still invalidates
 * the lists at once.
 */
const LIST_STALE_MS = 60_000;
const INSIGHTS_STALE_MS = 5 * 60_000;

interface ApiIntegration {
  provider: string;
  connected?: boolean;
  status?: string;
  account?: { extra?: Record<string, unknown> };
}

export function MetaAdsPanel() {
  const integrations = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () => api.get<{ integrations: ApiIntegration[] }>("/v1/integrations"),
    staleTime: 30_000,
  });

  // ★THE API REPORTS ONE `facebook` CONNECTION, NOT A `meta_ads` ONE, so the
  //  ads capability is derived — by the SAME rule the hub uses to pick this tab
  //  (`metaAdsConnectionState`, through `panelConnection` as every panel
  //  reads it, D-03b), so the two cannot disagree. ⚠️Review R1.2: a
  //  stale connection counts only if its Ads capability is on and it has an ad
  //  account; otherwise this is "Connect Meta", not a reconnect banner.
  const { isConnected, needsReauth } = useMemo(
    () => panelConnection(integrations.data?.integrations ?? [], getAdsChannel("meta")),
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
        title="Connect Meta to manage Facebook and Instagram ads"
        description="Connect your Facebook account with the Ads capability switched on and at least one ad account, and your campaigns will list here."
        action={{ label: "Connect Meta", href: "/dashboard/integrations" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {needsReauth ? <ReconnectBanner /> : null}
      <ConnectedView />
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

/**
 * ★ONE AD ACCOUNT PER WORKSPACE (MR-F2). The account is the one the merchant chose under Connected accounts, and
 * the api reports it (`activeAdAccountId`); there is no dropdown here, no `?adAccount=` in the URL, and a Meta login
 * that reaches other businesses' accounts cannot put a campaign in one of them from this screen. The api refuses
 * every write for any other account as well, so this is not the only guard.
 *
 * With two or more ad accounts and none chosen there is no active account: the panel says so, points to Connected
 * accounts, and renders no New campaign, Edit or status switch.
 */
function ConnectedView() {
  const { business } = useAuth();
  const accounts = useQuery({
    queryKey: ["meta-ads-accounts"],
    queryFn: () => metaAdsApi.listAdAccounts(),
    retry: false,
    staleTime: LIST_STALE_MS,
  });

  const list = accounts.data?.accounts;
  const activeId = accounts.data?.activeAdAccountId ?? null;
  const account = activeId ? list?.find((a) => a.id === activeId) : undefined;

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

  // ★NO ACTIVE ACCOUNT, NO CONTROLS. Nothing here can start spend until the merchant has chosen where it goes.
  if (!account) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Choose your ad account"
        description={`${META_CHOOSE_AD_ACCOUNT} Your Meta login reaches more than one.`}
        action={{ label: "Choose ad account", href: "/dashboard/integrations" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ActiveAdAccountBar account={account} businessName={business?.name} />
      <CampaignsSection account={account} />
      <DatasetCard account={account} />
    </div>
  );
}

/** Which ad account, and which workspace, every campaign here belongs to. */
function ActiveAdAccountBar({ account, businessName }: { account: MetaAdAccount; businessName?: string }) {
  return (
    <Card aria-label="Active ad account">
      <CardContent className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 p-4 text-sm">
        <div className="space-y-0.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active ad account</p>
          <p className="font-medium">
            {account.name} <span className="font-normal text-muted-foreground">({account.currency})</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {account.id}
            {businessName ? ` · Workspace: ${businessName}` : ""}
          </p>
        </div>
        <Link
          href="/dashboard/integrations"
          className="text-sm font-medium underline underline-offset-4"
        >
          Change
        </Link>
      </CardContent>
    </Card>
  );
}

// ── Campaigns ────────────────────────────────────────────────────────────

function CampaignsSection({ account }: { account: MetaAdAccount }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const campaigns = useQuery({
    queryKey: ["meta-ads-campaigns", account.id],
    queryFn: () => metaAdsApi.listCampaigns(account.id),
    retry: false,
    staleTime: LIST_STALE_MS,
  });
  // A campaign that was removed (a launch rolled back, or deleted in Ads Manager) is not one to show or edit.
  const campaignList = useMemo(
    () => campaigns.data?.campaigns.filter((c) => c.status !== "DELETED"),
    [campaigns.data],
  );
  const campaignIds = useMemo(() => (campaignList ?? []).map((c) => c.id), [campaignList]);
  // ⚠️R1.2 (b2c#571): figures are requested for the first
  //  META_INSIGHTS_MAX_CAMPAIGNS only — see its note on what each id costs.
  const insightIds = useMemo(() => metaInsightsIds(campaignIds), [campaignIds]);
  const insightSet = useMemo(() => new Set(insightIds), [insightIds]);
  // ★#571 R3: "500+" when the list itself stopped early — see metaCoverageLine.
  const coverageLine = metaCoverageLine(insightIds.length, campaignIds.length, campaigns.data?.truncated === true);

  const insights = useQuery({
    queryKey: ["meta-ads-insights", account.id, insightIds.join(",")],
    queryFn: () => {
      const [start, end] = metaInsightsRange(INSIGHTS_DAYS);
      return metaAdsApi.insights(insightIds, start, end);
    },
    enabled: insightIds.length > 0,
    retry: false,
    staleTime: INSIGHTS_STALE_MS,
  });

  const byCampaign = useMemo(
    () => new Map((insights.data ?? []).map((i) => [i.campaignId, i] as const)),
    [insights.data],
  );
  // ★Summed over every campaign, INCLUDING those Meta sent no row for — a
  //  campaign with no insights row is a campaign Meta did not report, and the
  //  total says how many of them it covers rather than hiding the gap.
  const spend = sumReported(insightIds.map((id) => byCampaign.get(id)?.spend));
  const impressions = sumReported(insightIds.map((id) => byCampaign.get(id)?.impressions));
  const clicks = sumReported(insightIds.map((id) => byCampaign.get(id)?.clicks));

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

  // ⚠️Review R1.3 — the campaign read is consulted before the insights one; see
  //  `metaKpiState` for why `insights.isLoading` alone claimed Meta had reported nothing.
  const kpiState = metaKpiState({
    campaignsPending: campaigns.isPending,
    campaignsError: campaigns.isError,
    campaignCount: campaignIds.length,
    insightsPending: insights.isPending,
    insightsError: insights.isError,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewCampaignDialog
          account={account}
          onCreated={(campaignId) => setExpanded((prev) => new Set(prev).add(campaignId))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi title={`Spend (${INSIGHTS_DAYS}d)`} total={spend} state={kpiState} render={(n) => formatMetaMoney(n, account.currency)} />
        <Kpi title="Impressions" total={impressions} state={kpiState} render={(n) => n.toLocaleString("en-US")} />
        <Kpi title="Clicks" total={clicks} state={kpiState} render={(n) => n.toLocaleString("en-US")} />
      </div>
      {coverageLine ? (
        <p className="text-xs text-muted-foreground" role="status">
          {coverageLine}
        </p>
      ) : null}
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
                  <TableHead className="sticky left-0 z-10 bg-background">Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Budget</TableHead>
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
                        // ⚠️R2.1: the cards' state, not a local ternary — a
                        //  failed read is "Unavailable" here too.
                        spend={metaFigureText(
                          kpiState,
                          cSpend,
                          (n) => formatMetaMoney(n, account.currency),
                          insightSet.has(c.id),
                        )}
                        note={null}
                        editor={metaStatusToggle(c.status) ? <EditCampaignButton account={account} campaign={c} /> : undefined}
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

      {campaigns.data?.truncated === true ? (
        // ⚠️#571 R2.1: this notice speaks for the LIST only. It said the totals
        //  "cover only these" N campaigns while the cards summed the first
        //  META_INSIGHTS_MAX_CAMPAIGNS — two notices on one screen disagreeing.
        //  What the totals cover is said once, by the coverage line above.
        <p className="text-xs text-warning-on-tint" role="status">
          Showing the first {campaignIds.length} campaigns — this account has more than this view
          reads.
        </p>
      ) : null}

      {/* ★WHAT ACTIVATING COSTS is on screen BEFORE any switch is pressed. The answer is "nothing": Peaks are charged for
          the tasks the merchant asks for, never for launching or for a result, so there is no price to read here. */}
      <p className="text-xs text-muted-foreground">{META_LAUNCH_NOTE}</p>
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
    staleTime: LIST_STALE_MS,
  });

  if (adSets.isLoading) return <MessageRow depth={1} text="Loading ad sets…" />;
  if (adSets.isError) {
    return <MessageRow depth={1} text={metaAdsErrorMessage(adSets.error, "Couldn't load this campaign's ad sets.")} />;
  }
  const list = adSets.data?.adSets ?? [];
  if (list.length === 0) return <MessageRow depth={1} text="No ad sets in this campaign yet — nothing under it can serve." />;

  return (
    <>
      {adSets.data?.truncated === true ? (
        <MessageRow depth={1} text={`Showing the first ${list.length} ad sets — this campaign has more.`} />
      ) : null}
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
    staleTime: LIST_STALE_MS,
  });

  if (ads.isLoading) return <MessageRow depth={2} text="Loading ads…" />;
  if (ads.isError) return <MessageRow depth={2} text={metaAdsErrorMessage(ads.error, "Couldn't load this ad set's ads.")} />;
  const list = ads.data?.ads ?? [];
  if (list.length === 0) return <MessageRow depth={2} text="No ads in this ad set yet — it cannot serve." />;

  return (
    <>
      {ads.data?.truncated === true ? (
        <MessageRow depth={2} text={`Showing the first ${list.length} ads — this ad set has more.`} />
      ) : null}
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
  editor,
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
  /** An edit control beside the name; only campaigns have one. */
  editor?: ReactNode;
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
      <TableCell className={`sticky left-0 z-10 bg-background ${INDENT[depth]}`}>
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
          {editor}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>{status}</Badge>
      </TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{budget}</TableCell>
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
                <SelectTrigger aria-label="Dataset" className="w-80">
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
  state,
  render,
}: {
  title: string;
  total: ReturnType<typeof sumReported>;
  state: MetaKpiState;
  render: (n: number) => string;
}) {
  const text = metaKpiText(state, total, render);
  return (
    <Card>
      <CardContent className="p-5">
        {text === null ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            {/* ★ABSENT IS NOT ZERO: an absent figure is named as unreported, never as 0, and
                a partial total says how partial rather than posing as whole. */}
            <p className="mt-1 text-2xl font-bold tabular-nums">{text}</p>
            {state === "ready" && total && total.reported < total.of ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Meta returned figures for {total.reported} of {total.of} campaigns — a campaign that did not deliver in this window may return none.
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
