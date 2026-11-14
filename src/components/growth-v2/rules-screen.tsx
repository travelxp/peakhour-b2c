"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useGrowthV2Rules, usePatchRules, type MandateView, type RulesResponse } from "@/lib/api/growth-v2";
import { GOALS_ROUTE, GROWTH_HOME } from "@/lib/growth-v2-nav";
import { PREVIEW_NOW } from "@/lib/growth-v2-fixtures";
import { PLATFORM_COLOR, PLATFORM_LABEL, formatDate, formatMoney } from "@/lib/growth-v2-figure";
import { activeGoals, pctOf } from "@/lib/growth-v2-goals";
import { DEFAULT_QUIET_HOURS, ceilingPatchFor, channelAllowed, guardrailPatchFor, patchErrorMessage, type GuardrailChange } from "@/lib/growth-v2-rules";
import { AutonomyLadder } from "./autonomy-ladder";
import { PendingChangeNote, PlanChangeDialog } from "./plan-change";
import { PageHead } from "./page-head";
import { PageShell } from "@/components/dashboard/page-shell";
import { QueryBoundary } from "./query-boundary";
import { ToneBadge } from "./tone";

/** Guardrails: "What may Peakhour do?" Your plan, how much it may do alone, and the lines it never crosses (plan 1, H5; PL-3 moved the goals to Goals). */
export function RulesScreen({ intro }: { intro?: React.ReactNode } = {}) {
  const query = useGrowthV2Rules();
  return (
    <PageShell width="standard">
      <PageHead title="What may Peakhour do?" description="Your plan, how much Peakhour may do on its own, and the lines it never crosses." />
      {/* The route's "What is this page?" strip: under the title, inside the shell. */}
      {intro}
      <QueryBoundary query={query}>{(r) => <RulesBody rules={r.data} preview={r.preview} />}</QueryBoundary>
    </PageShell>
  );
}

const SIGNAL_BADGE = {
  ready: { tone: "good", label: "Signal on" },
  untracked_accepted: { tone: "neutral", label: "Not tracked" },
  needed: { tone: "warn", label: "Needs a signal" },
  needs_primary_goal: { tone: "warn", label: "Needs a primary goal" },
  not_connected: { tone: "neutral", label: "" },
} as const;

