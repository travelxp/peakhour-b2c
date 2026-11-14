"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useFirstRunDraft,
  useGrowthV2Home,
  useGrowthV2Rules,
  type DraftOffer,
  type GoalCampaignView,
  type GoalParseResponse,
  type HomeGoal,
  type MandateGoalView,
  type MandateView,
  type RulesResponse,
} from "@/lib/api/growth-v2";
import { GROWTH_HOME } from "@/lib/growth-v2-nav";
import { PLATFORM_LABEL, figureText, formatMoney } from "@/lib/growth-v2-figure";
import { GOAL_MAX, offerKey } from "@/lib/growth-v2-firstrun";
import {
  STATUS_WORD,
  activeGoals,
  addGoalPatch,
  assignPatch,
  countsWhat,
  editFormOf,
  editGoalPatch,
  endGoalPatch,
  formFromParsed,
  namedGoal,
  parsePct,
  pctOf,
  preselected,
  rebalance,
  resultOf,
  sharesAfterAdd,
  unfilledOf,
  type GoalAddForm,
  type GoalEditForm,
} from "@/lib/growth-v2-goals";
import { DescribeGoal } from "./describe-goal";
import { PageHead } from "./page-head";
import { PageShell } from "@/components/dashboard/page-shell";
import { PendingChangeNote, PlanChangeDialog } from "./plan-change";
import { QueryBoundary } from "./query-boundary";
import { ToneBadge, type Tone } from "./tone";

/**
 * Goals (PL-3): every goal of the plan, past, present and scheduled, with its share of the ceiling, its target and this month's
 * results, and which goal each campaign serves.
 *
 * ★EVERY ACTION IS A PLAN CHANGE CONFIRMED ON WHATSAPP (`PlanChangeDialog`, the one flow the Guardrails ceiling uses too).
 * ★THE MONEY FOLLOWS THE CAMPAIGNS: Peakhour moves a campaign's budget only inside the goal it belongs to, so a campaign with no
 * goal in a plan of several goals is left exactly as it is. A suggested goal is only pre-selected; it is sent when you save.
 */
export function GoalsScreen() {
  const rules = useGrowthV2Rules();
  const home = useGrowthV2Home();
  const homeData = home.data && "data" in home.data ? home.data : undefined;
  return (
    <PageShell width="standard">
      <PageHead title="Goals" description="What your plan is for: each goal's share of your monthly ceiling, its target and how it is doing this month." />
      <QueryBoundary query={rules}>
        {(r) => <GoalsBody rules={r.data} preview={r.preview} results={homeData && homeData.preview === r.preview ? homeData.data.goals?.items : undefined} />}
      </QueryBoundary>
    </PageShell>
  );
}

const STATUS_TONE: Record<MandateGoalView["status"], Tone> = { active: "good", scheduled: "info", done: "neutral" };

const targetWords = (g: Pick<MandateGoalView, "target">, currency: string) => (g.target.kind === "roas" ? `${g.target.value}x return` : `${formatMoney(g.target.value, currency)} each`);

type Open = { kind: "edit" | "end"; goal: MandateGoalView } | { kind: "add" } | { kind: "campaigns" } | undefined;

