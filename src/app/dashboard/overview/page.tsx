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
    linkedin: boolean;
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

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get<DashboardStats>("/v1/dashboard/stats"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Welcome back</h2>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with {org?.name || "your business"}
        </p>
      </div>

      {/* Quick setup banner if onboarding not complete */}
      {stats && !stats.onboarding.completed && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium">
                Finish setting up your business
              </p>
              <p className="text-xs text-muted-foreground">
                Complete onboarding to activate your AI marketing engine
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/onboarding/add-business">Continue setup</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Content synced"
          value={stats?.content.total}
          subtitle={
            stats?.content.tagged
              ? `${stats.content.tagged} tagged by AI`
              : "Sync content to start tagging"
          }
          loading={isLoading}
        />
        <KpiCard
          label="High-potential articles"
          value={stats?.content.highPotential}
          subtitle="Scoring 7+ for ad potential"
          loading={isLoading}
        />
        <KpiCard
          label="Active campaigns"
          value={stats?.campaigns.active}
          subtitle={
            stats?.campaigns.total
              ? `${stats.campaigns.total} total campaigns`
              : "Launch your first campaign"
          }
          loading={isLoading}
        />
        <KpiCard
          label="New customers"
          value="--"
          subtitle="Connect ads to start tracking"
          loading={isLoading}
        />
      </div>

      {/* Connection status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connected Platforms</CardTitle>
            <CardDescription>
              Your ad accounts and content sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ConnectionRow
              name="LinkedIn Ads"
              connected={stats?.connections.linkedin}
              loading={isLoading}
            />
            <ConnectionRow
              name="Content Source"
              connected={stats?.connections.beehiiv}
              loading={isLoading}
              label={stats?.connections.beehiiv ? "Synced" : undefined}
            />
            {!isLoading &&
              !stats?.connections.linkedin &&
              !stats?.connections.beehiiv && (
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href="/dashboard/settings">
                    Connect accounts in Settings
                  </Link>
                </Button>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Engine Status</CardTitle>
            <CardDescription>
              Your AI marketing assistant&apos;s current state
            </CardDescription>
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
  label,
  value,
  subtitle,
  loading,
}: {
  label: string;
  value?: number | string;
  subtitle: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">
          {loading ? (
            <span className="inline-block h-9 w-12 animate-pulse rounded bg-muted" />
          ) : (
            (value ?? 0)
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
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
    <div className="flex items-center justify-between text-sm">
      <span>{name}</span>
      {loading ? (
        <span className="inline-block h-5 w-16 animate-pulse rounded bg-muted" />
      ) : connected ? (
        <Badge className="bg-green-600">{label || "Connected"}</Badge>
      ) : (
        <Badge variant="outline">Not connected</Badge>
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
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      {loading ? (
        <span className="inline-block h-5 w-12 animate-pulse rounded bg-muted" />
      ) : done ? (
        <span className="text-green-600 font-medium">{"\u2713"} Done</span>
      ) : (
        <span className="text-muted-foreground">Pending</span>
      )}
    </div>
  );
}
