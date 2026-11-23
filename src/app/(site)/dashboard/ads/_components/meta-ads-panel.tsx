"use client";

import { CHOOSE_AD_ACCOUNTS, PAUSE_ONLY_NOTICE } from "@/lib/ad-account-copy";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  metaResultsText,
  META_RESULTS_UNAVAILABLE_TIP,
  metaInsightsIds,
  metaAdAccountBareId,
  classifyMetaAccounts,
  META_ALL_ACCOUNTS,
  metaAdAccountOptionLabel,
  metaAdAccountShortId,
  metaCoverageLine,
  sumReported,
  type MetaKpiState,
} from "@/lib/meta-ads-view";
import { EditCampaignButton, LowerBudgetButton, NewCampaignDialog } from "./meta-campaign-dialogs";
import { budgetKey } from "@/lib/meta-ads-form";
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
 * ★A BUSINESS MAY USE SEVERAL AD ACCOUNTS (MR-F2). They are the ones the merchant ticked under Connected accounts, and the
 * api reports them (`enabledIds`, `defaultId`): a Meta login lists other businesses' accounts too, and none of those is
 * ever offered here to start spend in. There is no `?adAccount=` in the URL. The filter narrows the LIST; it is not what a campaign
 * is created in (the New campaign dialog has its own Ad account choice) and the api refuses a create or edit in any
 * account the business has not enabled.
 *
 * ★THE LOGIN'S OTHER ACCOUNTS (MR-G4) are listed apart in the filter ("Other accounts on your Meta login") and open PAUSE-ONLY: a
 * running campaign there can be paused or have its budget lowered, nothing else. Only accounts the CONNECTION knows (`knownIds`) are
 * offered; one Meta lists that the connection has not discovered yet is named under "New on your Meta login" with no controls.
 *
 * With nothing enabled (two or more listed and none ticked) the panel says so and points to Connected accounts, renders no New
 * campaign, and loads NOTHING until the merchant picks one of the login's accounts from the filter (then it is pause-only).
 * A failed REFETCH never hides what is already on screen: an error replaces a section only when it has no data of its own.
 */
