"use client";

import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Star,
  Megaphone,
  Plug,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  Package,
  Send,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { DiscoveryProgressStrip } from "@/components/dashboard/discovery-progress-strip";
import { PageShell } from "@/components/dashboard/page-shell";
import { OvernightRibbon } from "@/components/dashboard/overnight-ribbon";
import { OverviewGreeting } from "@/components/dashboard/overview-greeting";
import { WaitingForYou } from "@/components/dashboard/waiting-for-you";
import { WorkCompletedCard } from "@/components/dashboard/work-completed-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { QueryError } from "@/components/dashboard/query-error";
import {
  BusinessAtAGlance,
  GlanceCard,
} from "@/components/dashboard/business-at-a-glance";
import { useHomeSummary } from "@/hooks/use-home-summary";
import { queryViewState } from "@/lib/query-view-state";
import {
  connectedAccounts,
  glanceFigures,
  setupOutstanding,
  setupSteps,
  type GlanceKey,
} from "@/lib/home-overview";
import {
  PROVIDER_COLORS,
  PROVIDER_ICONS,
  type Integration,
} from "../integrations/_components/shared";

// Below the first screen (or shown only when there is something to review), so they load on demand.
const FootprintReviewCard = dynamic(() => import("@/components/dashboard/footprint-review-card").then((mod) => mod.FootprintReviewCard));
const RecommendationsCard = dynamic(() => import("@/components/dashboard/recommendations-card").then((mod) => mod.RecommendationsCard));
const BrandMirrorCard = dynamic(() => import("@/components/dashboard/brand-mirror-card").then((mod) => mod.BrandMirrorCard));
const AskCard = dynamic(() => import("@/components/dashboard/ask-card").then((mod) => mod.AskCard));

interface DashboardStats {
  content: {
    total: number;
    tagged: number;
    highPotential: number;
  };
  campaigns: {
    active: number;
    total: number;
  };
  connections: {
    linkedinContent: boolean;
    linkedinAds: boolean;
    linkedinAdsHasAdAccount: boolean;
    beehiiv: boolean;
  };
  onboarding: {
    completed: boolean;
  };
  hasBudget: boolean;
  hasTaxonomy: boolean;
  businessType: string | null;
  websiteUrl: string | null;
}

interface DashboardDiscovery {
  techStack: { cms?: string; hosting?: string } | null;
  pendingFootprint: Array<{
    url: string;
    source: string;
    handle?: string;
    confidence?: number;
    evidence?: string;
    confirmedByUser?: boolean | null;
  }>;
  pendingRecommendations: Array<{
    platform: string;
    rationale: string;
    digitalLiteracyTips?: string[];
    firstAction: string;
    status?: string;
  }>;
  activeJob: { jobId: string; status: string } | null;
  business: { _id: string; name: string; websiteUrl: string | null };
}

const GLANCE_ICON: Record<GlanceKey, { icon: LucideIcon; series: 1 | 2 | 3 | 4 | 5 }> = {
  products: { icon: Package, series: 1 },
  published: { icon: Send, series: 2 },
  scheduled: { icon: CalendarClock, series: 2 },
  content: { icon: FileText, series: 2 },
  adReady: { icon: Star, series: 2 },
  campaigns: { icon: Megaphone, series: 3 },
};

/**
 * Home, in the order a merchant reads it: what happened and what is waiting
 * for them first, then the few figures that have real data, then setup (only
 * while unfinished) and which accounts are connected. The supplementary cards
 * (brand summary, Ask, quick actions) sit in the PageShell rail at 2xl and
 * stack under the main column below that.
 */
