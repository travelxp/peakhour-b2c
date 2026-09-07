"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileText,
  Star,
  Megaphone,
  Users,
  Plug,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  Zap,
  Mail,
} from "lucide-react";
import { LinkedinIcon } from "@/components/brand/brand-icons";
import { DiscoveryProgressStrip } from "@/components/dashboard/discovery-progress-strip";
import { FootprintReviewCard } from "@/components/dashboard/footprint-review-card";
import { RecommendationsCard } from "@/components/dashboard/recommendations-card";
import { BrandMirrorCard } from "@/components/dashboard/brand-mirror-card";
import { AskCard } from "@/components/dashboard/ask-card";
import { PageShell } from "@/components/dashboard/page-shell";
import { OvernightRibbon } from "@/components/dashboard/overnight-ribbon";
import { OverviewGreeting } from "@/components/dashboard/overview-greeting";
import { WaitingForYou } from "@/components/dashboard/waiting-for-you";
import { WorkCompletedCard } from "@/components/dashboard/work-completed-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SetupChecklist, type SetupStep } from "@/components/dashboard/setup-checklist";
import {
  BusinessAtAGlance,
  GlanceCard,
} from "@/components/dashboard/business-at-a-glance";
import { useHomeSummary } from "@/hooks/use-home-summary";

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