export function RulesBody({ rules, preview }: { rules: RulesResponse; preview: boolean }) {
  const m = rules.mandate;
  const [liveNow] = useState(() => Date.now());
  const now = preview ? PREVIEW_NOW : liveNow;

  if (!m) {
    return (
      <div className="grid gap-4">
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="font-medium">Peakhour is off for this business.</p>
            <p className="mx-auto max-w-prose text-sm text-muted-foreground">
              There is no plan yet. Answer a few questions and confirm on WhatsApp, and Peakhour starts by watching and proposing.
            </p>
            <Button asChild>
              <Link href={`${GROWTH_HOME}/start`}>Start the first run</Link>
            </Button>
          </CardContent>
        </Card>
        <NeverCrossed lines={rules.neverCrossed} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {rules.pendingChange ? <PendingChangeNote change={rules.pendingChange} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Autonomy</CardTitle>
          <CardDescription>Peakhour earns each level by its results, and drops back a level on its own after a bad result.</CardDescription>
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
        <PlanCard mandate={m} preview={preview} />
        <GuardrailsCard rules={rules} preview={preview} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connections</CardTitle>
          <CardDescription>Peakhour only manages accounts that bill in your plan&apos;s currency ({m.currency}).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-2 py-2">Channel</th>
                <th className="px-2 py-2">Connection</th>
                <th className="px-2 py-2">Conversion signal</th>
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
                    {c.connected && c.signal && SIGNAL_BADGE[c.signal].label ? (
                      <ToneBadge tone={SIGNAL_BADGE[c.signal].tone} dot>
                        {SIGNAL_BADGE[c.signal].label}
                      </ToneBadge>
                    ) : (
                      <span className="text-muted-foreground">&ndash;</span>
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
            Manage connections in <Link href="/dashboard/integrations" className="underline underline-offset-2">Connected accounts</Link>.
          </p>
        </CardContent>
      </Card>

      <NeverCrossed lines={rules.neverCrossed} />
    </div>
  );
}

function NeverCrossed({ lines }: { lines: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <Lock aria-hidden className="size-4" /> Never, at any level
        </CardTitle>
        <CardDescription>These do not change with autonomy. Peakhour cannot do them, whatever it has earned.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// -- The plan -------------------------------------------------------------------

/**
 * The plan summary (PL-3): the ceiling, the goals in one line each with a link to Goals, and who approves. The goals' outcomes and
 * targets are changed on Goals; the ceiling is the plan's own, changed here with the same WhatsApp code.
 */
function PlanCard({ mandate: m, preview }: { mandate: MandateView; preview: boolean }) {
  const [open, setOpen] = useState(false);
  const [ceiling, setCeiling] = useState(String(m.monthlyCeiling));
  const active = activeGoals(m);
  const later = m.goals.filter((g) => g.status === "scheduled").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your plan</CardTitle>
        <CardDescription>
          Confirmed with a one-time code on {formatDate(m.confirmation.at)}. Renews on {formatDate(m.confirmation.renewsAt)}.
        </CardDescription>
        <CardAction>
          <Button type="button" size="sm" variant="outline" disabled={preview} onClick={() => setOpen(true)}>
            Change ceiling
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          <Row term="Monthly ceiling" detail="Peakhour can never spend more than this">
            {formatMoney(m.monthlyCeiling, m.currency)}
          </Row>
          <Row term={active.length === 1 ? "Goal" : "Goals"} detail={later > 0 ? `${later} more scheduled` : "What the ceiling is split between"}>
            <span className="text-right">{active.map((g) => (active.length === 1 ? `${g.label}` : `${g.label} ${pctOf(g.share)}%`)).join(", ")}</span>
          </Row>
          <Row term="Who can approve" detail={m.approvers.length === 0 ? "Only the owner" : "People on your approvals list"}>
            {m.approvers.length === 0 ? "Owner" : `${m.approvers.length} ${m.approvers.length === 1 ? "person" : "people"}`}
          </Row>
        </dl>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Each goal&apos;s outcome, target and share are on Goals. A change is confirmed on WhatsApp first, as your plan was.</p>
          <Button asChild size="sm" variant="outline">
            <Link href={GOALS_ROUTE}>Open Goals</Link>
          </Button>
        </div>
      </CardContent>
      {open ? (
        <PlanChangeDialog title="Change your monthly ceiling" build={() => ceilingPatchFor(m, ceiling)} onClose={() => setOpen(false)}>
          <div className="grid gap-1.5">
            <label htmlFor="rules-ceiling" className="text-sm font-medium">
              Monthly ceiling ({m.currency})
            </label>
            <Input id="rules-ceiling" inputMode="numeric" className="tabular-nums" value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
            <p className="text-xs text-muted-foreground">Each goal keeps its share of the new ceiling.</p>
          </div>
        </PlanChangeDialog>
      ) : null}
    </Card>
  );
}

// -- Guardrails -------------------------------------------------------------------

export function QuietHoursForm({ saved, busy, onSave }: { saved: { start: string; end: string }; busy: boolean; onSave: (v: { start: string; end: string }) => void }) {
  const [times, setTimes] = useState(saved);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Input aria-label="Quiet hours start" type="time" className="w-28" value={times.start} onChange={(e) => setTimes({ ...times, start: e.target.value })} />
      <span>to</span>
      <Input aria-label="Quiet hours end" type="time" className="w-28" value={times.end} onChange={(e) => setTimes({ ...times, end: e.target.value })} />
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onSave(times)}>
        Save times
      </Button>
    </div>
  );
}

function GuardrailsCard({ rules, preview }: { rules: RulesResponse; preview: boolean }) {
  const g = rules.guardrails;
  const patch = usePatchRules();
  const [error, setError] = useState<string>();
  const [term, setTerm] = useState("");
  const busy = preview || patch.isPending;

  function apply(change: GuardrailChange) {
    const r = guardrailPatchFor(g, change);
    if ("error" in r) return setError(r.error);
    setError(undefined);
    patch.mutate({ guardrails: r.patch }, { onError: (e) => setError(patchErrorMessage(e)) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guardrails</CardTitle>
        <CardDescription>Peakhour checks these before it proposes anything, not after. A change here is saved at once.</CardDescription>
        {g.adsHalted ? (
          <CardAction>
            <ToneBadge tone="bad" dot>
              Ads halted
            </ToneBadge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {error ? (
          <p role="alert" className="text-sm text-destructive-on-tint">
            {error}
          </p>
        ) : null}
        <dl className="divide-y">
          <Row term="Only use creatives I approved" detail="New creatives wait in Decisions until you approve them">
            <Switch
              checked={g.approvedAssetsOnly}
              disabled={busy}
              onCheckedChange={(on) => apply({ kind: "approved_assets", on })}
              aria-label="Only use creatives I approved"
            />
          </Row>
          <Row
            term="Quiet hours"
            detail={g.quietHours ? `No launches ${g.quietHours.start} to ${g.quietHours.end}${g.timeZone ? ` (${g.timeZone})` : ""}` : "None set"}
          >
            <Switch
              checked={g.quietHours !== null}
              disabled={busy}
              onCheckedChange={(on) => apply({ kind: "quiet_hours", value: on ? (g.quietHours ?? { ...DEFAULT_QUIET_HOURS }) : null })}
              aria-label="Quiet hours"
            />
          </Row>
        </dl>
        {g.quietHours ? (
          // Keyed by the saved times: a save, a refetch or another tab's change remounts the form on what is stored.
          <QuietHoursForm key={`${g.quietHours.start}-${g.quietHours.end}`} saved={g.quietHours} busy={busy} onSave={(value) => apply({ kind: "quiet_hours", value })} />
        ) : null}

        <div className="grid gap-1.5">
          <b className="text-sm font-medium">Blocked words</b>
          <p className="text-xs text-muted-foreground">No ad may carry these: claims, competitor names, anything you never want said.</p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Blocked words">
            {g.blockedTerms.length === 0 ? <li className="text-xs text-muted-foreground">None</li> : null}
            {g.blockedTerms.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove ${t}`}
                  onClick={() => apply({ kind: "blocked_terms", terms: g.blockedTerms.filter((x) => x !== t) })}
                  className="rounded-full border bg-muted px-2.5 py-0.5 text-xs hover:bg-muted/60 disabled:opacity-50"
                >
                  &ldquo;{t}&rdquo; &times;
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = term.trim();
              if (t === "") return;
              // The api stores one normalised form, so "Free" beside "free" is one rule: nothing to send.
              if (g.blockedTerms.some((x) => x.toLowerCase() === t.toLowerCase())) return setTerm("");
              apply({ kind: "blocked_terms", terms: [...g.blockedTerms, t] });
              setTerm("");
            }}
          >
            <Input aria-label="Add a blocked word" className="h-8" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Add a word or phrase" />
            <Button type="submit" size="sm" variant="outline" disabled={busy || term.trim() === ""}>
              Add
            </Button>
          </form>
        </div>

        <div className="grid gap-1">
          <b className="text-sm font-medium">Channels Peakhour may use</b>
          <dl className="divide-y">
            {rules.connections.map((c) => (
              <Row key={c.platform} term={PLATFORM_LABEL[c.platform]} detail={c.connected ? "Connected" : "Not connected yet"}>
                <Switch
                  checked={channelAllowed(g, c.platform)}
                  disabled={busy}
                  onCheckedChange={(allowed) => apply({ kind: "channel", platform: c.platform, allowed })}
                  aria-label={`Let Peakhour use ${PLATFORM_LABEL[c.platform]}`}
                />
              </Row>
            ))}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

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
