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
  CardDescription,
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

export default function OverviewPage() {
  const { org } = useAuth();

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["dashboard-stats", org?._id],
    queryFn: () => api.get<DashboardStats>("/v1/dashboard/stats"),
    enabled: !!org,
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with {org?.name || "your business"}
        </p>
      </div>

      {isError && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load dashboard data. Please try refreshing the page.
        </div>
      )}

      {/* Quick setup banner if onboarding not complete */}
      {stats && !stats.onboarding.completed && (() => {
        // Determine next incomplete onboarding step
        const nextStep = !stats.hasTaxonomy
          ? "/onboarding/add-business"
          : !(stats.connections.linkedinContent || stats.connections.linkedinAds) && !stats.connections.beehiiv
            ? "/onboarding/connect-platforms"
            : !stats.hasBudget
              ? "/onboarding/budget"
              : "/onboarding/launch";
        const stepLabel = !stats.hasTaxonomy
          ? "Add your business"
          : !(stats.connections.linkedinContent || stats.connections.linkedinAds) && !stats.connections.beehiiv
            ? "Connect a platform"
            : !stats.hasBudget
              ? "Set your budget"
              : "Launch your AI engine";
        return (
          <Card className="border-primary/20 bg-linear-to-r from-primary/5 to-primary/10">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {stepLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Complete onboarding to activate your AI marketing engine
                  </p>
                </div>
              </div>
              <Button asChild size="sm">
                <Link href={nextStep}>
                  Continue setup
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })()}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={FileText}
          label="Content synced"
          value={stats?.content.total}
          subtitle={
            stats?.content.tagged
              ? `${stats.content.tagged} tagged by AI`
              : "Sync content to start tagging"
          }
          loading={isLoading}
          accentColor="text-blue-600 bg-blue-100 dark:bg-blue-950"
        />
        <KpiCard
          icon={Star}
          label="High-potential articles"
          value={stats?.content.highPotential}
          subtitle="Scoring 7+ for ad potential"
          loading={isLoading}
          accentColor="text-amber-600 bg-amber-100 dark:bg-amber-950"
        />
        <KpiCard
          icon={Megaphone}
          label="Active campaigns"
          value={stats?.campaigns.active}
          subtitle={
            stats?.campaigns.total
              ? `${stats.campaigns.total} total campaigns`
              : "Launch your first campaign"
          }
          loading={isLoading}
          accentColor="text-violet-600 bg-violet-100 dark:bg-violet-950"
        />
        <KpiCard
          icon={Users}
          label="New customers"
          value="--"
          subtitle="Connect ads to start tracking"
          loading={isLoading}
          accentColor="text-emerald-600 bg-emerald-100 dark:bg-emerald-950"
        />
      </div>

      {/* Connection status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Plug className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Connected Platforms</CardTitle>
              <CardDescription>
                Your ad accounts and content sources
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ConnectionRow
              name="LinkedIn"
              connected={stats?.connections.linkedinContent || stats?.connections.linkedinAds}
              loading={isLoading}
            />
            {/* Warn if LinkedIn Ads connected but no ad account */}
            {!isLoading && stats?.connections.linkedinAds && !stats?.connections.linkedinAdsHasAdAccount && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">No Ad Account</span>
                  <span className="mx-1">—</span>
                  <a
                    href="https://www.linkedin.com/campaignmanager/new-advertiser"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:no-underline"
                  >
                    Create one on LinkedIn
                  </a>
                </div>
              </div>
            )}
            <ConnectionRow
              name="Content Source"
              connected={stats?.connections.beehiiv}
              loading={isLoading}
              label={stats?.connections.beehiiv ? "Synced" : undefined}
            />
            {!isLoading &&
              !(stats?.connections.linkedinContent || stats?.connections.linkedinAds) &&
              !stats?.connections.beehiiv && (
                <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                  <Link href="/dashboard/integrations">
                    Connect accounts
                  </Link>
                </Button>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Engine Status</CardTitle>
              <CardDescription>
                Your AI marketing assistant&apos;s current state
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow
              label="Business analyzed"
              done={stats?.hasTaxonomy}
              loading={isLoading}
            />
            <StatusRow
              label="Budget configured"
              done={stats?.hasBudget}
              loading={isLoading}
            />
            <StatusRow
              label="Onboarding complete"
              done={stats?.onboarding.completed}
              loading={isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  loading,
  accentColor,
}: {
  icon: LucideIcon;
  label: string;
  value?: number | string;
  subtitle: string;
  loading: boolean;
  accentColor: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentColor}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tabular-nums">
          {loading ? (
            <span
              role="status"
              aria-label="Loading"
              className="inline-block h-9 w-12 animate-pulse rounded bg-muted"
            />
          ) : (
            (value ?? 0)
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ConnectionRow({
  name,
  connected,
  loading,
  label,
}: {
  name: string;
  connected?: boolean;
  loading: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
      <span className="font-medium">{name}</span>
      {loading ? (
        <span
          role="status"
          aria-label="Loading"
          className="inline-block h-5 w-16 animate-pulse rounded bg-muted"
        />
      ) : connected ? (
        <Badge className="gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" />
          {label || "Connected"}
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          Not connected
        </Badge>
      )}
    </div>
  );
}

function StatusRow({
  label,
  done,
  loading,
}: {
  label: string;
  done?: boolean;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
      <span className="font-medium">{label}</span>
      {loading ? (
        <span
          role="status"
          aria-label="Loading"
          className="inline-block h-5 w-12 animate-pulse rounded bg-muted"
        />
      ) : done ? (
        <span className="flex items-center gap-1.5 text-green-600 font-medium">
          <CheckCircle className="h-4 w-4" />
          Done
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Pending
        </span>
      )}
    </div>
  );
}