function ConnectedView() {
  const { business } = useAuth();
  const accounts = useQuery({
    // Scoped by business, like the signal step's: another business's answer is never served for this one.
    queryKey: ["meta-ads-accounts", business?._id ?? "none"],
    queryFn: () => metaAdsApi.listAdAccounts(),
    retry: false,
    staleTime: LIST_STALE_MS,
  });
  // The filter the merchant chose ("all" or one account); "" until they choose, so the default rule below applies.
  const [chosenFilter, setChosenFilter] = useState<string>("");
  // A campaign just created, so its section opens it.
  const [justCreated, setJustCreated] = useState<ReadonlySet<string>>(new Set());

  // Every id compare is bare-id (`123` is `act_123`): see `classifyMetaAccounts`.
  const { list, enabled, others, newOnLogin, defaultId, missingCount, allChosenMissing, resolveFilter } = classifyMetaAccounts(accounts.data);

  if (accounts.isLoading) return <SkeletonStack />;

  // A failed read is NOT "no ad accounts" — the trap X's panel records.
  if (accounts.isError && !accounts.data) {
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

  if (list.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No ad accounts found"
        description="The Facebook account you connected has no Meta ad accounts. Create one in Meta Business Settings, then reconnect."
      />
    );
  }

  // ★NO ENABLED ACCOUNT, NO NEW-SPEND CONTROLS. Nothing here can start spend until the business has said which accounts are its own.
  // The notice says so, and the login's other accounts below still open pause-only so a running campaign can always be stopped (MR-G4).
  const noneEnabled = enabled.length === 0;
  const notice = noneEnabled ? (
    allChosenMissing ? (
      <EmptyState
        icon={Megaphone}
        title="Your ad account is not on your Meta login"
        description="The ad account you chose is no longer on your Meta login. Reconnect Meta or choose another."
        action={{ label: "Open Connected accounts", href: "/dashboard/integrations" }}
      />
    ) : (
      <EmptyState
        icon={Megaphone}
        title="Choose your ad accounts"
        description={`${CHOOSE_AD_ACCOUNTS} Your Meta login reaches more than one.`}
        action={{ label: "Choose ad accounts", href: "/dashboard/integrations" }}
      />
    )
  ) : null;
  // Nothing the merchant can open: the notice, and (D7) the accounts that are new on the login, never an empty card.
  if (noneEnabled && others.length === 0) {
    return (
      <div className="space-y-6">
        {notice}
        <NewOnLoginLine accounts={newOnLogin} />
      </div>
    );
  }

  // The business's DEFAULT account is selected first ("All accounts" stays as an option, listed first); with one enabled account
  // it is the selection. A stale choice falls back to the same rule. With nothing enabled none is selected: nothing loads until one is picked.
  const filter = resolveFilter(chosenFilter);
  // An account the business has not enabled: its campaigns open PAUSE-ONLY (pause, or lower the budget).
  const pauseOnlyAccount = others.find((a) => a.id === filter);
  const shown = pauseOnlyAccount ? [] : filter === META_ALL_ACCOUNTS ? enabled : enabled.filter((a) => a.id === filter);

  return (
    <div className="space-y-6">
      {notice}
      {accounts.isError ? (
        <p role="status" className="text-xs text-warning-on-tint">
          Couldn&apos;t refresh your ad accounts just now. Showing what was loaded before.
        </p>
      ) : null}
      <Card aria-label="Ad accounts">
        <CardContent className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4 text-sm">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Ad accounts{business?.name ? ` for ${business.name}` : ""}
            </p>
            {enabled.length > 1 || others.length > 0 ? (
              <Select value={filter} onValueChange={setChosenFilter}>
                <SelectTrigger aria-label="Ad account filter" className="w-80">
                  <SelectValue placeholder="Choose an account to pause or lower" />
                </SelectTrigger>
                <SelectContent>
                  {enabled.length > 1 ? <SelectItem value={META_ALL_ACCOUNTS}>All accounts</SelectItem> : null}
                  {enabled.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {metaAdAccountOptionLabel(a)}
                      {a.id === defaultId ? " · default" : ""}
                    </SelectItem>
                  ))}
                  {others.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>Other accounts on your Meta login</SelectLabel>
                      {others.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {metaAdAccountOptionLabel(a)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>
            ) : enabled[0] ? (
              <p className="font-medium">{metaAdAccountOptionLabel(enabled[0])}</p>
            ) : null}
            {missingCount > 0 ? (
              <p role="status" className="text-xs text-warning-on-tint">
                {missingCount === 1
                  ? "One of your ad accounts is no longer on your Meta login and is not shown."
                  : `${missingCount} of your ad accounts are no longer on your Meta login and are not shown.`}{" "}
                Reconnect Meta or change your ad accounts.
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            {noneEnabled ? null : (
              <NewCampaignDialog
                accounts={enabled}
                defaultAccountId={defaultId}
                initialAccountId={filter === META_ALL_ACCOUNTS || pauseOnlyAccount ? null : filter}
                onCreated={(campaignId, accountId) => {
                  setJustCreated((prev) => new Set(prev).add(campaignId));
                  // Created in another account than the one filtered to: show that account, or the new campaign is nowhere to be seen.
                  if (filter !== META_ALL_ACCOUNTS && filter !== accountId) setChosenFilter(accountId);
                }}
              />
            )}
            <Link href="/dashboard/integrations" className="text-sm font-medium underline underline-offset-4">
              Change
            </Link>
          </div>
        </CardContent>
      </Card>

      <NewOnLoginLine accounts={newOnLogin} />
      {pauseOnlyAccount ? (
        <>
          <p className="text-sm text-muted-foreground">{PAUSE_ONLY_NOTICE}</p>
          <CampaignsSection key={`pause-${pauseOnlyAccount.id}`} account={pauseOnlyAccount} showAccountLine={false} pauseOnly />
        </>
      ) : null}
      {shown.map((account) => (
        <CampaignsSection
          key={account.id}
          account={account}
          autoOpen={justCreated}
          showAccountLine={enabled.length > 1}
        />
      ))}
      {noneEnabled ? null : <DatasetCard accounts={enabled} defaultAccountId={defaultId} />}
    </div>
  );
}

/** Accounts Meta lists that this connection has not discovered yet: named, with no controls. */
function NewOnLoginLine({ accounts }: { accounts: MetaAdAccount[] }) {
  if (accounts.length === 0) return null;
  return (
    <p role="status" className="text-sm text-muted-foreground">
      New on your Meta login: {accounts.map((a) => metaAdAccountOptionLabel(a)).join(", ")}. Refresh your connection to manage {accounts.length === 1 ? "it" : "them"}.{" "}
      <Link href="/dashboard/integrations" className="font-medium underline underline-offset-4">
        Open Connected accounts
      </Link>
    </p>
  );
}

/** No campaign opens by itself (a pause-only section has no create). */
const NO_AUTO_OPEN: ReadonlySet<string> = new Set();


// ── Campaigns ────────────────────────────────────────────────────────────

function CampaignsSection({
  account,
  autoOpen = NO_AUTO_OPEN,
  showAccountLine,
  pauseOnly = false,
}: {
  account: MetaAdAccount;
  /** Campaigns just created in this session: opened. */
  autoOpen?: ReadonlySet<string>;
  /** More than one account is enabled, so each campaign says which account it is in. */
  showAccountLine: boolean;
  /** An ad account the business has not enabled: only pause and a lower budget (MR-G4). */
  pauseOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  // A campaign just created starts OPEN: `expanded` holds the ones the merchant has toggled since, so toggling flips it.
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
  const reach = sumReported(insightIds.map((id) => byCampaign.get(id)?.reach));
  const results = sumReported(insightIds.map((id) => byCampaign.get(id)?.results));

  // Variables carry the account so a mid-flight switch cannot redirect this
  // invalidation to the newly selected account — X's panel's rule.
  const setStatus = useMutation({
    mutationFn: (v: { accountId: string; level: MetaAdsLevel; id: string; status: MetaSettableStatus }) =>
      metaAdsApi.setStatus(v.level, v.id, v.status),
    onSuccess: (_d, v) => {
      // ★THE SWITCH MOVES AT ONCE: the cached node takes the new status before the refetch, so a slow or failed refetch can never
      // leave a paused campaign showing as running (or the reverse).
      const withStatus = <T extends { id: string; status: string }>(items: T[]): T[] => items.map((i) => (i.id === v.id ? { ...i, status: v.status } : i));
      if (v.level === "campaign") {
        queryClient.setQueryData<{ campaigns: MetaCampaign[]; truncated: boolean }>(["meta-ads-campaigns", v.accountId], (old) => (old ? { ...old, campaigns: withStatus(old.campaigns) } : old));
      } else if (v.level === "adSet") {
        queryClient.setQueriesData<{ adSets: MetaAdSet[]; truncated: boolean }>({ queryKey: ["meta-ads-adsets", v.accountId] }, (old) => (old ? { ...old, adSets: withStatus(old.adSets) } : old));
      } else {
        queryClient.setQueriesData<{ ads: Array<{ id: string; status: string }>; truncated: boolean }>({ queryKey: ["meta-ads-ads", v.accountId] }, (old) => (old ? { ...old, ads: withStatus(old.ads) } : old));
      }
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
    campaignsError: campaigns.isError && !campaigns.data,
    campaignCount: campaignIds.length,
    insightsPending: insights.isPending,
    insightsError: insights.isError && !insights.data,
  });

  return (
    <div className="space-y-4">
      {/* ★EVERY CAMPAIGN SAYS WHICH ACCOUNT IT IS IN: the heading, and (below) the line under each campaign's name. */}
      <h2 className="text-sm font-medium">{metaAdAccountOptionLabel(account)}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title={`Spend (${INSIGHTS_DAYS}d)`} total={spend} state={kpiState} render={(n) => formatMetaMoney(n, account.currency)} />
        <Kpi
          title="Reach"
          total={reach}
          state={kpiState}
          render={(n) => n.toLocaleString("en-US")}
          note="Added up across campaigns, so a person reached by two campaigns counts twice."
        />
        <Kpi title="Impressions" total={impressions} state={kpiState} render={(n) => n.toLocaleString("en-US")} />
        <Kpi title="Clicks" total={clicks} state={kpiState} render={(n) => n.toLocaleString("en-US")} />
        <Kpi
          title="Results"
          total={results}
          state={kpiState}
          render={(n) => n.toLocaleString("en-US")}
          note="Meta's own result for each campaign's objective, added together."
        />
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
          ) : campaigns.isError && !campaigns.data ? (
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
                  <TableHead className="hidden text-right md:table-cell">Reach</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Clicks</TableHead>
                  <TableHead className="text-right">Results</TableHead>
                  <TableHead className="w-24 text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(campaignList ?? []).map((c) => {
                  const open = expanded.has(c.id) !== autoOpen.has(c.id);
                  const cRow = byCampaign.get(c.id);
                  return (
                    <Fragment key={c.id}>
                      <NodeRow
                        depth={0}
                        name={c.name}
                        status={c.status}
                        budget={metaBudgetLabel(c, account.currency, "campaign").text}
                        // ⚠️R2.1: the cards' state, not a local ternary — a
                        //  failed read is "Unavailable" here too.
                        figures={rowFigures(kpiState, cRow, account.currency, insightSet.has(c.id))}
                        note={null}
                        accountLine={showAccountLine ? `${account.name} (${metaAdAccountShortId(account.id)})` : undefined}
                        editor={
                          pauseOnly ? (
                            metaStatusToggle(c.status) && budgetKey(c) !== null ? <LowerBudgetButton account={account} level="campaign" node={c} /> : undefined
                          ) : metaStatusToggle(c.status) ? (
                            <EditCampaignButton account={account} campaign={c} />
                          ) : undefined
                        }
                        pauseOnly={pauseOnly}
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
                        <AdSetRows account={account} campaign={c} pendingId={pendingId} onToggle={toggle} pauseOnly={pauseOnly} />
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {campaigns.isError && campaigns.data ? (
        // A failed REFETCH keeps the list (and its pause switches) on screen: what was loaded is still what Meta last said.
        <p className="text-xs text-warning-on-tint" role="status">
          Couldn&apos;t refresh this account&apos;s campaigns just now. Showing what was loaded before.
        </p>
      ) : null}

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
      {pauseOnly ? null : <p className="text-xs text-muted-foreground">{META_LAUNCH_NOTE}</p>}
    </div>
  );
}

function AdSetRows({
  account,
  campaign,
  pendingId,
  onToggle,
  pauseOnly,
}: {
  account: MetaAdAccount;
  campaign: MetaCampaign;
  pendingId: string | undefined;
  onToggle: (level: MetaAdsLevel, id: string, status: MetaSettableStatus) => void;
  pauseOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  // Mounted only while the campaign is open, so ad set figures load lazily.
  const levelInsights = useLevelInsights(account, campaign.id, "adset");
  const adSets = useQuery({
    queryKey: ["meta-ads-adsets", account.id, campaign.id],
    queryFn: () => metaAdsApi.listAdSets(account.id, campaign.id),
    retry: false,
    staleTime: LIST_STALE_MS,
  });

  if (adSets.isLoading) return <MessageRow depth={1} text="Loading ad sets…" />;
  if (adSets.isError && !adSets.data) {
    return <MessageRow depth={1} text={metaAdsErrorMessage(adSets.error, "Couldn't load this campaign's ad sets.")} />;
  }
  const list = adSets.data?.adSets ?? [];
  if (list.length === 0) {
    // A failed refetch of an empty list must not say "none": it says it could not look.
    return <MessageRow depth={1} text={adSets.isError ? "Couldn't refresh these ad sets just now." : "No ad sets in this campaign yet — nothing under it can serve."} />;
  }

  return (
    <>
      {adSets.isError ? <MessageRow depth={1} text="Couldn't refresh these ad sets just now. Showing what was loaded before." /> : null}
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
              figures={rowFigures(levelInsights.state, levelInsights.byNode.get(s.id), account.currency, true)}
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
              editor={pauseOnly && metaStatusToggle(s.status) && budgetKey(s) !== null ? <LowerBudgetButton account={account} level="ad set" node={s} /> : undefined}
              pending={pendingId === s.id}
              pauseOnly={pauseOnly}
              onToggle={(st) => onToggle("adSet", s.id, st)}
            />
            {open ? <AdRows account={account} campaign={campaign} adSet={s} pendingId={pendingId} onToggle={onToggle} pauseOnly={pauseOnly} /> : null}
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
  pauseOnly,
}: {
  account: MetaAdAccount;
  campaign: MetaCampaign;
  adSet: MetaAdSet;
  pendingId: string | undefined;
  onToggle: (level: MetaAdsLevel, id: string, status: MetaSettableStatus) => void;
  pauseOnly?: boolean;
}) {
  // One campaign-wide read shared by every open ad set (same query key), filtered below by ad set.
  const levelInsights = useLevelInsights(account, campaign.id, "ad");
  const ads = useQuery({
    queryKey: ["meta-ads-ads", account.id, adSet.id],
    queryFn: () => metaAdsApi.listAds(account.id, adSet.id),
    retry: false,
    staleTime: LIST_STALE_MS,
  });

  if (ads.isLoading) return <MessageRow depth={2} text="Loading ads…" />;
  if (ads.isError && !ads.data) return <MessageRow depth={2} text={metaAdsErrorMessage(ads.error, "Couldn't load this ad set's ads.")} />;
  const list = ads.data?.ads ?? [];
  if (list.length === 0) return <MessageRow depth={2} text={ads.isError ? "Couldn't refresh these ads just now." : "No ads in this ad set yet — it cannot serve."} />;

  return (
    <>
      {ads.isError ? <MessageRow depth={2} text="Couldn't refresh these ads just now. Showing what was loaded before." /> : null}
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
          figures={rowFigures(
            levelInsights.state,
            levelInsights.rows.find((r) => r.adId === a.id && r.adsetId === adSet.id),
            account.currency,
            true,
          )}
          note={metaNotServingBecause(a.status, { campaign: campaign.status, adSet: adSet.status })}
          open={null}
          onExpand={undefined}
          pending={pendingId === a.id}
          pauseOnly={pauseOnly}
          onToggle={(st) => onToggle("ad", a.id, st)}
        />
      ))}
    </>
  );
}

interface RowFigures {
  spend: string;
  reach: string;
  clicks: string;
  results: string;
}

/** One row's four figures by the cards' state rule; Results shows an em dash, with a tooltip, when Meta gave none. */
function rowFigures(
  state: MetaKpiState,
  row: { spend?: number; reach?: number; clicks?: number; results?: number } | undefined,
  currency: string | undefined,
  requested: boolean,
): RowFigures {
  const num = (n: number) => n.toLocaleString("en-US");
  return {
    spend: metaFigureText(state, row?.spend, (n) => formatMetaMoney(n, currency), requested),
    reach: metaFigureText(state, row?.reach, num, requested),
    clicks: metaFigureText(state, row?.clicks, num, requested),
    results: metaResultsText(state, row?.results, num, requested),
  };
}

/** Ad set or ad figures for ONE campaign - a single Graph walk, loaded when the campaign is open. */
function useLevelInsights(account: MetaAdAccount, campaignId: string, level: "adset" | "ad") {
  const q = useQuery({
    queryKey: ["meta-ads-insights", level, account.id, campaignId],
    queryFn: () => {
      const [start, end] = metaInsightsRange(INSIGHTS_DAYS);
      return metaAdsApi.insightsByLevel(campaignId, level, start, end);
    },
    retry: false,
    staleTime: INSIGHTS_STALE_MS,
  });
  const rows = useMemo(() => q.data ?? [], [q.data]);
  const byNode = useMemo(
    () => new Map(rows.map((r) => [level === "adset" ? r.adsetId : r.adId, r] as const)),
    [rows, level],
  );
  const state = metaKpiState({
    campaignsPending: false,
    campaignsError: false,
    campaignCount: 1,
    insightsPending: q.isPending,
    insightsError: q.isError && !q.data,
  });
  return { rows, byNode, state };
}

const INDENT = ["", "pl-8", "pl-14"] as const;

function NodeRow({
  depth,
  name,
  status,
  budget,
  figures,
  note,
  accountLine,
  editor,
  open,
  onExpand,
  pending,
  onToggle,
  pauseOnly = false,
}: {
  depth: 0 | 1 | 2;
  name: string;
  status: string;
  budget: string;
  figures: RowFigures;
  note: string | null;
  /** The ad account a campaign is in, shown under its name when the business uses more than one. */
  accountLine?: string;
  /** A control beside the name: a campaign's Edit, or (pause-only) Lower budget on a campaign or ad set that has a budget of its own. */
  editor?: ReactNode;
  /** `null` for a leaf (an ad), which has nothing to expand. */
  open: boolean | null;
  onExpand: (() => void) | undefined;
  pending: boolean;
  onToggle: (next: MetaSettableStatus) => void;
  /** Pause-only account: the switch only ever pauses; it is never offered to turn a node ON. */
  pauseOnly?: boolean;
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
            {accountLine ? <span className="block text-xs text-muted-foreground">{accountLine}</span> : null}
            {note ? <span className="block text-xs text-warning-on-tint">{note}</span> : null}
          </div>
          {editor}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>{status}</Badge>
      </TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{budget}</TableCell>
      <TableCell className="text-right tabular-nums">{figures.spend}</TableCell>
      <TableCell className="hidden text-right tabular-nums md:table-cell">{figures.reach}</TableCell>
      <TableCell className="hidden text-right tabular-nums md:table-cell">{figures.clicks}</TableCell>
      <TableCell className="text-right tabular-nums" title={figures.results === "\u2014" ? META_RESULTS_UNAVAILABLE_TIP : undefined}>
        {figures.results}
      </TableCell>
      <TableCell className="text-right">
        {toggle && !(pauseOnly && toggle.next === "ACTIVE") ? (
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
      <TableCell colSpan={8} className={`${INDENT[depth]} text-xs text-muted-foreground`}>
        {text}
      </TableCell>
    </TableRow>
  );
}

// ── The conversions dataset (M-19's routes, M-09's destination) ──────────

/**
 * The dataset conversions are sent to belongs to ONE ad account, so with several enabled the merchant says which (the
 * business's default first). Only enabled accounts are offered: the api refuses a dataset for any other.
 */
function DatasetCard({ accounts, defaultAccountId }: { accounts: MetaAdAccount[]; defaultAccountId: string | null }) {
  const queryClient = useQueryClient();
  const [accountPick, setAccountPick] = useState<string>("");
  const [choice, setChoice] = useState<string>("");
  const [editing, setEditing] = useState(false);

  const selected = useQuery({
    queryKey: ["meta-ads-dataset", "selected"],
    queryFn: () => metaAdsApi.getSelectedDataset(),
    retry: false,
  });
  const current = selected.data?.selected ?? null;
  // The merchant's pick comes first, then the account the dataset in use belongs to (a change keeps it unless another is
  // picked), then the business's default.
  const account =
    accounts.find((a) => a.id === accountPick) ??
    (current ? accounts.find((a) => metaAdAccountBareId(a.id) === metaAdAccountBareId(current.adAccountId)) : undefined) ??
    accounts.find((a) => a.id === defaultAccountId) ??
    accounts[0]!;
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
      setAccountPick("");
      toast.success("Purchases from Meta ads will be sent to that dataset.");
    },
    onError: (err) => toast.error(metaAdsErrorMessage(err, "Couldn't save that choice. Try again.")),
  });

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
            {accounts.length > 1 ? (
              <Select
                value={account.id}
                onValueChange={(v) => {
                  setAccountPick(v);
                  setChoice("");
                }}
              >
                <SelectTrigger aria-label="Dataset ad account" className="w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {metaAdAccountOptionLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
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
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Cancel forgets the pick, so the next edit starts from the dataset in use again.
                  setEditing(false);
                  setAccountPick("");
                  setChoice("");
                }}
              >
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
  note,
}: {
  title: string;
  total: ReturnType<typeof sumReported>;
  state: MetaKpiState;
  render: (n: number) => string;
  note?: string;
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
            {state === "ready" && total && note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
