"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGrowthV2Channels, type ChannelsRefusal, type ChannelsResponse, type ChannelsScreenData, type HomeWindowKey } from "@/lib/api/growth-v2";
import type { PacingSeries } from "@/lib/growth-v2-series";
import { PLATFORM_COLOR, PLATFORM_LABEL, WINDOWS, currencyOf, figureText, figureValue, formatMoney, formatPercent, unitFor } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";
import { ChannelBubbles } from "./channel-bubbles";
import { FigureValue, MoneyValue } from "./figure-value";
import { Choice, NotSetUp } from "./home-screen";
import { PacingBadge, PacingChart } from "./pacing-chart";
import { PageHead } from "./page-head";
import { QueryBoundary } from "./query-boundary";
import { ShareByWeek } from "./share-by-week";
import { ToneBadge, type Tone } from "./tone";
import type { UseQueryResult } from "@tanstack/react-query";

/** Channels & money: "Where is the money going?" Spend and results by channel; what the ads caused is measured on Home (plan 1, H3). */
export function ChannelsScreen() {
  const [window, setWindow] = useState<HomeWindowKey>("7d");
  const query = useGrowthV2Channels(window);
  if (query.data && "refusal" in query.data) return <NotSetUp code={query.data.refusal} />;
  // The prototype's sample is one fixed window: a control that cannot change it would only contradict the page.
  const preview = query.data?.preview === true;
  return (
    <div className="grid gap-4">
      <PageHead
        title="Where is the money going?"
        description="Spend and results for each channel. Results are the orders credited to the channel; what the ads caused is measured on Home."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/ads">Manage campaigns</Link>
          </Button>
        }
      />
      {preview ? null : <Choice label="Window" value={window} options={WINDOWS} onChange={setWindow} text={(o) => o.choice} />}
      <div aria-busy={query.isPlaceholderData} className={cn("transition-opacity", query.isPlaceholderData && "opacity-60")}>
        {/* A refusal returned above, so what the boundary hands on is a page. */}
        <QueryBoundary query={query as UseQueryResult<ChannelsScreenData | ChannelsRefusal> as UseQueryResult<ChannelsScreenData>}>
          {(r) => <ChannelsBody channels={r.data} pacingSeries={r.pacingSeries} unitPlural={unitFor(r.data.outcome.kind).many} unitOne={unitFor(r.data.outcome.kind).one} />}
        </QueryBoundary>
      </div>
    </div>
  );
}

const STATE: Record<ChannelsResponse["health"][number]["state"], { tone: Tone; label: string }> = {
  healthy: { tone: "good", label: "Healthy" },
  watch: { tone: "warn", label: "Watch" },
  problem: { tone: "bad", label: "Problem" },
  not_connected: { tone: "neutral", label: "Not connected" },
};

const STATUS_TONE = (status: string): Tone => {
  const s = status.toLowerCase();
  if (s.includes("pause") || s.includes("problem") || s.includes("reject")) return "bad";
  if (s.includes("reduc") || s.includes("learning") || s.includes("limited")) return "warn";
  if (s.includes("serv") || s.includes("active") || s.includes("live")) return "good";
  return "neutral";
};

const STATUS_LABEL = (status: string): string => status.charAt(0).toUpperCase() + status.slice(1);

/** Cost per outcome in money, a return as a multiple. */
const efficiencyFormat = (metric: ChannelsResponse["efficiency"]["metric"], currency: string) => (n: number) =>
  metric === "roas" ? `${n.toFixed(1)}x` : formatMoney(n, currency);

