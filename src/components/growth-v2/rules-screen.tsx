"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFirstRunDraft, useGrowthV2Rules, usePatchRules, type MandateView, type RulesResponse } from "@/lib/api/growth-v2";
import { GROWTH_HOME } from "@/lib/growth-v2-nav";
import { PREVIEW_NOW } from "@/lib/growth-v2-fixtures";
import { OUTCOME_UNIT, PLATFORM_COLOR, PLATFORM_LABEL, formatDate, formatMoney } from "@/lib/growth-v2-figure";
import { offerKey } from "@/lib/growth-v2-firstrun";
import {
  DEFAULT_QUIET_HOURS,
  SENT_FOR_CONFIRMATION,
  channelAllowed,
  editAfterOutcome,
  editFrom,
  guardrailPatchFor,
  mandatePatchFor,
  patchErrorMessage,
  type GuardrailChange,
  type MandateEdit,
} from "@/lib/growth-v2-rules";
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
            <p className="font-medium">The engine is off for this business.</p>
            <p className="mx-auto max-w-prose text-sm text-muted-foreground">
              There is no mandate yet. Answer three questions and confirm on WhatsApp, and the engine starts by watching and proposing.
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
      {rules.pendingChange ? (
        <div role="status" className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
          <b>A change is waiting for your confirmation.</b>
          <p className="mt-0.5">{rules.pendingChange.summary}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Until you confirm it, your plan is exactly as it was. The request expires on {formatDate(rules.pendingChange.expiresAt)}.</p>
        </div>
      ) : null}
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
        <MandateCard mandate={m} preview={preview} />
        <GuardrailsCard rules={rules} preview={preview} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connections</CardTitle>
          <CardDescription>The engine only manages accounts that bill in your mandate&apos;s currency ({m.currency}).</CardDescription>
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
            Manage connections in <Link href="/dashboard/integrations" className="underline underline-offset-2">Integrations</Link>.
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
        <CardDescription>These do not change with autonomy. The engine cannot do them, whatever it has earned.</CardDescription>
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

// -- The mandate -----------------------------------------------------------------

