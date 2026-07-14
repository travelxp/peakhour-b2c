"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  MousePointerClick,
  Eye,
  Trophy,
  Sparkles,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";
import { CronToolbar } from "@/components/dev/cron-toolbar";

// ── Types (mirror peakhour-api search-insights service) ─────────────────────
interface ConnectionStatus {
  provider: string;
  status?: "active" | "disconnected" | "expired" | "error";
  connectedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  account?: { externalId: string; name: string; profileUrl?: string };
}

interface CapabilitiesResponse {
  provider: string;
  account?: { extra?: { sites?: Array<{ siteUrl: string; permissionLevel: string }> } };
  properties?: Array<{ siteUrl: string; channel?: string; isDefault?: boolean }>;
  siteUrl?: string | null;
}

type ActionType = "win_the_click" | "improve_ranking" | "create_content" | "double_down";

interface SearchAction {
  type: ActionType;
  query: string;
  clicks: number;
  impressions: number;
  ctrPct: number;
  position: number;
  impact: "high" | "medium" | "low";
  estMonthlyClicks: number;
  headline: string;
  detail: string;
  recommendation: string;
}

type MovementKind = "new_winner" | "slipped" | "dropped" | "rising" | "falling";
interface Movement {
  kind: MovementKind;
  query: string;
  position: number;
  prevPosition?: number;
  impressions: number;
  detail: string;
}
interface SearchDigest {
  hasComparison: boolean;
  headline: string;
  trend: {
    clicks: { now: number; prev: number; deltaPct: number | null };
    impressions: { now: number; prev: number; deltaPct: number | null };
    avgPosition: { now: number; prev: number; delta: number | null };
  };
  movements: Movement[];
}

type HealthIssueKind = "not_indexed" | "blocked" | "canonical_mismatch" | "mobile" | "rich_results";
interface HealthIssue {
  kind: HealthIssueKind;
  url: string;
  title?: string;
  detail: string;
  recommendation: string;
}
interface HealthReport {
  checked: number;
  indexed: number;
  notIndexed: number;
  issues: HealthIssue[];
  summary: string;
}

interface SearchInsightsResponse {
  connected: boolean;
  configured: boolean;
  pending: boolean;
  isPaid: boolean;
  siteUrl?: string;
  totals?: { clicks: number; impressions: number; avgPosition: number; queries: number };
  digest?: SearchDigest;
  health?: HealthReport;
  actions: SearchAction[];
  locked: number;
}

// ── Presentation helpers ────────────────────────────────────────────────────
const ACTION_LABEL: Record<ActionType, string> = {
  win_the_click: "Win the click",
  improve_ranking: "Improve ranking",
  create_content: "Create content",
  double_down: "Double down",
};

const IMPACT_STYLE: Record<SearchAction["impact"], string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-muted text-muted-foreground",
};

const MOVEMENT_STYLE: Record<MovementKind, { dot: string; label: string }> = {
  new_winner: { dot: "bg-emerald-500", label: "New winner" },
  rising: { dot: "bg-emerald-500", label: "Rising" },
  slipped: { dot: "bg-red-500", label: "Slipped" },
  dropped: { dot: "bg-red-500", label: "Dropped" },
  falling: { dot: "bg-amber-500", label: "Falling" },
};

const HEALTH_ISSUE_LABEL: Record<HealthIssueKind, string> = {
  not_indexed: "Not indexed",
  blocked: "Blocked",
  canonical_mismatch: "Canonical mismatch",
  mobile: "Mobile",
  rich_results: "Rich results",
};

function num(n: number): string {
  return n.toLocaleString();
}