export default function OverviewPage() {
  const queryClient = useQueryClient();
  const { org, business } = useAuth();

  const statsQuery = useQuery({
    queryKey: ["dashboard-stats", org?._id],
    queryFn: () => api.get<DashboardStats>("/v1/dashboard/stats"),
    enabled: !!org,
  });
  const stats = statsQuery.data;
  const statsView = queryViewState(statsQuery);

  // Discovery snapshot for the footprint and recommendation cards - a separate
  // query so they refetch independently when the merchant actions one (the
  // cards call queryClient.invalidateQueries(["dashboard-discovery"])).
  const { data: discovery } = useQuery({
    queryKey: ["dashboard-discovery", org?._id, business?._id],
    queryFn: () => api.get<DashboardDiscovery>("/v1/onboarding/discovery"),
    enabled: !!org && !!business,
  });

  // The overnight ribbon and the cross-pillar queue both come from
  // /v1/home/summary - one round trip, already polled on a 60s cadence.
  const { data: home, isLoading: homeLoading } = useHomeSummary();

  // The merchant's real integrations. Same key and fetcher as the ads hub, so
  // the two screens share one cache entry.
  const integrationsQuery = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () => api.get<{ integrations: Integration[] }>("/v1/integrations"),
    enabled: !!org,
    staleTime: 30_000,
  });
  const integrationsView = queryViewState(integrationsQuery);
  const accounts = connectedAccounts(integrationsQuery.data?.integrations);

  const hasContent = (stats?.content.total ?? 0) > 0;
  // The integrations list is the source of truth; the stats flags only stand
  // in until it has loaded (or if it failed).
  const statsHasConnection = Boolean(
    stats?.connections.linkedinContent ||
      stats?.connections.linkedinAds ||
      stats?.connections.beehiiv,
  );
  const hasAccount = integrationsQuery.data ? accounts.length > 0 : statsHasConnection;
  const steps = setupSteps({
    hasProfile: Boolean(stats?.hasTaxonomy),
    hasAccount,
    hasContent,
  });
  const showSetup = stats !== undefined && !stats.onboarding?.completed && setupOutstanding(steps);
  const figures = glanceFigures(stats, home);

  const rail = (
    <>
      {/* "What we understand about you" - self-fetching; renders nothing until
          there is something to reflect. */}
      <BrandMirrorCard />
      {/* Ask Peakhour entry point (self-hides unless the flag is on). */}
      <AskCard />
      <QuickActions />
    </>
  );

  return (
    <PageShell width="wide" rail={rail}>
      <CronToolbar
        crons={[
          "discovery-runner",
          "jobs-runner",
          "tag-catchup",
          "beehiiv-sync",
          "linkedin-post-sync",
        ]}
        onTriggered={() => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-discovery"] });
        }}
      />

      {/* The business name, not the org name: they are usually the same string,
          and where they differ the business is what every surface below is
          scoped to. The org is a billing container. */}
      <OverviewGreeting
        businessName={business?.name ?? org?.name}
        websiteUrl={stats?.websiteUrl}
      />

      {/* What ran overnight - the question the page is opened to ask. */}
      <OvernightRibbon activity={home?.activity} />

      {/* Discovery progress strip - only visible while a background job is alive */}
      {discovery?.activeJob && <DiscoveryProgressStrip jobId={discovery.activeJob.jobId} />}

      {/* Everything the platform is holding for a decision, beside what it got
          done on its own. First and widest: it is the part that needs the
          merchant. */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <WaitingForYou
          items={home?.needsYou}
          total={home?.kpis.needsYou}
          isLoading={homeLoading}
        />
        <WorkCompletedCard />
      </div>

      {/* Headline figures - only those with a real source for this business. */}
      {statsView === "error" ? (
        <QueryError what="your figures" onRetry={() => statsQuery.refetch()} />
      ) : statsView === "offline" ? (
        <QueryError what="your figures" kind="offline" />
      ) : statsView === "loading" ? (
        <BusinessAtAGlance>
          {[0, 1, 2].map((i) => (
            <GlanceCard key={i} label="Loading" icon={FileText} series={2} action="" href="#" loading />
          ))}
        </BusinessAtAGlance>
      ) : (
        figures.length > 0 && (
          <BusinessAtAGlance>
            {figures.map((f) => (
              <GlanceCard
                key={f.key}
                label={f.label}
                icon={GLANCE_ICON[f.key].icon}
                series={GLANCE_ICON[f.key].series}
                value={f.value}
                meaning={f.meaning}
                action={f.action}
                href={f.href}
              />
            ))}
          </BusinessAtAGlance>
        )
      )}

      {/* The one setup list. Leaves when everything is done. */}
      {showSetup && <SetupChecklist steps={steps} />}

      <ConnectedAccountsCard
        view={integrationsView}
        accounts={accounts}
        onRetry={() => integrationsQuery.refetch()}
      />

      {/* Footprint review - auto-archives once all entries are reviewed */}
      {discovery?.pendingFootprint && discovery.pendingFootprint.length > 0 && (
        <FootprintReviewCard pending={discovery.pendingFootprint} />
      )}

      {/* "Where to grow next" */}
      {discovery?.pendingRecommendations && discovery.pendingRecommendations.length > 0 && (
        <RecommendationsCard recommendations={discovery.pendingRecommendations} />
      )}
    </PageShell>
  );
}

// ── Connected accounts ─────────────────────────────────────

function ConnectedAccountsCard({
  view,
  accounts,
  onRetry,
}: {
  view: ReturnType<typeof queryViewState>;
  accounts: ReturnType<typeof connectedAccounts>;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Connected accounts</CardTitle>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
            <Link href="/dashboard/integrations">
              {accounts.length > 0 ? "Connect more" : "Connect an account"}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {view === "loading" ? (
          <span className="block h-12 animate-pulse rounded-xl bg-muted" />
        ) : view === "error" ? (
          <QueryError what="your connected accounts" onRetry={onRetry} />
        ) : view === "offline" ? (
          <QueryError what="your connected accounts" kind="offline" />
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Nothing is connected yet. Connect your store, website, Google Business Profile or a
              social page so Peakhour has something to work on.
            </p>
            <Button asChild size="sm" className="shrink-0">
              <Link href="/dashboard/integrations">
                <Plug className="mr-1.5 h-3.5 w-3.5" />
                Connect your first account
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => {
              const Icon = PROVIDER_ICONS[a.provider] ?? Plug;
              const bg = PROVIDER_COLORS[a.provider] ?? "bg-muted-foreground";
              return (
                <li
                  key={a.provider}
                  className="flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${bg}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.name}</p>
                    {a.accountName && (
                      <p className="truncate text-micro text-muted-foreground">{a.accountName}</p>
                    )}
                  </div>
                  {a.state === "live" ? (
                    <Badge className="shrink-0 gap-1 bg-success text-success-foreground text-micro font-medium">
                      <CheckCircle className="h-2.5 w-2.5" />
                      Live
                    </Badge>
                  ) : (
                    <Button asChild size="sm" variant="outline" className="shrink-0 gap-1 text-xs">
                      <Link href="/dashboard/integrations">
                        <AlertCircle className="h-3 w-3" />
                        Reconnect
                      </Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
