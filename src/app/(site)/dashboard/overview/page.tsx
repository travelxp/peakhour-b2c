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
  ArrowRight,
  ArrowUpRight,
  TrendingUp,
  Zap,
  Globe,
  Mail,
} from "lucide-react";
import { LinkedinIcon } from "@/components/brand/brand-icons";
import { DiscoveryProgressStrip } from "@/components/dashboard/discovery-progress-strip";
import { FootprintReviewCard } from "@/components/dashboard/footprint-review-card";
import { RecommendationsCard } from "@/components/dashboard/recommendations-card";
import { BrandMirrorCard } from "@/components/dashboard/brand-mirror-card";
import { AskCard } from "@/components/dashboard/ask-card";
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";
import { OvernightRibbon } from "@/components/dashboard/overnight-ribbon";
import { WaitingForYou } from "@/components/dashboard/waiting-for-you";
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
      {/* Hero header. Was the app's only `text-3xl` title, and sat in a
          non-wrapping `items-end justify-between` row: because the URL is one
          unbreakable word, its automatic minimum size was the full URL width,
          so a long org name plus a long domain forced the row wider than the
          viewport rather than either side giving way. PageHeader stacks the
          two under `sm` and puts the page on the same title scale as every
          other route.

          The explicit max-width is load-bearing. PageHeader holds its actions
          track at natural width (`shrink-0`) so buttons are never squashed —
          which means a variable-width action like this one has to cap itself,
          or `truncate` below can never engage.

          The cap is flat, not viewport-relative, and it steps UP rather than
          down. Below `sm` this link already owns a full-width row of its own
          (PageHeader is `flex-col` there), so a `vw` cap only truncated the
          URL earlier than necessary for no gain. The binding case is the
          opposite end: at a 768px viewport the sidebar is expanded and the
          content area is just 464px, so a generous cap here would leave the
          org name a ~164px column. 192px until `lg`, 288px above it.

          One deliberate visual change: the link used to be `items-end`
          (baseline-aligned with the description); PageHeader is
          `sm:items-start`, so it now sits level with the title. */}
      <PageHeader
        title={org?.name || "Dashboard"}
        description={stats?.businessType || "Your AI marketing command center"}
        actions={
          stats?.websiteUrl ? (
            <a
              href={stats.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground sm:max-w-48 lg:max-w-72"
            >
              <Globe className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {stats.websiteUrl
                  .replace(/^https?:\/\/(www\.)?/, "")
                  .replace(/\/$/, "")}
              </span>
            </a>
          ) : undefined
        }
      />

      {/* What ran overnight. Sits directly under the header because it
          answers the question the page is opened to ask. */}
      <OvernightRibbon activity={home?.activity} />

      {/* Discovery progress strip — only visible while a bg job is alive */}
      {discovery?.activeJob && (
        <DiscoveryProgressStrip jobId={discovery.activeJob.jobId} />
      )}

      {/* Footprint review — auto-archives once all entries are reviewed */}
      {discovery?.pendingFootprint && discovery.pendingFootprint.length > 0 && (
        <FootprintReviewCard pending={discovery.pendingFootprint} />
      )}

      {/* "Where to grow next" — persistent, refreshed weekly post-MVP */}
      {discovery?.pendingRecommendations && discovery.pendingRecommendations.length > 0 && (
        <RecommendationsCard recommendations={discovery.pendingRecommendations} />
      )}

      {/* "What we understand about you" — the Brand Mirror. Self-fetching;
          renders nothing until there is understanding to reflect. */}
      <BrandMirrorCard />

      {/* Ask Peakhour entry point (self-hides unless the flag is on). */}
      <AskCard />

      {isError && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load dashboard data. Please try refreshing.
        </div>
      )}

      {/* Setup nudge — only when onboarding not complete */}
      {stats && !onboardingComplete && (
        <SetupBanner stats={stats} />
      )}

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Content Library"
          value={stats?.content.total}
          change={stats?.content.tagged ? `${stats.content.tagged} AI-tagged` : undefined}
          icon={FileText}
          series={4}
          loading={isLoading}
          href="/dashboard/content"
        />
        <KpiCard
          label="High Potential"
          value={stats?.content.highPotential}
          change="Ad score 7+"
          icon={Star}
          series={1}
          loading={isLoading}
          href="/dashboard/content"
        />
        <KpiCard
          label="Active Campaigns"
          value={stats?.campaigns.active}
          change={
            stats?.campaigns.total
              ? `${stats.campaigns.total} total`
              : "Not started yet"
          }
          icon={Megaphone}
          series={2}
          loading={isLoading}
          href="/dashboard/ads?channel=linkedin"
        />
        <KpiCard
          label="Customers"
          value="--"
          change="Connect ads to track"
          icon={Users}
          series={3}
          loading={isLoading}
          href="/dashboard/outcomes"
        />
      </div>

      {/* Every decision the platform is holding, in one list. Cross-pillar:
          a failed post and an unread pricing recommendation ask the same
          thing of the same person, so they belong in the same queue. */}
      <WaitingForYou
        items={home?.needsYou}
        total={home?.kpis.needsYou}
        isLoading={homeLoading}
      />

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left: Integrations status — wider */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Integrations</CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground">
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
            {!isLoading &&
              !(
                stats?.connections.linkedinContent ||
                stats?.connections.linkedinAds ||
                stats?.connections.beehiiv
              ) && (
                <Button asChild size="sm" className="w-full mt-2">
                  <Link href="/dashboard/integrations">
                    <Plug className="h-3.5 w-3.5 mr-1.5" />
                    Connect your first integration
                  </Link>
                </Button>
              )}
          </CardContent>
        </Card>

        {/* Right: AI Engine status */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base font-semibold">AI Engine</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <EngineStep
              label="Business analyzed"
              done={stats?.hasTaxonomy}
              loading={isLoading}
            />
            <EngineStep
              label="Content imported"
              done={hasContent}
              loading={isLoading}
            />
            <EngineStep
              label="Budget configured"
              done={stats?.hasBudget}
              loading={isLoading}
            />
            <EngineStep
              label="Onboarding complete"
              done={onboardingComplete}
              loading={isLoading}
            />

            {!isLoading && onboardingComplete && (
              <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 mt-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Zap className="h-4 w-4" />
                  Engine active
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AI is analyzing content and generating insights
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions — only when onboarding complete */}
      {onboardingComplete && (
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickAction
            href="/dashboard/content"
            icon={FileText}
            label="Browse content"
            description="View tagged newsletters"
          />
          <QuickAction
            href="/dashboard/integrations"
            icon={Plug}
            label="Manage integrations"
            description="Connect or sync platforms"
          />
          <QuickAction
            href="/dashboard/settings"
            icon={TrendingUp}
            label="Business settings"
            description="Edit taxonomy and budget"
          />
        </div>
      )}
    </PageShell>
  );
}