export default function SearchConsoleInsightsPage() {
  const qc = useQueryClient();
  const [property, setProperty] = useState<string | undefined>(undefined);

  const statusQ = useQuery({
    queryKey: ["integration-status", "google_search_console"],
    queryFn: () => api.get<ConnectionStatus>("/v1/integrations/google_search_console/status"),
    refetchOnWindowFocus: false,
  });

  const capQ = useQuery({
    queryKey: ["integration-cap", "google_search_console"],
    queryFn: () =>
      api.get<CapabilitiesResponse>("/v1/integrations/google_search_console/capabilities"),
    // Include "error" — a last-sync failure doesn't invalidate the verified
    // properties / picker; gating them off would wrongly show "no properties".
    enabled: statusQ.data?.status === "active" || statusQ.data?.status === "error",
    refetchOnWindowFocus: false,
  });

  const insightsQ = useQuery({
    queryKey: ["search-insights", property ?? "default"],
    queryFn: () =>
      api.get<SearchInsightsResponse>(
        `/v1/content/search-insights${property ? `?siteUrl=${encodeURIComponent(property)}` : ""}`,
      ),
    enabled: statusQ.data?.status === "active" || statusQ.data?.status === "error",
    refetchOnWindowFocus: false,
  });

  const syncMut = useMutation({
    mutationFn: () => api.post("/v1/integrations/google_search_console/sync", {}),
    onSuccess: () => {
      toast.success("Sync started — insights will refresh shortly");
      qc.invalidateQueries({ queryKey: ["integration-status"] });
      qc.invalidateQueries({ queryKey: ["search-insights"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Sync failed"),
  });

  const cronToolbar = (
    <CronToolbar
      crons={["performance-sync"]}
      onTriggered={() => {
        qc.invalidateQueries({ queryKey: ["integration-status"] });
        qc.invalidateQueries({ queryKey: ["search-insights"] });
      }}
    />
  );

  if (statusQ.isLoading) {
    return (
      <div className="p-6 space-y-4">
        {cronToolbar}
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const status = statusQ.data;
  const sites = capQ.data?.account?.extra?.sites ?? [];
  const properties = capQ.data?.properties ?? [];
  const isWorking = status?.status === "active" || status?.status === "error";
  const needsReconnect = status?.status === "expired";
  const data = insightsQ.data;

  return (
    <div className="p-6 space-y-6">
      {cronToolbar}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#458CF7] p-2">
            <Search className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Search Console</h1>
            <p className="text-sm text-muted-foreground">
              What&apos;s happening in Google Search — and what to do about it.
            </p>
          </div>
        </div>
        {isWorking && (
          <div className="flex items-center gap-2">
            {properties.length > 1 && (
              <Select value={property ?? "__default__"} onValueChange={(v) => setProperty(v === "__default__" ? undefined : v)}>
                <SelectTrigger className="w-55">
                  <SelectValue placeholder="Property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default property</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.siteUrl} value={p.siteUrl}>
                      {p.siteUrl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={syncMut.isPending}
              onClick={() => syncMut.mutate()}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} />
              Sync now
            </Button>
          </div>
        )}
      </div>

      {!isWorking ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {needsReconnect ? "Connection expired" : "Not connected"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {needsReconnect
                ? "Your Search Console connection expired. Reconnect to resume tracking what's happening in search."
                : "Connect Google Search Console to see which pages are winning, which are slipping, and exactly what to do next."}
            </p>
            <Button asChild>
              <Link href="/dashboard/integrations">
                {needsReconnect ? "Reconnect" : "Go to integrations"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {status?.lastError && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <strong>Last sync note:</strong> {status.lastError}
            </div>
          )}

          {/* ── Empty states from the insights endpoint ── */}
          {insightsQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : insightsQ.isError ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" />
                  Couldn&apos;t load your insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  We couldn&apos;t reach your Search Console insights just now. This is usually
                  temporary.
                </p>
                <Button size="sm" variant="outline" onClick={() => insightsQ.refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </Button>
              </CardContent>
            </Card>
          ) : data && !data.configured ? (
            <NoticeCard
              title="Finish setup"
              body={
                sites.length === 0
                  ? "No verified Search Console properties were found for this account. Verify a domain in Search Console, then reconnect."
                  : "Pick which verified property to track from the Integrations page to start seeing insights."
              }
              cta={{ href: "/dashboard/integrations", label: "Go to integrations" }}
            />
          ) : data && data.pending ? (
            <NoticeCard
              title="Gathering your data"
              body="We've connected to Search Console and the first sync is on its way. Check back shortly — or hit “Sync now”."
            />
          ) : data && data.connected ? (
            <>
              {/* ── What's happening digest ── */}
              {data.digest && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">What&apos;s happening</CardTitle>
                    <p className="text-sm">{data.digest.headline}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <TrendTile
                        icon={<MousePointerClick className="h-4 w-4" />}
                        label="Clicks"
                        value={data.digest.trend.clicks.now}
                        deltaPct={data.digest.trend.clicks.deltaPct}
                      />
                      <TrendTile
                        icon={<Eye className="h-4 w-4" />}
                        label="Impressions"
                        value={data.digest.trend.impressions.now}
                        deltaPct={data.digest.trend.impressions.deltaPct}
                      />
                      <PositionTile
                        now={data.digest.trend.avgPosition.now}
                        delta={data.digest.trend.avgPosition.delta}
                      />
                    </div>

                    {data.digest.movements.length > 0 && (
                      <ul className="space-y-1.5">
                        {data.digest.movements.map((m, i) => (
                          <li key={`${m.kind}-${m.query}-${i}`} className="flex items-start gap-2 text-sm">
                            <span
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${MOVEMENT_STYLE[m.kind].dot}`}
                              aria-hidden
                            />
                            <span className="text-muted-foreground">
                              <span className="sr-only">{MOVEMENT_STYLE[m.kind].label}: </span>
                              {m.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {!data.digest.hasComparison && (
                      <p className="text-xs text-muted-foreground">
                        We&apos;ll show week-over-week movements once there&apos;s a second sync to compare against.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── Index health (URL Inspection) ── */}
              {data.health && data.health.checked > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldCheck className="h-4 w-4" />
                      Site health in Google
                    </CardTitle>
                    <p className="text-sm">{data.health.summary}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{data.health.indexed}</span> indexed
                      </span>
                      {data.health.notIndexed > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          <span className="font-medium">{data.health.notIndexed}</span> not indexed
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{data.health.checked}</span> pages checked
                      </span>
                    </div>
                    {data.health.issues.length > 0 && (
                      <ul className="space-y-2">
                        {data.health.issues.map((iss, i) => (
                          <li key={`${iss.kind}-${iss.url}-${i}`} className="rounded-md border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <a
                                href={iss.url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate font-mono text-xs underline"
                                title={iss.url}
                              >
                                {iss.title || iss.url}
                              </a>
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {HEALTH_ISSUE_LABEL[iss.kind]}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{iss.detail}</p>
                            <p className="mt-1 text-sm">
                              <span className="font-medium">Do this: </span>
                              {iss.recommendation}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── Action worklist ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">What to do next</h2>
                  {data.siteUrl && (
                    <span className="font-mono text-xs text-muted-foreground">{data.siteUrl}</span>
                  )}
                </div>

                {data.actions.length === 0 ? (
                  <NoticeCard
                    title="No actions right now"
                    body="Once your pages gather enough search impressions, we'll surface the highest-impact things to do here."
                  />
                ) : (
                  data.actions.map((a, i) => <ActionCard key={`${a.query}-${i}`} action={a} />)
                )}

                {data.locked > 0 && (
                  <Card className="border-dashed">
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div className="flex items-center gap-3">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          <strong className="text-foreground">{data.locked} more</strong> ranked
                          actions are ready on the Content plan.
                        </p>
                      </div>
                      <Button asChild size="sm">
                        <Link href="/dashboard/plans">
                          Unlock all
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          ) : null}

          {/* ── Connection detail (verified sites) ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Connection</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {status?.account?.name ?? status?.account?.externalId}
                  {status?.lastSyncAt && (
                    <span className="ml-2">
                      · Last sync {new Date(status.lastSyncAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <strong className="mb-1 block text-sm">Verified properties</strong>
              {sites.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No verified Search Console properties found for this account.{" "}
                  <a
                    href="https://search.google.com/search-console"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Verify a domain
                    <ExternalLink className="ml-1 inline h-3 w-3" />
                  </a>
                </p>
              ) : (
                <ul className="space-y-1">
                  {sites.map((s) => (
                    <li
                      key={s.siteUrl}
                      className="flex items-center justify-between rounded border px-2 py-1"
                    >
                      <span className="font-mono text-xs">{s.siteUrl}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {s.permissionLevel}
                        </Badge>
                        {data?.siteUrl === s.siteUrl && <Badge className="text-xs">Active</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function NoticeCard({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{body}</p>
        {cta && (
          <Button asChild size="sm" variant="outline">
            <Link href={cta.href}>
              {cta.label}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TrendTile({
  icon,
  label,
  value,
  deltaPct,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  deltaPct: number | null;
}) {
  const up = deltaPct !== null && deltaPct > 0;
  const down = deltaPct !== null && deltaPct < 0;
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{num(value)}</span>
        {deltaPct !== null && (
          <span
            className={`flex items-center gap-0.5 text-xs font-medium ${
              up ? "text-emerald-600 dark:text-emerald-400" : down ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
            }`}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : down ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(deltaPct)}%
          </span>
        )}
      </div>
    </div>
  );
}

/** Average position is INVERTED — a lower number is better, so a negative
 *  delta reads as an improvement. Spell it out rather than trust an arrow. */
function PositionTile({ now, delta }: { now: number; delta: number | null }) {
  const improved = delta !== null && delta < 0;
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Trophy className="h-4 w-4" />
        Avg. position
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{now || "—"}</span>
        {delta !== null && delta !== 0 && (
          <span
            className={`flex items-center gap-0.5 text-xs font-medium ${
              improved ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {improved ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {improved ? "improved" : "declined"}
          </span>
        )}
      </div>
    </div>
  );
}

function ActionCard({ action: a }: { action: SearchAction }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#458CF7]" />
            <span className="text-sm font-semibold">{a.headline}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {ACTION_LABEL[a.type]}
            </Badge>
            <Badge className={`text-xs ${IMPACT_STYLE[a.impact]}`}>{a.impact} impact</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{a.detail}</p>
        <p className="text-sm">
          <span className="font-medium">Do this: </span>
          {a.recommendation}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Position {a.position}</span>
          <span>{num(a.impressions)} impressions</span>
          <span>{a.ctrPct}% CTR</span>
          {a.estMonthlyClicks > 0 && (
            <span className="text-foreground">~{num(a.estMonthlyClicks)} clicks/mo upside</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