export function ChannelsBody({ channels, pacingSeries, unitPlural, unitOne }: { channels: ChannelsResponse; pacingSeries?: PacingSeries; unitPlural: string; unitOne: string }) {
  const currency = currencyOf(channels.pacing.monthlyCeiling, channels.pacing.spentThisMonth);
  const metric = channels.efficiency.metric;
  const eff = efficiencyFormat(metric, currency);
  const effName = metric === "roas" ? "Return on ad spend" : `Cost / ${unitOne}`;
  // Credit belongs to a channel, not a campaign: when no campaign has its own result, the columns would only repeat an absence.
  const campaignResults = channels.campaigns.some((c) => figureValue(c.outcomes) !== undefined);
  const target = channels.allocatorTarget;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{channels.basis}</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {channels.health.map((h) => {
          const s = STATE[h.state];
          return (
            <Card key={h.platform} data-state={h.state}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <i aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: PLATFORM_COLOR[h.platform] }} />
                  {PLATFORM_LABEL[h.platform]}
                </CardTitle>
                <div>
                  <ToneBadge tone={s.tone} dot>
                    {s.label}
                  </ToneBadge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {h.reason ? <p className="text-sm text-muted-foreground">{h.reason}</p> : null}
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Spend</dt>
                    <dd className="font-medium"><MoneyValue money={h.spend} /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Credited {unitPlural}</dt>
                    <dd className="font-medium"><FigureValue figure={h.outcomes} /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{effName}</dt>
                    <dd className="font-medium"><FigureValue figure={h.efficiency} format={eff} /></dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend vs credited {unitPlural}</CardTitle>
            <CardDescription>Up and to the left is better: more for less. Target {figureText(channels.efficiency.target, eff)}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChannelBubbles bubbles={channels.bubbles} unitPlural={unitPlural} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Spend share by week</CardTitle>
            <CardDescription>Each channel&apos;s part of the spend we recorded that week. The allocator moves money as evidence comes in, a step at a time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ShareByWeek weeks={channels.shareByWeek} />
            {target ? (
              <p className="text-xs text-muted-foreground" data-allocator-target="">
                Where the allocator&apos;s latest {target.status === "applied" ? "applied" : "proposed"} move leaves the daily budget:{" "}
                {target.shares.map((s, i) => (
                  <span key={s.platform}>
                    {i > 0 ? ", " : ""}
                    {PLATFORM_LABEL[s.platform]} {figureValue(s.share) !== undefined ? formatPercent(figureValue(s.share)!) : figureText(s.share)}
                  </span>
                ))}
                .
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pacing this month</CardTitle>
            <CardDescription>
              Cumulative spend against the {formatMoneyOrDash(channels.pacing.monthlyCeiling, currency)} ceiling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PacingBadge
              spent={channels.pacing.spentThisMonth}
              ceiling={channels.pacing.monthlyCeiling}
              daysLeft={channels.pacing.daysLeft}
              daysInMonth={pacingSeries?.daysInMonth ?? 0}
            />
            <PacingChart spent={channels.pacing.spentThisMonth} ceiling={channels.pacing.monthlyCeiling} daysLeft={channels.pacing.daysLeft} series={pacingSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>
              {channels.campaignsBasis} <Link href="/dashboard/ads" className="underline underline-offset-2">Open campaign management</Link> to edit one.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="px-2 py-2">Campaign</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Daily budget</th>
                  <th className="px-2 py-2 text-right">Spend</th>
                  {campaignResults ? <th className="px-2 py-2 text-right">Credited {unitPlural}</th> : null}
                  {campaignResults ? <th className="px-2 py-2 text-right">{effName}</th> : null}
                </tr>
              </thead>
              <tbody>
                {channels.campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={campaignResults ? 6 : 4} className="px-2 py-6 text-center text-muted-foreground">
                      No campaigns yet.
                    </td>
                  </tr>
                ) : (
                  channels.campaigns.map((c) => {
                    return (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-2 py-2.5">
                          <span className="inline-flex items-center gap-2 font-medium">
                            <i aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: PLATFORM_COLOR[c.platform] }} />
                            <span className="sr-only">{PLATFORM_LABEL[c.platform]}: </span>
                            {c.name}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <ToneBadge tone={STATUS_TONE(c.status)} dot>
                            {STATUS_LABEL(c.status)}
                          </ToneBadge>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <MoneyValue money={c.dailyBudget} />
                          {c.engineChange ? (
                            <span className="block text-xs text-muted-foreground" data-engine-change="">
                              Engine changed it from {formatMoney(c.engineChange.from, c.engineChange.currency)} to {formatMoney(c.engineChange.to, c.engineChange.currency)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <MoneyValue money={c.spend} />
                        </td>
                        {campaignResults ? (
                          <td className="px-2 py-2.5 text-right">
                            <FigureValue figure={c.outcomes} />
                          </td>
                        ) : null}
                        {campaignResults ? (
                          <td className="px-2 py-2.5 text-right">
                            <FigureValue figure={c.efficiency} format={eff} />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const formatMoneyOrDash = (m: ChannelsResponse["pacing"]["monthlyCeiling"], currency: string) =>
  "value" in m ? formatMoney(m.value, currency) : figureText(m);