// ── Setup Banner ───────────────────────────────────────────

function SetupBanner({ stats }: { stats: DashboardStats }) {
  // Budget is no longer collected during onboarding — moved to settings.
  // Pointing the user at the integrations page is the natural next step
  // after onboarding completes.
  const steps = [
    { done: stats.hasTaxonomy, label: "Tell us about you", href: "/onboarding/add-business" },
    { done: stats.connections.beehiiv || stats.connections.linkedinContent || stats.connections.linkedinAds, label: "Connect a platform", href: "/dashboard/integrations" },
    { done: stats.hasBudget, label: "Set ad budget", href: "/dashboard/settings/billing" },
  ];

  const nextStep = steps.find((s) => !s.done);
  const completedCount = steps.filter((s) => s.done).length;

  // Self-hide when every visible step is done. The outer parent already
  // hides on `stats.onboarding.completed`, but that persisted flag can
  // be stale for businesses that completed the steps before the flag
  // existed (or whose flag never got set due to an onboarding-cron
  // hiccup). Without this guard, the banner would render as "3 of 3
  // steps complete" with no CTA — pure clutter for a user who has
  // already finished setup. Matches the existing "Engine active"
  // sub-banner pattern in the AI Engine card.
  if (completedCount === steps.length) {
    return null;
  }

  return (
    <Card className="overflow-hidden border-0 bg-linear-to-r from-primary/8 via-primary/4 to-transparent">
      <CardContent className="flex items-center justify-between py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              Set up your AI engine
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completedCount} of {steps.length} steps complete
            </p>
            {/* Step dots */}
            <div className="flex gap-1.5 mt-2">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    s.done ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        {nextStep && (
          <Button asChild size="sm" className="gap-1.5">
            <Link href={nextStep.href}>
              {nextStep.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── KPI Card ───────────────────────────────────────────────

/**
 * Which chart series this figure belongs to, in the platform's fixed pillar
 * order: 1 Commerce · 2 Content · 3 Growth · 4 Support · 5 Presence.
 *
 * Replaces the free-form `iconBg` class string these cards used to take
 * (`"bg-state-info/10 text-state-info-on-tint"` and friends). Raw
 * Tailwind hues meant a metric's colour was decided per call site, drifted
 * between surfaces, and had nothing to do with the colour the same metric
 * gets when it's plotted. Going through --chart-* makes the tile and the
 * chart agree by construction, and picks up the dark-mode step for free.
 */
type PillarSeries = 1 | 2 | 3 | 4 | 5;

/**
 * Icon on a tint of its own series colour. Verified ≥3:1 against that tint in
 * both themes — the non-text threshold, which is the right one here because
 * these are icons; the label and value beside them wear text tokens.
 */
const SERIES_TINT: Record<PillarSeries, string> = {
  1: "bg-chart-1/12 text-chart-1 dark:bg-chart-1/18",
  2: "bg-chart-2/12 text-chart-2 dark:bg-chart-2/18",
  3: "bg-chart-3/12 text-chart-3 dark:bg-chart-3/18",
  4: "bg-chart-4/12 text-chart-4 dark:bg-chart-4/18",
  5: "bg-chart-5/12 text-chart-5 dark:bg-chart-5/18",
};

function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  series,
  loading,
  href,
}: {
  label: string;
  value?: number | string;
  change?: string;
  icon: React.ElementType;
  series: PillarSeries;
  loading: boolean;
  href: string;
}) {
  return (
    <Link href={href} className="group">
      {/* u-lift/u-rail are the shared motion primitives from globals.css,
          applied through className so <Card> itself stays regenerable. Both
          are pointer-guarded and inert under prefers-reduced-motion. */}
      <Card className="u-lift u-rail relative h-full overflow-hidden">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 ease-brand group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-hover:scale-100 ${SERIES_TINT[series]}`}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
          </div>
          <div className="text-2xl font-bold tabular-nums tracking-tight">
            {loading ? (
              <span className="inline-block h-8 w-14 animate-pulse rounded-lg bg-muted" />
            ) : (
              (value ?? 0)
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
          {change && (
            <p className="text-[11px] text-muted-foreground/70 mt-1">{change}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
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
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{description}</p>
        </div>
        {loading ? (
          <span className="inline-block h-5 w-16 animate-pulse rounded-full bg-muted" />
        ) : connected ? (
          <Badge className="bg-success/90 text-[10px] gap-1 shrink-0 font-medium">
            <CheckCircle className="h-2.5 w-2.5" />
            {connectedLabel || "Live"}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
            Not connected
          </Badge>
        )}
      </div>
      {warning && (
        <div className="rounded-lg bg-warning/10 px-3 py-1.5 text-[11px] text-warning-on-tint flex items-center gap-1.5 ml-11">
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
        <span className="inline-block h-5 w-5 animate-pulse rounded-full bg-muted shrink-0" />
      ) : done ? (
        <CheckCircle className="h-5 w-5 text-success shrink-0" />
      ) : (
        <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

// ── Quick Action ───────────────────────────────────────────

function QuickAction({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="transition-all hover:shadow-md hover:border-primary/20">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-[11px] text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
