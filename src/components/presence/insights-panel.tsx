"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { presenceApi } from "@/lib/api/presence";
import { useLocale } from "@/hooks/use-locale";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { SearchTermsSection } from "@/components/presence/search-terms-section";
import {
  DEFAULT_INSIGHT_DAYS,
  INSIGHT_WINDOWS,
  NOT_AVAILABLE_YET,
  chartHasData,
  chartPoints,
  declaredMetrics,
  coverageNote,
  windowSeries,
  fetchView,
  metricTotal,
  presenceInsightsQueryKey,
  setupMessage,
  staleSyncNote,
  type InsightKey,
} from "@/lib/presence-panels";

/**
 * Customer actions from the Google listing, over a chosen window.
 *
 * MARKUP ONLY; every sentence and every "is there a number" decision is in
 * `lib/presence-panels.ts`.
 *
 * One metric is charted at a time (the tile you pick), so the chart has one
 * series, no legend, and one colour: Presence's pillar token `--chart-5`.
 * A day Google sent nothing for is a gap in the line, never a zero.
 *
 * A figure Google did not report is "Not available yet", never 0. Search terms
 * (monthly, and only where the network declares them) sit under the chart.
 */
export function InsightsPanel({ location }: { location?: string }) {
  const [days, setDays] = useState(DEFAULT_INSIGHT_DAYS);
  const [metric, setMetric] = useState<InsightKey>("views");
  const { formatDate, formatNumber } = useLocale();

  const listingQ = useListingQuery(location);
  const setup = listingQ.data?.setup;
  // Figures are only asked for once the listing says there is one to ask about.
  const canAsk = setup === "ready" || setup === "sync_failing";
  const insightsQ = useQuery({
    queryKey: presenceInsightsQueryKey(days, location),
    queryFn: () => presenceApi.insights(days, location),
    enabled: canAsk,
    // Keep the last window on screen while the next loads, rather than blanking.
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="font-medium">How customers found you</h2>
        <p className="text-xs text-muted-foreground">Google · last {insightsQ.data?.days ?? days} days</p>
      </div>
      <div className="flex gap-1" role="group" aria-label="Time window">
        {INSIGHT_WINDOWS.map((w) => (
          <Button
            key={w.days}
            size="sm"
            variant={w.days === days ? "default" : "outline"}
            className="h-8"
            aria-pressed={w.days === days}
            onClick={() => setDays(w.days)}
          >
            {w.label}
          </Button>
        ))}
      </div>
    </div>
  );

  const shell = (body: React.ReactNode) => (
    <Card className="gap-4 p-5">
      {header}
      {body}
    </Card>
  );

  const listingView = fetchView({
    hasData: !!listingQ.data,
    isPending: listingQ.isPending,
    isError: listingQ.isError,
    fetchStatus: listingQ.fetchStatus,
  });
  if (listingView === "loading" || listingView === "paused") {
    return shell(
      <>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-56 w-full" />
        {listingView === "paused" && (
          <p className="text-center text-xs text-muted-foreground">
            Waiting for a connection. Your figures will load when you are back online.
          </p>
        )}
      </>,
    );
  }
  if (!listingQ.data) {
    return shell(
      <Failed what="your figures" onRetry={() => listingQ.refetch()} />,
    );
  }

  const message = setupMessage(listingQ.data.setup, !!listingQ.data.listing, "performance");
  if (message) {
    return shell(
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm font-medium">{message.headline}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{message.body}</p>
      </div>,
    );
  }

  const view = fetchView({
    hasData: !!insightsQ.data,
    isPending: insightsQ.isPending,
    isError: insightsQ.isError,
    fetchStatus: insightsQ.fetchStatus,
  });
  if (view === "loading" || view === "paused") {
    return shell(
      <>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-56 w-full" />
        {view === "paused" && (
          <p className="text-center text-xs text-muted-foreground">
            Waiting for a connection. Your figures will load when you are back online.
          </p>
        )}
      </>,
    );
  }
  if (!insightsQ.data) {
    return shell(<Failed what="your figures" onRetry={() => insightsQ.refetch()} />);
  }

  const data = insightsQ.data;
  // The window the data is FOR, which lags the picker while a switch loads.
  const shownDays = data.days;
  const now = new Date();
  const series = windowSeries(data.series, shownDays, now);
  const google = listingQ.data.google;
  const metrics = declaredMetrics(google?.capabilities);
  const selected = metrics.find((m) => m.key === metric) ?? metrics[0];
  if (!selected) {
    return shell(
      <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
        This listing doesn&apos;t report any figures we can show yet.
      </p>,
    );
  }
  const points = chartPoints(series, selected.key, shownDays, now);
  const hasData = chartHasData(points);
  const coverage = coverageNote(series, shownDays);
  const syncNote = staleSyncNote(listingQ.data.setup);
  const chartConfig = {
    value: { label: selected.label, color: "var(--chart-5)" },
  } satisfies ChartConfig;
  const shortDate = (iso: string) =>
    formatDate(`${iso}T00:00:00Z`, { timeZone: "UTC", day: "numeric", month: "short" });

  return shell(
    <>
      {view === "data_stale" && (
        <p className="text-xs text-warning-on-tint">
          Couldn&apos;t refresh just now, so these figures may be out of date.
        </p>
      )}
      {listingView === "data_stale" && (
        <p className="text-xs text-warning-on-tint">
          Couldn&apos;t check your Google connection just now, so this may be out of date.
        </p>
      )}
      {syncNote && <p className="text-xs text-warning-on-tint">{syncNote}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map((m) => {
          const total = metricTotal(series, m.key);
          const active = m.key === selected.key;
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={active}
              onClick={() => setMetric(m.key)}
              className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? "border-foreground/40 bg-muted/40" : ""
              }`}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {m.label}
              </p>
              {total === null ? (
                <p className="mt-1 text-sm text-muted-foreground">{NOT_AVAILABLE_YET}</p>
              ) : (
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(total)}</p>
              )}
            </button>
          );
        })}
      </div>

      {!hasData ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm font-medium">
            {series.length === 0 ? "No figures from Google yet" : `${selected.label}: ${NOT_AVAILABLE_YET.toLowerCase()}`}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            {series.length === 0
              ? `We haven't received any daily figures for this listing in the last ${shownDays} days. `
              : `Google didn't send this figure for any of the last ${shownDays} days. `}
            That is different from no customers: nothing has been counted, one way or the other.
          </p>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs font-medium">{selected.label}, day by day</p>
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="presenceInsightsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.4} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                fontSize={12}
                minTickGap={28}
                tickFormatter={shortDate}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                fontSize={12}
                width={32}
                allowDecimals={false}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideIndicator
                    labelFormatter={(label) => shortDate(String(label))}
                    formatter={(value) => (
                      <span className="font-medium tabular-nums">
                        {selected.label}: {value === null || value === undefined ? "No data" : formatNumber(Number(value))}
                      </span>
                    )}
                  />
                }
              />
              <Area
                dataKey="value"
                type="monotone"
                stroke="var(--chart-5)"
                strokeWidth={2}
                fill="url(#presenceInsightsFill)"
                connectNulls={false}
                dot={{ r: 2, fill: "var(--chart-5)", strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      )}

      {coverage && <p className="text-[11px] text-muted-foreground">{coverage}</p>}

      <SearchTermsSection google={google} />
    </>,
  );
}

function Failed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 text-center">
      <p className="text-sm font-medium">Couldn&apos;t load {what}</p>
      <p className="max-w-md text-xs text-muted-foreground">
        This is a problem loading the page, not a sign that nobody found you. Try again in a
        moment.
      </p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
