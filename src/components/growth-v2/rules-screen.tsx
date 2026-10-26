"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useGrowthV2Rules, type MandateView, type RulesResponse } from "@/lib/api/growth-v2";
import { GROWTH_HOME } from "@/lib/growth-v2-nav";
import { PREVIEW_NOW } from "@/lib/growth-v2-fixtures";
import { OUTCOME_UNIT, PLATFORM_COLOR, PLATFORM_LABEL, formatDate, formatMoney } from "@/lib/growth-v2-figure";
import { AutonomyLadder } from "./autonomy-ladder";
import { PageHead } from "./page-head";
import { QueryBoundary } from "./query-boundary";
import { ToneBadge } from "./tone";

/** Rules: "What may the engine do?" Your mandate, how much it may do alone, and the lines it never crosses (plan 1, H5). */
export function RulesScreen() {
  const query = useGrowthV2Rules();
  return (
    <div className="grid gap-4">
      <PageHead title="What may the engine do?" description="Your mandate, how much the engine may do on its own, and the lines it never crosses." />
      <QueryBoundary query={query}>{(r) => <RulesBody rules={r.data} preview={r.preview} />}</QueryBoundary>
    </div>
  );
}

/** What the mandate counts, in the merchant's words: the focus label, else the kind's own word. */
export function outcomeLabel(m: MandateView["outcome"]): string {
  return m.focus?.label ?? OUTCOME_UNIT[m.kind].many;
}

const SOURCE_NOTE: Record<MandateView["outcome"]["source"], string> = {
  orders: "counted from paid orders",
  win_definition: "counted from the win you chose",
  gbp_actions: "counted from Business Profile actions",
  ads_conversions: "counted from the ad platform's conversions",
};

export function RulesBody({ rules, preview }: { rules: RulesResponse; preview: boolean }) {
  const m = rules.mandate;
  const [liveNow] = useState(() => Date.now());
  const now = preview ? PREVIEW_NOW : liveNow;

  if (!m) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="font-medium">The engine is off for this business.</p>
          <p className="mx-auto max-w-prose text-sm text-muted-foreground">
            There is no mandate yet. Answer three questions and confirm on WhatsApp, and the engine starts by watching and proposing.
          </p>
          <Button asChild>
            <Link href={`${GROWTH_HOME}/start`}>Start the first run</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const g = rules.guardrails;
  const target = m.target.kind === "roas" ? `${m.target.value.toFixed(1)}x return` : formatMoney(m.target.value, m.currency);
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Autonomy</CardTitle>
          <CardDescription>The engine earns each level by its results, and drops back a level on its own after a bad result.</CardDescription>
        </CardHeader>
        <CardContent>
          <AutonomyLadder
            level={rules.autonomy.level}
            clearedDecisions={m.autonomy.clearedDecisions}
            since={m.autonomy.since}
            offeredPromotion={rules.autonomy.offeredPromotion}
            lastDemotion={m.autonomy.lastDemotion}
            now={now}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your mandate</CardTitle>
            <CardDescription>
              Confirmed with a one-time code on {formatDate(m.confirmation.at)}. Renews on {formatDate(m.confirmation.renewsAt)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row term="Outcome" detail={`${outcomeLabel(m.outcome)}, ${SOURCE_NOTE[m.outcome.source]}`}>
                <ToneBadge tone="good" dot>
                  {m.outcome.optimizeFor === "value" ? "By value" : "By count"}
                </ToneBadge>
              </Row>
              {m.goal ? <Row term="Monthly goal" detail="What you are aiming for">{m.goal.perMonth}</Row> : <Row term="Monthly goal" detail="No goal set">None</Row>}
              <Row term="Monthly ceiling" detail="The engine can never spend more than this">
                {formatMoney(m.monthlyCeiling, m.currency)}
              </Row>
              <Row
                term={m.target.kind === "roas" ? "Target return" : `Target cost per ${OUTCOME_UNIT[m.outcome.kind].one}`}
                detail={m.targetSource === "playbook" ? `From the ${m.playbook.id} playbook, version ${m.playbook.version}` : "Set by you"}
              >
                {target}
              </Row>
              <Row term="Who can approve" detail={m.approvers.length === 0 ? "Only the owner" : "People on your approvals list"}>
                {m.approvers.length === 0 ? "Owner" : `${m.approvers.length} ${m.approvers.length === 1 ? "person" : "people"}`}
              </Row>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guardrails</CardTitle>
            <CardDescription>The engine checks these before it proposes anything, not after.</CardDescription>
            {g.adsHalted ? (
              <CardAction>
                <ToneBadge tone="bad" dot>
                  Ads halted
                </ToneBadge>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row term="Only use creatives I approved" detail="New creatives wait in Decisions until you approve them">
                <Switch checked={g.approvedAssetsOnly} disabled aria-label="Only use creatives I approved" />
              </Row>
              <Row
                term="Quiet hours"
                detail={g.quietHours ? `No launches ${g.quietHours.start} to ${g.quietHours.end}${g.timeZone ? ` (${g.timeZone})` : ""}` : "None set"}
              >
                <Switch checked={g.quietHours !== null} disabled aria-label="Quiet hours" />
              </Row>
              <Row term="Blocked words" detail={g.blockedTerms.length ? g.blockedTerms.map((t) => `“${t}”`).join(", ") : "None"}>
                {g.blockedTerms.length}
              </Row>
              <Row term="Channels allowed" detail={g.allowedChannels === null ? "Every connected channel" : g.allowedChannels.map(platformName).join(", ")}>
                {g.allowedChannels === null ? "All" : g.allowedChannels.length}
              </Row>
              <Row term="Never, at any level" detail="Go over the ceiling, add a channel, or change what counts as an outcome">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock aria-hidden className="size-3.5" /> Fixed
                </span>
              </Row>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connections</CardTitle>
          <CardDescription>The engine only manages accounts that bill in your mandate&apos;s currency ({m.currency}).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-2 py-2">Channel</th>
                <th className="px-2 py-2">Connection</th>
                <th className="px-2 py-2">Billing currency</th>
              </tr>
            </thead>
            <tbody>
              {rules.connections.map((c) => (
                <tr key={c.platform} className="border-b last:border-0">
                  <td className="px-2 py-2.5">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <i aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: PLATFORM_COLOR[c.platform] }} />
                      {PLATFORM_LABEL[c.platform]}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    {c.connected ? (
                      <ToneBadge tone="good" dot>
                        Connected
                      </ToneBadge>
                    ) : (
                      <ToneBadge>Not connected</ToneBadge>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    {c.currency ? (
                      <span className="inline-flex items-center gap-2">
                        {c.currency}
                        {c.currencyMismatch ? (
                          <ToneBadge tone="warn" dot>
                            Not managed: different currency
                          </ToneBadge>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">&ndash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Manage connections in <Link href="/dashboard/integrations" className="underline underline-offset-2">Integrations</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const platformName = (p: string) => PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL] ?? p;

function Row({ term, detail, children }: { term: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
      <div className="min-w-0">
        <dt className="text-sm font-medium">{term}</dt>
        <dd className="text-xs text-muted-foreground">{detail}</dd>
      </div>
      <div className="text-sm font-semibold tabular-nums">{children}</div>
    </div>
  );
}