export function GoalsBody({ rules, preview, results }: { rules: RulesResponse; preview: boolean; results?: HomeGoal[] }) {
  const m = rules.mandate;
  const [open, setOpen] = useState<Open>();
  const [picks, setPicks] = useState<Record<string, string>>({});

  if (!m) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="font-medium">There is no plan yet.</p>
          <p className="mx-auto max-w-prose text-sm text-muted-foreground">Answer a few questions and confirm on WhatsApp, and your goals appear here.</p>
          <Button asChild>
            <Link href={`${GROWTH_HOME}/start`}>Start the first run</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const active = activeGoals(m);
  const close = () => setOpen(undefined);
  const campaigns = rules.campaigns ?? [];
  const changed = assignPatch(m, campaigns, picks);

  return (
    <div className="grid gap-4">
      {rules.pendingChange ? <PendingChangeNote change={rules.pendingChange} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Your goals</CardTitle>
          <CardDescription>
            {formatMoney(m.monthlyCeiling, m.currency)} a month, split between {active.length === 1 ? "one goal" : `${active.length} goals`}. A change is confirmed on WhatsApp first.
          </CardDescription>
          <CardAction>
            <Button type="button" size="sm" disabled={preview || m.goals.length >= GOAL_MAX} onClick={() => setOpen({ kind: "add" })}>
              Add goal
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="divide-y" aria-label="Goals">
            {m.goals.map((g) => (
              <GoalRow
                key={g.goalId}
                goal={g}
                currency={m.currency}
                result={resultOf(results, g.goalId)}
                disabled={preview}
                onlyActive={g.status === "active" && active.length === 1}
                onEdit={() => setOpen({ kind: "edit", goal: g })}
                onEnd={() => setOpen({ kind: "end", goal: g })}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Which goal does each campaign serve?</CardTitle>
          <CardDescription>
            Peakhour moves a campaign&apos;s budget only inside its goal.{" "}
            {active.length > 1 ? "A campaign with no goal is left exactly as it is." : "With one goal, every campaign serves it."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live or paused campaigns yet.</p>
          ) : (
            <ul className="divide-y" aria-label="Campaigns">
              {campaigns.map((c) => (
                <CampaignRow key={c.campaignId} c={c} m={m} value={picks[c.campaignId] ?? preselected(c)} disabled={preview} noneAllowed={active.length > 1} onPick={(v) => setPicks({ ...picks, [c.campaignId]: v })} />
              ))}
            </ul>
          )}
          {campaigns.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
              <span className="text-xs text-muted-foreground">{changed ? `${changed.assign!.length} to save` : "Nothing to save"}</span>
              <Button type="button" size="sm" disabled={preview || !changed} onClick={() => setOpen({ kind: "campaigns" })}>
                Save campaigns
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {open?.kind === "edit" ? <EditGoalDialog m={m} goal={open.goal} onClose={close} /> : null}
      {open?.kind === "end" ? <EndGoalDialog m={m} goal={open.goal} onClose={close} /> : null}
      {open?.kind === "add" ? <AddGoalDialog m={m} onClose={close} /> : null}
      {open?.kind === "campaigns" ? (
        <PlanChangeDialog title="Give campaigns their goals" build={() => assignPatch(m, campaigns, picks)} onSent={() => setPicks({})} onClose={close}>
          <ul className="grid gap-1 text-sm">
            {(changed?.assign ?? []).map((a) => (
              <li key={a.campaignId}>
                {campaigns.find((c) => c.campaignId === a.campaignId)?.name ?? a.campaignId}: <b>{a.goalId ? (m.goals.find((g) => g.goalId === a.goalId)?.label ?? a.goalId) : "No goal"}</b>
              </li>
            ))}
          </ul>
        </PlanChangeDialog>
      ) : null}
    </div>
  );
}

function GoalRow({
  goal: g,
  currency,
  result,
  disabled,
  onlyActive,
  onEdit,
  onEnd,
}: {
  goal: MandateGoalView;
  currency: string;
  result: HomeGoal["soFar"] | undefined;
  disabled: boolean;
  onlyActive: boolean;
  onEdit: () => void;
  onEnd: () => void;
}) {
  return (
    <li className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_9rem] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-sm">{g.label}</b>
          {/* the api's words on the business calendar; the browser formats no date. An ended goal's words ("Ended 15 Nov") are its badge. */}
          <ToneBadge tone={STATUS_TONE[g.status]}>{g.status === "done" && g.dayWords ? g.dayWords : STATUS_WORD[g.status]}</ToneBadge>
          {g.dayWords && g.status !== "done" ? <span className="text-xs text-muted-foreground">{g.dayWords}</span> : null}
        </div>
        <p className="text-xs text-muted-foreground">Counts {countsWhat(g)}</p>
        {g.note ? (
          <p role="status" data-note-id={g.note.id} className="mt-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs">
            {g.note.detail}
          </p>
        ) : null}
      </div>
      <Cell term="Share">{g.status === "active" ? `${pctOf(g.share)}% · ${formatMoney(g.monthlyBudget, currency)}` : "None"}</Cell>
      <Cell term="Target">{targetWords(g, currency)}</Cell>
      <Cell term="This month">{g.status === "done" ? "Ended" : result ? figureText(result) : "Not available"}</Cell>
      <div className="flex gap-2 sm:justify-end">
        {g.status === "done" ? null : (
          <>
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onEdit}>
              Edit
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={disabled || onlyActive} title={onlyActive ? "Add another goal before ending your only one." : undefined} onClick={onEnd}>
              End
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function Cell({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 text-sm sm:block">
      <span className="text-xs text-muted-foreground sm:block">{term}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

const HOW: Record<GoalCampaignView["how"], string | undefined> = {
  assigned: undefined,
  trail: "From the last change Peakhour made to it.",
  only: "Your plan has one goal.",
  unknown: undefined,
};

/** `noneAllowed` is false in a plan of one active goal: it owns every campaign, so "No goal" could not stick. */
function CampaignRow({ c, m, value, disabled, noneAllowed, onPick }: { c: GoalCampaignView; m: MandateView; value: string; disabled: boolean; noneAllowed: boolean; onPick: (goalId: string) => void }) {
  const suggestedShown = c.suggested !== undefined && value === c.suggested.goalId && namedGoal(m, c.campaignId) === "";
  const id = `campaign-goal-${c.campaignId}`;
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-center">
      <div className="min-w-0">
        <label htmlFor={id} className="block truncate text-sm font-medium">
          {c.name}
        </label>
        <p className="text-xs text-muted-foreground">
          {PLATFORM_LABEL[c.platform] ?? c.platform}
          {c.status === "paused" ? " · Paused" : ""}
          {HOW[c.how] && value === c.goalId ? ` · ${HOW[c.how]}` : ""}
        </p>
        {suggestedShown ? (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <ToneBadge tone="ai">Suggested</ToneBadge>
            {c.suggested!.why}
          </p>
        ) : null}
      </div>
      <select id={id} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={value} disabled={disabled} onChange={(e) => onPick(e.target.value)}>
        {noneAllowed || value === "" ? <option value="">No goal</option> : null}
        {m.goals
          .filter((g) => g.status !== "done" || g.goalId === value)
          .map((g) => (
            <option key={g.goalId} value={g.goalId}>
              {g.label}
            </option>
          ))}
      </select>
    </li>
  );
}

/** The split the form will send, in words, so the merchant confirms the other goals' new shares. */
function SplitPreview({ m, pcts }: { m: MandateView; pcts: Record<string, number> }) {
  const rows = Object.entries(pcts);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="mb-1 text-xs text-muted-foreground">Your other goals become</p>
      <ul className="grid gap-0.5">
        {rows.map(([id, pct]) => (
          <li key={id} className="flex justify-between gap-2">
            <span>{m.goals.find((g) => g.goalId === id)?.label ?? id}</span>
            <b className="tabular-nums">
              {pct}% · {formatMoney(Math.round((m.monthlyCeiling * pct) / 100), m.currency)}
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditGoalDialog({ m, goal, onClose }: { m: MandateView; goal: MandateGoalView; onClose: () => void }) {
  const [form, setForm] = useState<GoalEditForm>(() => editFormOf(goal));
  const pct = parsePct(form.share);
  const others = activeGoals(m).filter((g) => g.goalId !== goal.goalId);
  const moved = goal.status === "active" && pct !== undefined && pct !== pctOf(goal.share) && others.length > 0;
  const split = moved ? rebalance(activeGoals(m), { [goal.goalId]: pct }) : {};
  delete split[goal.goalId];
  return (
    <PlanChangeDialog title={`Change ${goal.label}`} build={() => editGoalPatch(m, goal, form)} onClose={onClose}>
      <div className="grid gap-1.5">
        <label htmlFor="goal-target" className="text-sm font-medium">
          {goal.target.kind === "roas" ? "Target return (x)" : `Target cost per outcome (${m.currency})`}
        </label>
        <Input id="goal-target" inputMode="decimal" className="tabular-nums" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
      </div>
      {goal.status === "active" ? (
        <div className="grid gap-1.5">
          <label htmlFor="goal-share" className="text-sm font-medium">
            Share of the monthly ceiling (%)
          </label>
          <Input id="goal-share" inputMode="decimal" className="tabular-nums" disabled={others.length === 0} value={form.share} onChange={(e) => setForm({ ...form, share: e.target.value })} />
          {others.length === 0 ? <p className="text-xs text-muted-foreground">Your only active goal has all of the ceiling.</p> : null}
        </div>
      ) : null}
      {moved ? <SplitPreview m={m} pcts={split} /> : null}
    </PlanChangeDialog>
  );
}

function EndGoalDialog({ m, goal, onClose }: { m: MandateView; goal: MandateGoalView; onClose: () => void }) {
  const rest = activeGoals(m).filter((g) => g.goalId !== goal.goalId);
  return (
    <PlanChangeDialog title={`End ${goal.label}`} build={() => endGoalPatch(m, goal)} onClose={onClose} submitLabel="End goal and send for confirmation">
      <p className="text-sm">
        {goal.label} stops spending once you confirm. It stays on this page as ended{goal.campaignIds?.length ? ", with its campaigns left as they are" : ""}.
      </p>
      {goal.status === "active" && rest.length > 0 ? <SplitPreview m={m} pcts={rebalance(rest, {})} /> : null}
    </PlanChangeDialog>
  );
}

function AddGoalDialog({ m, onClose }: { m: MandateView; onClose: () => void }) {
  const draft = useFirstRunDraft({}).data;
  const lines = draft?.lines ?? [];
  const [form, setForm] = useState<GoalAddForm>({ lineId: "", offer: "", target: "", share: "" });
  const line = lines.find((l) => l.id === form.lineId);
  const offers: DraftOffer[] = line ? line.offers : lines.length > 0 ? [] : (draft?.offers ?? []);
  const offer = offers.find((o) => offerKey(o) === form.offer) ?? offers[0];
  const chosen: GoalAddForm = { ...form, offer: offer ? offerKey(offer) : "" };
  const pct = parsePct(form.share);
  // PL-9: a draft from a sentence only fills the form; nothing is sent until the merchant presses the dialog's own button.
  const fill = (goal: GoalParseResponse["goal"]): string[] => {
    const next = formFromParsed(goal, lines, draft?.offers ?? []);
    setForm(next);
    return unfilledOf(goal, next);
  };
  return (
    <PlanChangeDialog title="Add a goal" build={() => addGoalPatch(m, chosen, offers)} onClose={onClose}>
      {!draft ? <p className="text-sm text-muted-foreground">Loading what your business can be measured on.</p> : null}
      <DescribeGoal ready={draft !== undefined} onDraft={fill} />
      {lines.length > 0 ? (
        <div className="grid gap-1.5">
          <label htmlFor="goal-line" className="text-sm font-medium">
            What it is for
          </label>
          <select id="goal-line" className="h-9 rounded-md border bg-background px-2 text-sm" value={form.lineId} onChange={(e) => setForm({ ...form, lineId: e.target.value, offer: "", target: "" })}>
            <option value="">Choose one</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <label htmlFor="goal-outcome" className="text-sm font-medium">
          What you want more of
        </label>
        <select id="goal-outcome" className="h-9 rounded-md border bg-background px-2 text-sm" value={chosen.offer} disabled={offers.length === 0} onChange={(e) => setForm({ ...form, offer: e.target.value, target: "" })}>
          {offers.map((o) => (
            <option key={offerKey(o)} value={offerKey(o)}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="goal-new-target" className="text-sm font-medium">
          {offer?.optimizeFor === "value" ? "Target return (x)" : `Target cost per outcome (${m.currency})`}
        </label>
        <Input
          id="goal-new-target"
          inputMode="decimal"
          className="tabular-nums"
          placeholder={offer?.defaultTarget ? `${offer.defaultTarget.value} (the playbook's)` : "Enter a target"}
          value={form.target}
          onChange={(e) => setForm({ ...form, target: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="goal-new-share" className="text-sm font-medium">
          Share of the monthly ceiling (%)
        </label>
        <Input id="goal-new-share" inputMode="decimal" className="tabular-nums" value={form.share} onChange={(e) => setForm({ ...form, share: e.target.value })} />
      </div>
      {pct !== undefined && pct > 0 && pct < 100 && form.timing?.status !== "scheduled" ? <SplitPreview m={m} pcts={sharesAfterAdd(m, pct)} /> : null}
    </PlanChangeDialog>
  );
}
