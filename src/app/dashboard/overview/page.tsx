"use client";

import { useQuery } from "@tanstack/react-query";
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
import { LinkedinIcon } from "@/components/ui/brand-icons";
import { DiscoveryProgressStrip } from "@/components/dashboard/discovery-progress-strip";
import { FootprintReviewCard } from "@/components/dashboard/footprint-review-card";
import { RecommendationsCard } from "@/components/dashboard/recommendations-card";

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

  const onboardingComplete = stats?.onboarding?.completed;
  const hasContent = (stats?.content.total ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {org?.name || "Dashboard"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {stats?.businessType || "Your AI marketing command center"}
          </p>
        </div>
        {stats?.websiteUrl && (
          <a
            href={stats.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Globe className="h-3 w-3" />
            {stats.websiteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          </a>
        )}
      </div>

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
          iconBg="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          loading={isLoading}
          href="/dashboard/content"
        />
        <KpiCard
          label="High Potential"
          value={stats?.content.highPotential}
          change="Ad score 7+"
          icon={Star}
          iconBg="bg-amber-500/10 text-amber-600 dark:text-amber-400"
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
          iconBg="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          loading={isLoading}
          href="/dashboard/ads"
        />
        <KpiCard
          label="Customers"
          value="--"
          change="Connect ads to track"
          icon={Users}
          iconBg="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          loading={isLoading}
          href="/dashboard/outcomes"
        />
      </div>

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
    </div>
  );
}

// ── Setup Banner ───────────────────────────────────────────

function SetupBanner({ stats }: { stats: DashboardStats }) {
  const steps = [
    { done: stats.hasTaxonomy, label: "Analyze business", href: "/onboarding/add-business" },
    { done: stats.connections.beehiiv || stats.connections.linkedinContent || stats.connections.linkedinAds, label: "Connect platform", href: "/dashboard/integrations" },
    { done: stats.hasBudget, label: "Set budget", href: "/onboarding/budget" },
  ];

  const nextStep = steps.find((s) => !s.done);
  const completedCount = steps.filter((s) => s.done).length;

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

function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  iconBg,
  loading,
  href,
}: {
  label: string;
  value?: number | string;
  change?: string;
  icon: React.ElementType;
  iconBg: string;
  loading: boolean;
  href: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="transition-all hover:shadow-md hover:border-primary/20 group-hover:scale-[1.01]">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
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
          <Badge className="bg-emerald-600/90 text-[10px] gap-1 shrink-0 font-medium">
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
        <div className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5 ml-11">
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
        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
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
