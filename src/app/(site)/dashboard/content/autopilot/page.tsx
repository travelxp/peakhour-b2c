"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useHomeSummary, homeSummaryKey } from "@/hooks/use-home-summary";
import { isProductionEnv } from "@/lib/env";
import { AutopilotStatus } from "./_components/autopilot-status";
import { KpiRow } from "./_components/kpi-row";
import { NeedsYouRail } from "./_components/needs-you-rail";
import { ChannelWidgets } from "./_components/channel-widgets";
import { AutopilotEmpty } from "./_components/autopilot-empty";
import { CommerceLane } from "./_components/commerce-lane";

/**
 * Content > Autopilot — the entitlement-composed content command center.
 * Answers "what did the engine do, and what does it need from me?" via the
 * autopilot status chip, three honest KPIs, the Needs-you approval rail
 * (the hero), and per-channel widgets.
 *
 * Ships DARK in production: the page route is gated on
 * NEXT_PUBLIC_VERCEL_ENV (mirrors the in_development surfacing state of the
 * content.autopilot_home feature) so it's visible in non-prod for
 * side-by-side comparison with the existing Library page, and 404-style
 * redirected in prod until we flip it on. The nav item is gated the same
 * way in the dashboard layout.
 */

function LoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}

export default function AutopilotHomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isProd = isProductionEnv();

  // Hard guard: a direct prod URL must not render the dark page.
  useEffect(() => {
    if (isProd) router.replace("/dashboard/content");
  }, [isProd, router]);

  const { data, isLoading, isError, refetch } = useHomeSummary({ enabled: !isProd });

  if (isProd) return null;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <CronToolbar
        crons={["publish-scheduled", "publish-retry", "recurring-spawn"]}
        onTriggered={() =>
          queryClient.invalidateQueries({ queryKey: homeSummaryKey })
        }
      />

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Autopilot</h1>
        <p className="text-sm text-muted-foreground">
          What your content engine did, and what it needs from you.
        </p>
      </div>

      {isLoading && <LoadingState />}

      {isError && !isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm font-medium">Couldn&apos;t load your autopilot</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            We hit a snag fetching your summary. Your data is safe — try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && !isLoading && (
        <div className="flex flex-col gap-5">
          <AutopilotStatus
            state={data.autopilot.state}
            reason={data.autopilot.reason}
            lastRunAt={data.autopilot.lastRunAt}
          />

          {/* Commerce money-loop — the both-state hero. Prominent, above
              the KPIs, only when a store is connected. */}
          {data.entitlements.commerce && (
            <CommerceLane variant="moneyloop" data={data.commerce} />
          )}

          {data.channels.length === 0 ? (
            <AutopilotEmpty />
          ) : (
            <>
              <KpiRow kpis={data.kpis} />
              <NeedsYouRail items={data.needsYou} totalCount={data.kpis.needsYou} />
              <ChannelWidgets channels={data.channels} />
            </>
          )}

          {/* Cross-sell — quiet, at the bottom, only for marketing-only
              users who haven't connected a store yet. */}
          {!data.entitlements.commerce && data.channels.length > 0 && (
            <CommerceLane variant="teaser" />
          )}
        </div>
      )}
    </div>
  );
}