function MandateCard({ mandate: m, preview }: { mandate: MandateView; preview: boolean }) {
  const [open, setOpen] = useState(false);
  const target = m.target.kind === "roas" ? `${m.target.value.toFixed(1)}x return` : formatMoney(m.target.value, m.currency);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your mandate</CardTitle>
        <CardDescription>
          Confirmed with a one-time code on {formatDate(m.confirmation.at)}. Renews on {formatDate(m.confirmation.renewsAt)}.
        </CardDescription>
        <CardAction>
          <Button type="button" size="sm" variant="outline" disabled={preview} onClick={() => setOpen(true)}>
            Change
          </Button>
        </CardAction>
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
        <p className="mt-3 text-xs text-muted-foreground">A change to the outcome, the ceiling or the target is confirmed on WhatsApp first, as your plan was. Until then nothing changes.</p>
      </CardContent>
      {open ? <MandateEditDialog mandate={m} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

function MandateEditDialog({ mandate: m, onClose }: { mandate: MandateView; onClose: () => void }) {
  const [edit, setEdit] = useState<MandateEdit>(() => editFrom(m));
  const [error, setError] = useState<string>();
  const patch = usePatchRules();
  const offers = useFirstRunDraft({}).data?.offers ?? [];
  const offer = offers.find((o) => offerKey(o) === edit.offer);
  const sent = patch.isSuccess && patch.data.mandateChange !== undefined;
  // A 200 that started no change leaves nothing to wait for: say so rather than sit there looking dead.
  const notSent = patch.isSuccess && !sent;

  function submit() {
    const p = mandatePatchFor(m, edit, offers);
    if (p === undefined) return setError("Nothing is different from your plan.");
    if ("error" in p) return setError(p.error);
    setError(undefined);
    patch.mutate({ mandate: p });
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change your plan</DialogTitle>
          <DialogDescription>We send a link to your WhatsApp. Your plan changes only when you open it and enter the code.</DialogDescription>
        </DialogHeader>
        {sent ? (
          <p role="status" className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
            {SENT_FOR_CONFIRMATION}
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label htmlFor="rules-outcome" className="text-sm font-medium">
                What you want more of
              </label>
              <select
                id="rules-outcome"
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={edit.offer}
                onChange={(e) => setEdit(editAfterOutcome(m, edit, e.target.value, offers))}
              >
                {offers.length === 0 ? <option value={edit.offer}>{outcomeLabel(m.outcome)}</option> : null}
                {offers.map((o) => (
                  <option key={offerKey(o)} value={offerKey(o)}>
                    {o.label}
                  </option>
                ))}
              </select>
              {offer && offer.source === "orders" && (offer.focusSuggestions.length > 0 || (offerKey(offer) === offerKey(m.outcome) && m.outcome.focus)) ? (
                <select
                  aria-label="Focus"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={edit.focus}
                  onChange={(e) => setEdit({ ...edit, focus: e.target.value })}
                >
                  <option value="">Everything</option>
                  {/* The saved focus stays choosable when this week's suggestions no longer rank it. */}
                  {offerKey(offer) === offerKey(m.outcome) && m.outcome.focus && !offer.focusSuggestions.some((f) => f.label === m.outcome.focus!.label) ? (
                    <option value={m.outcome.focus.label}>{m.outcome.focus.label} (current)</option>
                  ) : null}
                  {offer.focusSuggestions.map((f) => (
                    <option key={`${f.by}:${f.label}`} value={f.label}>
                      {f.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="rules-ceiling" className="text-sm font-medium">
                Monthly ceiling ({m.currency})
              </label>
              <Input id="rules-ceiling" inputMode="numeric" className="tabular-nums" value={edit.ceiling} onChange={(e) => setEdit({ ...edit, ceiling: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="rules-target" className="text-sm font-medium">
                {(offer ? offer.optimizeFor === "value" : m.target.kind === "roas") ? "Target return (x)" : `Target cost per outcome (${m.currency})`}
              </label>
              <Input id="rules-target" inputMode="decimal" className="tabular-nums" value={edit.target} onChange={(e) => setEdit({ ...edit, target: e.target.value })} />
            </div>
            {error || patch.isError || notSent ? (
              <p role="alert" className="text-sm text-destructive-on-tint">
                {error ?? (notSent ? "The change was not sent. Check your WhatsApp number in Settings and try again." : patchErrorMessage(patch.error))}
              </p>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {sent ? "Close" : "Cancel"}
          </Button>
          {sent ? null : (
            <Button type="button" onClick={submit} disabled={patch.isPending}>
              Send for confirmation
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -- Guardrails -------------------------------------------------------------------

function GuardrailsCard({ rules, preview }: { rules: RulesResponse; preview: boolean }) {
  const g = rules.guardrails;
  const patch = usePatchRules();
  const [error, setError] = useState<string>();
  const [term, setTerm] = useState("");
  const [times, setTimes] = useState<{ start: string; end: string }>(g.quietHours ?? DEFAULT_QUIET_HOURS);
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
        <CardDescription>The engine checks these before it proposes anything, not after. A change here is saved at once.</CardDescription>
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
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Input aria-label="Quiet hours start" type="time" className="w-28" value={times.start} onChange={(e) => setTimes({ ...times, start: e.target.value })} />
            <span>to</span>
            <Input aria-label="Quiet hours end" type="time" className="w-28" value={times.end} onChange={(e) => setTimes({ ...times, end: e.target.value })} />
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => apply({ kind: "quiet_hours", value: times })}>
              Save times
            </Button>
          </div>
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
          <b className="text-sm font-medium">Channels the engine may use</b>
          <dl className="divide-y">
            {rules.connections.map((c) => (
              <Row key={c.platform} term={PLATFORM_LABEL[c.platform]} detail={c.connected ? "Connected" : "Not connected yet"}>
                <Switch
                  checked={channelAllowed(g, c.platform)}
                  disabled={busy}
                  onCheckedChange={(allowed) => apply({ kind: "channel", platform: c.platform, allowed })}
                  aria-label={`Let the engine use ${PLATFORM_LABEL[c.platform]}`}
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