export default function OverviewPage() {
  const queryClient = useQueryClient();
  const { org, business } = useAuth();

  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["dashboard-stats", org?._id],
    queryFn: () => api.get<DashboardStats>("/v1/dashboard/stats"),
    enabled: !!org,
  });

  // Discovery snapshot for the new widgets — separate query so the widgets
  // refetch independently when the user actions a footprint/recommendation
  // (the widgets call queryClient.invalidateQueries(["dashboard-discovery"])).
  const { data: discovery } = useQuery({
    queryKey: ["dashboard-discovery", org?._id, business?._id],
    queryFn: () => api.get<DashboardDiscovery>("/v1/onboarding/discovery"),
    enabled: !!org && !!business,
  });

  // The overnight ribbon and the cross-pillar queue both come from
  // /v1/home/summary — one round trip, already polled on a 60s cadence.
  const { data: home, isLoading: homeLoading } = useHomeSummary();

  const onboardingComplete = stats?.onboarding?.completed;
  const hasContent = (stats?.content.total ?? 0) > 0;
  const anyConnection = Boolean(
    stats?.connections.linkedinContent ||
      stats?.connections.linkedinAds ||
      stats?.connections.beehiiv,
  );

  return (
    <PageShell width="wide">
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

      {/* ★THE BUSINESS NAME, NOT THE ORG NAME. They are usually the same string
          — and where they differ, the business is the one every surface below
          this point is scoped to. The org is a billing container. */}
      <OverviewGreeting
        businessName={business?.name ?? org?.name}
        websiteUrl={stats?.websiteUrl}
      />

      {/* What ran overnight. Sits directly under the greeting because it
          answers the question the page is opened to ask. */}
      <OvernightRibbon activity={home?.activity} />

      {/* Discovery progress strip — only visible while a bg job is alive */}
      {discovery?.activeJob && (
        <DiscoveryProgressStrip jobId={discovery.activeJob.jobId} />
      )}

      {/* Setup nudge — only while something is genuinely outstanding. */}
      {stats && !onboardingComplete && (
        <SetupChecklist steps={setupSteps(stats, hasContent, anyConnection)} />
      )}

      {isError && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load dashboard data. Please try refreshing.
        </div>
      )}

      {/* Footprint review — auto-archives once all entries are reviewed */}
      {discovery?.pendingFootprint && discovery.pendingFootprint.length > 0 && (
        <FootprintReviewCard pending={discovery.pendingFootprint} />
      )}

      {/* "Where to grow next" — persistent, refreshed weekly post-MVP */}
      {discovery?.pendingRecommendations && discovery.pendingRecommendations.length > 0 && (
        <RecommendationsCard recommendations={discovery.pendingRecommendations} />
      )}

      {/* ── Your business at a glance ─────────────────────────
          The four figures, each with what it means and one next step. Every
          card links to the exact screen its number is about, so a count is
          never a dead end. */}
      <BusinessAtAGlance>
        <GlanceCard
          label="Content library"
          icon={FileText}
          series={2}
          value={hasContent ? stats?.content.total : null}
          meaning={
            stats?.content.tagged
              ? `${stats.content.tagged} analysed by AI and ready to repurpose`
              : "Waiting to be analysed — tagging runs automatically"
          }
          action="Open library"
          href="/dashboard/content"
          emptyAction="Import your first content"
          loading={isLoading}
        />
        <GlanceCard
          label="High potential"
          icon={Star}
          series={2}
          value={hasContent ? stats?.content.highPotential : null}
          meaning={
            (stats?.content.highPotential ?? 0) > 0
              ? "Scored 7+ for ad potential — the best candidates to put budget behind"
              : "Nothing has scored 7+ yet. Scores land as content is analysed."
          }
          action={
            (stats?.content.highPotential ?? 0) > 0 ? "Turn one into an ad" : "See how scoring works"
          }
          href="/dashboard/content"
          emptyAction="Add content to start scoring"
          loading={isLoading}
        />
        <GlanceCard
          label="Active campaigns"
          icon={Megaphone}
          series={3}
          // A real zero, shown as zero: this business HAS an ads connection and
          // the honest answer is "none running". Only an org with no ads
          // connection at all gets the invitation instead.
          value={stats?.connections.linkedinAds ? stats?.campaigns.active : null}
          meaning={
            stats?.campaigns.total
              ? `${stats.campaigns.total} created in total`
              : "No campaigns yet — your first can run off content you already have"
          }
          action={stats?.campaigns.active ? "Review performance" : "Launch your first"}
          href="/dashboard/ads?channel=linkedin"
          emptyAction="Connect ads to run campaigns"
          loading={isLoading}
        />
        {/* Customers has no data source until outcomes attribution has an ads
            connection to read. It shows the reason as the next step rather
            than a placeholder figure — a dash in a headline slot is the
            clearest way to tell someone software is unfinished. */}
        <GlanceCard
          label="Customers"
          icon={Users}
          series={4}
          value={null}
          action="See what gets tracked"
          href="/dashboard/outcomes"
          emptyAction="Connect ads to start tracking"
          loading={isLoading}
        />
      </BusinessAtAGlance>

      {/* Every decision the platform is holding, in one list, beside what the
          platform has been getting done on its own. What needs you, and what
          did not. */}
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <WaitingForYou
          items={home?.needsYou}
          total={home?.kpis.needsYou}
          isLoading={homeLoading}
        />
        <WorkCompletedCard />
      </div>

      {/* "What we understand about you" — the Brand Mirror. Self-fetching;
          renders nothing until there is understanding to reflect. */}
      <BrandMirrorCard />

      {/* Ask Peakhour entry point (self-hides unless the flag is on). */}
      <AskCard />

      {/* ── Setup state ───────────────────────────────────────
          ★MOVED OUT FROM BESIDE "WAITING FOR YOU", ON PURPOSE. Neither of these
          is a decision being held: an unconnected channel is a standing option
          and an unfinished setup step is a state. Sitting them next to the
          queue is what made the queue's count stop meaning anything urgent. */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Connected channels</CardTitle>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                <Link href="/dashboard/integrations">
                  Manage
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <IntegrationRow
              name="LinkedIn Content"
              description="Publish posts to your company page"
              icon={<LinkedinIcon className="h-4 w-4" />}
              iconBg="bg-[#0A66C2]"
              connected={stats?.connections.linkedinContent}
              loading={isLoading}
            />
            <IntegrationRow
              name="LinkedIn Ads"
              description="Run campaigns and track analytics"
              icon={<LinkedinIcon className="h-4 w-4" />}
              iconBg="bg-[#0A66C2]"
              connected={stats?.connections.linkedinAds}
              loading={isLoading}
              warning={
                stats?.connections.linkedinAds && !stats?.connections.linkedinAdsHasAdAccount
                  ? "No ad account — create one on LinkedIn"
                  : undefined
              }
            />
            <IntegrationRow
              name="Beehiiv"
              description="Import newsletters for AI tagging"
              icon={<Mail className="h-4 w-4" />}
              iconBg="bg-[#FFD100] text-black"
              connected={stats?.connections.beehiiv}
              loading={isLoading}
              connectedLabel={hasContent ? `${stats?.content.total} posts synced` : "Connected"}
            />
            {!isLoading && !anyConnection && (
              <Button asChild size="sm" className="mt-2 w-full">
                <Link href="/dashboard/integrations">
                  <Plug className="mr-1.5 h-3.5 w-3.5" />
                  Connect your first channel
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base font-semibold">AI engine</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <EngineStep
              label="Business analysed"
              done={stats?.hasTaxonomy}
              loading={isLoading}
            />
            <EngineStep label="Content imported" done={hasContent} loading={isLoading} />
            <EngineStep label="Budget configured" done={stats?.hasBudget} loading={isLoading} />

            {!isLoading && onboardingComplete && (
              <div className="mt-2 rounded-xl border border-primary/10 bg-primary/5 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Zap className="h-4 w-4" />
                  Engine active
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  AI is analysing content and generating insights
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <QuickActions />
    </PageShell>
  );
}

// ── Setup steps ────────────────────────────────────────────

/**
 * The three things "Set up your AI engine" is actually measuring, each pointed
 * at the screen that changes it.
 *
 * ★STEP ONE GOES TO THE BUSINESS PROFILE, NOT TO /onboarding/add-business.
 * That was the "incorrect upgrade error": add-business ends at
 * `POST /onboarding/confirm`, which gates on the plan's Business capacity and
 * answers 402 BUSINESS_LIMIT_REACHED for any org that already has its one
 * business — i.e. every org that can see this banner. The dashboard asked the
 * owner to finish telling us about their business and the product replied that
 * they had to upgrade to add another one. `/dashboard/growth/business` is the
 * screen that reads and writes the profile for the business already in the
 * session, which is the thing this step measures.
 *
 * ★AND STEP THREE IS NO LONGER "onboarding complete". The old list carried a
 * fourth row for the persisted flag, which is not a step — it is the SUMMARY of
 * the other three. An owner who had done all three still saw "3 of 4", with a
 * fourth item they could not act on.
 */
function setupSteps(
  stats: DashboardStats,
  hasContent: boolean,
  anyConnection: boolean,
): SetupStep[] {
  return [
    {
      label: "Tell us about your business",
      detail: "What you sell and who for — everything we write is grounded in this.",
      done: Boolean(stats.hasTaxonomy),
      href: "/dashboard/growth/business",
    },
    {
      label: "Connect a channel",
      detail: "Where Peakhour publishes and listens. One is enough to start.",
      done: anyConnection,
      href: "/dashboard/integrations",
    },
    {
      label: "Bring in your content",
      detail: "Import or write your first piece so there is something to work with.",
      done: hasContent,
      href: "/dashboard/content",
    },
  ];
}

// ── Integration Row ────────────────────────────────────────

function IntegrationRow({
  name,
  description,
  icon,
  iconBg,
  connected,
  loading,
  connectedLabel,
  warning,
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  connected?: boolean;
  loading: boolean;
  connectedLabel?: string;
  warning?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors hover:bg-muted/30">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{description}</p>
        </div>
        {loading ? (
          <span className="inline-block h-5 w-16 animate-pulse rounded-full bg-muted" />
        ) : connected ? (
          <Badge className="shrink-0 gap-1 bg-success/90 text-[10px] font-medium">
            <CheckCircle className="h-2.5 w-2.5" />
            {connectedLabel || "Live"}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
            Not connected
          </Badge>
        )}
      </div>
      {warning && (
        <div className="ml-11 flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-1.5 text-[11px] text-warning-on-tint">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {warning}
        </div>
      )}
    </div>
  );
}

// ── Engine Step ────────────────────────────────────────────

function EngineStep({
  label,
  done,
  loading,
}: {
  label: string;
  done?: boolean;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {loading ? (
        <span className="inline-block h-5 w-5 shrink-0 animate-pulse rounded-full bg-muted" />
      ) : done ? (
        <CheckCircle className="h-5 w-5 shrink-0 text-success" />
      ) : (
        <div className="h-5 w-5 shrink-0 rounded-full border-2 border-muted" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
