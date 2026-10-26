"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGrowthV2Channels, useGrowthV2Rules, type ChannelsResponse } from "@/lib/api/growth-v2";
import type { PacingSeries } from "@/lib/growth-v2-series";
import { OUTCOME_UNIT, PLATFORM_COLOR, PLATFORM_LABEL, currencyOf, figureText, formatMoney } from "@/lib/growth-v2-figure";
import { ChannelBubbles } from "./channel-bubbles";
import { FigureValue, MoneyValue } from "./figure-value";
import { PacingBadge, PacingChart } from "./pacing-chart";
import { PageHead } from "./page-head";
import { QueryBoundary } from "./query-boundary";
import { ShareByWeek } from "./share-by-week";
import { ToneBadge, type Tone } from "./tone";

/** Channels & money: "Where is the money going?" Each channel judged on extra outcomes per rupee (plan 1, H3). */
export function ChannelsScreen() {
  const query = useGrowthV2Channels();
  const rules = useGrowthV2Rules();
  const kind = rules.data?.data.mandate?.outcome.kind ?? "bookings";
  return (
    <div className="grid gap-4">
      <PageHead
        title="Where is the money going?"
        description={`Each channel is judged on extra ${OUTCOME_UNIT[kind].many} per rupee, not on the credit the platform gives itself.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/ads">Manage campaigns</Link>
          </Button>
        }
      />
      <QueryBoundary query={query}>{(r) => <ChannelsBody channels={r.data} pacingSeries={r.pacingSeries} unitPlural={OUTCOME_UNIT[kind].many} unitOne={OUTCOME_UNIT[kind].one} />}</QueryBoundary>
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

export function ChannelsBody({ channels, pacingSeries, unitPlural, unitOne }: { channels: ChannelsResponse; pacingSeries?: PacingSeries; unitPlural: string; unitOne: string }) {
  const currency = currencyOf(channels.pacing.monthlyCeiling, channels.pacing.spentThisMonth);
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2">
          {channels.health.map((h) => {
            const s = STATE[h.state];
            return (
              <ToneBadge key={h.platform} tone={s.tone} dot>
                {PLATFORM_LABEL[h.platform]} &middot; {s.label}
                {h.reason ? <span className="font-normal opacity-80">: {h.reason}</span> : null}
              </ToneBadge>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend vs extra {unitPlural}</CardTitle>
            <CardDescription>Up and to the left is better: more for less.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChannelBubbles bubbles={channels.bubbles} unitPlural={unitPlural} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Budget share by week</CardTitle>
            <CardDescription>The allocator moves money as evidence comes in, a step at a time.</CardDescription>
          </CardHeader>
          <CardContent>
            <ShareByWeek weeks={channels.shareByWeek} />
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
              Created by the engine, started by you. <Link href="/dashboard/ads" className="underline underline-offset-2">Open campaign management</Link> to edit one.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="px-2 py-2">Campaign</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Spend</th>
                  <th className="px-2 py-2 text-right">Extra {unitPlural}</th>
                  <th className="px-2 py-2 text-right">Cost / {unitOne}</th>
                </tr>
              </thead>
              <tbody>
                {channels.campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                      No campaigns yet.
                    </td>
                  </tr>
                ) : (
                  channels.campaigns.map((c) => (
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
                          {c.status}
                        </ToneBadge>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <MoneyValue money={c.spend} />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <FigureValue figure={c.outcomes} />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <FigureValue figure={c.efficiency} format={(n) => formatMoney(n, currency)} />
                      </td>
                    </tr>
                  ))
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
