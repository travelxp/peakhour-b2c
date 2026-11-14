"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, MapPin, MessageSquare, Phone, ShoppingCart, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useConfirmPlan, useFirstRunDraft, usePatchRules, type DraftLine, type DraftOffer, type FirstRunDraftResponse, type OutcomeKind } from "@/lib/api/growth-v2";
import { useSignalReadiness } from "@/lib/api/growth-v2-signal";
import { canContinue } from "@/lib/growth-v2-signal";
import { OUTCOME_UNIT, PLATFORM_COLOR, PLATFORM_LABEL, formatMoney } from "@/lib/growth-v2-figure";
import {
  asksForCampaigns,
  buildPlanBody,
  campaignLine,
  ceilingChips,
  chosenLines,
  lineOffer,
  lineShares,
  lineTarget,
  offerKey,
  parseAmount,
  planBlockedReason,
  resolveTarget,
  selectedFocus,
  selectedOffer,
  sendErrorMessage,
  targetKindOf,
  targetQuestion,
  TARGET_NOT_A_FEE,
  type FirstRunAnswers,
  type GoalAnswers,
} from "@/lib/growth-v2-firstrun";
import { GROWTH_HOME } from "@/lib/growth-v2-nav";
import { patchErrorMessage } from "@/lib/growth-v2-rules";
import { startingFromWords } from "@/lib/growth-v2-starting-from";
import { PageHead } from "./page-head";
import { PageShell } from "@/components/dashboard/page-shell";
import { SignalStep } from "./signal-step";
import { ShareResultsOptIn } from "./share-results-opt-in";
import { ToneBadge } from "./tone";

/**
 * First run: three questions, then a drafted plan, then one WhatsApp confirmation (plan 1 and 2.10, row H5).
 *
 * ★THE OPTIONS ARE THE API'S OFFERS, NOT A FIXED LIST. `onboarding/draft` builds them from this business's own evidence
 * (`offerableOutcomes`): store visits appear only when Google would count them, calls only with call conversions, and sales
 * and bookings show the categories the shop really sold. A business that is offered nothing is told so, not shown a menu.
 * ★A TIE IS ASKED BEFORE ANYTHING ELSE: when two playbooks fit equally the draft carries the candidates and no plan.
 * ★PL-3: "WHAT DO YOU SELL?" FIRST, when the playbook has lines: the lines the catalog and profile point to are pre-ticked, then one
 * goal per ticked line, the ceiling with a suggested split, and each goal's target; a plan of several goals ends by giving each
 * campaign its goal. A playbook with no lines asks the three questions as before.
 * ★NOTHING SPENDS FROM HERE. "Send to WhatsApp to confirm" stores the plan pending and sends a signed link; the plan starts
 * only when the one-time code on that link's page is accepted (`/growth/confirm/[token]`).
 */

const ICON: Record<OutcomeKind, LucideIcon> = { bookings: Building2, leads: MessageSquare, sales: ShoppingCart, calls: Phone, store_visits: MapPin };
const HINT: Record<OutcomeKind, string> = {
  bookings: "Paid bookings",
  leads: "Enquiries and forms",
  sales: "Shop orders",
  calls: "Phone and WhatsApp",
  store_visits: "Walk-ins Google can count",
};
const ROLE_LABEL = { lead: "Lead channel", test: "Test" } as const;

export function FirstRunScreen() {
  const [playbookId, setPlaybookId] = useState<string>();
  const [inPerson, setInPerson] = useState<boolean>();
  const [offer, setOffer] = useState<string>();
  const [focus, setFocus] = useState<string>();
  const [typedCeiling, setTypedCeiling] = useState<string>();
  const [typedTarget, setTypedTarget] = useState<string>();
  const [zone, setZone] = useState<string>();
  // PL-3: one goal per line
  const [ticked, setTicked] = useState<string[]>();
  const [goalAnswers, setGoalAnswers] = useState<Record<string, GoalAnswers>>({});
  const [typedShares, setTypedShares] = useState<Record<string, string>>();
  const [campaignPicks, setCampaignPicks] = useState<Record<string, string>>({});

  const query = useFirstRunDraft({ ...(playbookId ? { playbookId } : {}), ...(inPerson !== undefined ? { customersVisitInPerson: inPerson } : {}) });
  const signalDone = canContinue(useSignalReadiness().data);
  const confirm = useConfirmPlan();
  const saveZone = usePatchRules();
  const draft = query.data;

  // The ceiling starts at the playbook's middle band; the merchant's own typing always wins, including an empty box.
  const defaultCeiling = draft ? String(ceilingChips(draft).find((c) => c.key === "steady")?.amount ?? "") : "";
  const answers: FirstRunAnswers = {
    ...(offer ? { offer } : {}),
    ...(focus ? { focus } : {}),
    ceiling: typedCeiling ?? defaultCeiling,
    ...(typedTarget !== undefined ? { target: typedTarget } : {}),
    ...(ticked ? { lines: ticked } : {}),
    goals: goalAnswers,
    ...(typedShares ? { shares: typedShares } : {}),
    campaigns: campaignPicks,
  };
  const body = draft ? buildPlanBody(draft, answers) : undefined;
  const setGoal = (lineId: string, a: GoalAnswers) => setGoalAnswers((all) => ({ ...all, [lineId]: a }));
  const firstLine = draft ? chosenLines(draft, answers)[0] : undefined;
  const signalOffer = firstLine ? lineOffer(firstLine, answers) : draft ? selectedOffer(draft, answers) : undefined;
  // ★A DRAFT THAT IS NOT THE ANSWER TO THE LATEST ANSWERS IS NOT SENT: while the next one loads (the old one stays on screen so the
  // page does not blink), and when it failed, the plan on screen was drafted for different answers than the ones given.
  const stale = query.isPlaceholderData ? "Updating your plan for that answer." : query.isError && draft ? "We could not update your plan for that answer. Reload the page to try again." : undefined;
  // Any answer changed after the send is a new plan: the sent state, and its Check WhatsApp, no longer describe what is on screen.
  const edited = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
    if (confirm.isSuccess || confirm.isError) confirm.reset();
    fn(...a);
  };
  const suggestedZone = draft && "absent" in draft.timeZone ? (draft.timeZone.suggested ?? "") : "";

  return (
    <PageShell width="narrow">
      <FirstRunView
        draft={draft}
        loadFailed={query.isError}
        answers={answers}
        typedTarget={typedTarget}
        inPerson={inPerson}
        zone={zone ?? suggestedZone}
        zoneSaving={saveZone.isPending}
        zoneError={saveZone.isError ? patchErrorMessage(saveZone.error) : undefined}
        signalStep={
          <SignalStep
            optimizeFor={signalOffer?.optimizeFor ?? "count"}
            focusLabel={firstLine ? selectedFocus(signalOffer, { ceiling: "", ...goalAnswers[firstLine.id] })?.label : draft ? selectedFocus(selectedOffer(draft, answers), answers)?.label : undefined}
            onContinue={() => document.getElementById("first-run-plan")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
        }
        shareStep={<ShareResultsOptIn />}
        blockedReason={stale ?? planBlockedReason(draft, answers, signalDone)}
        sending={confirm.isPending}
        sent={confirm.isSuccess}
        sendError={confirm.isError ? sendErrorMessage(confirm.error) : undefined}
        onChooseTie={edited((id: string) => {
          setPlaybookId(id);
          setOffer(undefined);
          setFocus(undefined);
          setTypedTarget(undefined);
        })}
        onInPerson={edited((v: boolean) => {
          // A changed answer changes which outcomes are offered, so the first one, and the target it defaults to, may be another;
          // the same answer again changes nothing and keeps what was typed.
          if (v !== inPerson) setTypedTarget(undefined);
          setInPerson(v);
        })}
        onOffer={edited((key: string) => {
          setOffer(key);
          setFocus(undefined);
          setTypedTarget(undefined);
        })}
        onFocus={edited(setFocus)}
        onCeiling={edited(setTypedCeiling)}
        onTarget={edited(setTypedTarget)}
        onToggleLine={edited((id: string, on: boolean) => {
          const now = draft ? chosenLines(draft, answers).map((l) => l.id) : [];
          setTicked(on ? [...now.filter((x) => x !== id), id] : now.filter((x) => x !== id));
          // a new set of goals has a new suggested split
          setTypedShares(undefined);
        })}
        onLineOffer={edited((lineId: string, key: string) => setGoal(lineId, { offer: key }))}
        onLineFocus={edited((lineId: string, label: string | undefined) => setGoal(lineId, { ...goalAnswers[lineId], focus: label }))}
        onLineTarget={edited((lineId: string, text: string) => setGoal(lineId, { ...goalAnswers[lineId], target: text }))}
        onShare={edited((lineId: string, text: string) => {
          // the first typed share fixes every box at what it showed, so the others do not move under the merchant's hand
          const shown = draft ? lineShares(draft, answers) : {};
          setTypedShares({ ...Object.fromEntries(Object.entries(shown).map(([k, v]) => [k, v === undefined ? "" : String(v)])), ...typedShares, [lineId]: text });
        })}
        onCampaign={edited((campaignId: string, lineId: string) => setCampaignPicks((all) => ({ ...all, [campaignId]: lineId })))}
        onZone={setZone}
        onSaveZone={() => {
          const tz = (zone ?? suggestedZone).trim();
          if (tz) saveZone.mutate({ guardrails: { timeZone: tz } });
        }}
        onSend={() => body && confirm.mutate(body)}
      />
    </PageShell>
  );
}

export interface FirstRunViewProps {
  draft: FirstRunDraftResponse | undefined;
  loadFailed?: boolean;
  answers: FirstRunAnswers;
  /** What the merchant typed into the target box, if anything; the box otherwise shows the playbook's default. */
  typedTarget?: string;
  inPerson?: boolean;
  zone: string;
  zoneSaving?: boolean;
  zoneError?: string;
  /** Step 4, the conversion signal (C3). A slot, so the view renders without the api. */
  signalStep: React.ReactNode;
  /** The shared-network opt-in on the plan card (PL-6). A slot for the same reason; absent, the card has none. */
  shareStep?: React.ReactNode;
  /** Why the plan cannot be sent yet; undefined = it can. */
  blockedReason: string | undefined;
  sending?: boolean;
  sent?: boolean;
  sendError?: string;
  onChooseTie: (playbookId: string) => void;
  onInPerson: (v: boolean) => void;
  onOffer: (key: string) => void;
  onFocus: (label: string | undefined) => void;
  onCeiling: (text: string) => void;
  onTarget: (text: string) => void;
  onZone: (tz: string) => void;
  onSaveZone: () => void;
  onSend: () => void;
  /** PL-3: the "What do you sell?" answers; absent in a view with no lines to ask about. */
  onToggleLine?: (lineId: string, on: boolean) => void;
  onLineOffer?: (lineId: string, offerKey: string) => void;
  onLineFocus?: (lineId: string, label: string | undefined) => void;
  onLineTarget?: (lineId: string, text: string) => void;
  onShare?: (lineId: string, text: string) => void;
  onCampaign?: (campaignId: string, lineId: string) => void;
}

export function FirstRunView(p: FirstRunViewProps) {
  const { draft } = p;
  if (!draft) {
    return (
      <>
        <PageHead title="Let's get you more of what matters" description="Three questions, then Peakhour drafts your first plan. Nothing spends until you confirm on WhatsApp." />
        {p.loadFailed ? (
          <Card>
            <CardContent role="alert" className="py-8 text-center text-sm">
              We couldn&apos;t draft your plan. Reload the page to try again.
            </CardContent>
          </Card>
        ) : (
          <Card aria-busy="true">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Drafting your plan from what we know about your business.</CardContent>
          </Card>
        )}
      </>
    );
  }
  if (draft.alreadyActive) {
    return (
      <>
        <PageHead title="Your plan is already running" description="Peakhour is running growth for this business." />
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">To change a goal, its target or its share of the ceiling, use Goals. A change is confirmed on WhatsApp, as your plan was.</p>
            <Button asChild>
              <Link href={`${GROWTH_HOME}/goals`}>Open Goals</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }
  if (draft.tie) {
    return (
      <>
        <PageHead title="One quick question" description="More than one playbook fits your business equally, so we would rather ask than guess." />
        <TieQuestion draft={draft} onChoose={p.onChooseTie} />
      </>
    );
  }

  const lines = chosenLines(draft, p.answers);
  const linesMode = (draft.lines ?? []).length > 0;
  const offer = linesMode ? (lines[0] ? lineOffer(lines[0], p.answers) : undefined) : selectedOffer(draft, p.answers);
  const unit = offer ? OUTCOME_UNIT[offer.kind] : undefined;
  const currency = draft.currency ?? "";
  const ceiling = parseAmount(p.answers.ceiling);
  const resolved = resolveTarget(offer, p.answers);
  const chips = ceilingChips(draft);
  const minimum = chips.find((c) => c.key === "starter")?.amount;
  const targetKind = offer ? targetKindOf(offer) : "cost_per_outcome";
  const shownTarget = p.typedTarget ?? (resolved ? String(resolved.target.value) : "");
  const hasStoreOffer = draft.offers.some((o) => o.kind === "store_visits");
  const splitWords = startingFromWords(draft.channels[0]?.startingFrom);
  const guessWords = startingFromWords(draft.startingFrom);

  return (
    <>
      <PageHead
        title={unit ? `Let's get you more ${unit.many}` : "Let's get you more of what matters"}
        description={`${linesMode ? "Four steps" : "Three questions"}, then Peakhour drafts your first plan from the ${draft.playbook?.title ?? "right"} playbook. Nothing spends until you confirm on WhatsApp.`}
      />

      {linesMode ? <LinesQuestions {...p} /> : (
      <Card>
        <CardContent className="grid gap-6">
          <fieldset className="grid gap-2.5">
            <legend className="font-mono text-micro uppercase tracking-[0.2em] text-muted-foreground">1 &middot; What do you want more of?</legend>
            {draft.offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing can be measured for this business yet. Connect your shop, your inbox or your analytics in{" "}
                <Link href="/dashboard/integrations" className="underline underline-offset-2">Connected accounts</Link>, then come back.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {draft.offers.map((o) => {
                  const Icon = ICON[o.kind];
                  return (
                    <button
                      key={offerKey(o)}
                      type="button"
                      aria-pressed={offer !== undefined && offerKey(offer) === offerKey(o)}
                      onClick={() => p.onOffer(offerKey(o))}
                      className="grid gap-1.5 rounded-xl border bg-card p-3.5 text-left transition-shadow aria-pressed:border-chart-1 aria-pressed:shadow-[0_0_0_2px_color-mix(in_oklch,var(--chart-1)_35%,transparent)]"
                    >
                      <Icon aria-hidden className="size-5" />
                      <b className="text-sm">{o.label}</b>
                      <span className="text-xs text-muted-foreground">{HINT[o.kind]}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {offer && offer.source === "orders" && offer.focusSuggestions.length > 0 ? <FocusPicker offer={offer} chosen={p.answers.focus} onFocus={p.onFocus} currency={currency} /> : null}
            {!hasStoreOffer ? (
              <div className="grid gap-1.5 rounded-lg border border-dashed p-3 text-sm">
                <span className="font-medium">Do customers visit you in person?</span>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={p.inPerson === true ? "default" : "outline"} aria-pressed={p.inPerson === true} onClick={() => p.onInPerson(true)}>
                    Yes
                  </Button>
                  <Button type="button" size="sm" variant={p.inPerson === false ? "default" : "outline"} aria-pressed={p.inPerson === false} onClick={() => p.onInPerson(false)}>
                    No
                  </Button>
                </div>
              </div>
            ) : null}
            {draft.askAboutStores && !hasStoreOffer ? (
              <p className="text-xs text-muted-foreground">
                Google counts store visits only for a verified Business Profile linked to your Google Ads account. Connect and verify yours in{" "}
                <Link href="/dashboard/integrations" className="underline underline-offset-2">Connected accounts</Link>, and store visits will appear here.
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-2">
            <label htmlFor="first-run-ceiling" className="font-mono text-micro uppercase tracking-[0.2em] text-muted-foreground">
              2 &middot; Your monthly ceiling
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm text-muted-foreground">{currency}</span>
              <Input
                id="first-run-ceiling"
                inputMode="numeric"
                className="w-40 tabular-nums"
                value={p.answers.ceiling}
                onChange={(e) => p.onCeiling(e.target.value)}
                aria-invalid={p.answers.ceiling !== "" && ceiling === undefined}
              />
              {chips.map((c) => (
                <Button key={c.key} type="button" size="sm" variant="outline" onClick={() => p.onCeiling(String(c.amount))}>
                  {c.label} {formatMoney(c.amount, currency)}
                </Button>
              ))}
            </div>
            {ceiling !== undefined ? <b className="text-2xl tabular-nums">{formatMoney(ceiling, currency)}</b> : null}
            <p className="text-xs text-muted-foreground">Peakhour can never spend more than this in a month.</p>
            {ceiling !== undefined && minimum !== undefined && ceiling < minimum ? (
              <p role="status" className="text-xs text-warning-on-tint">
                This is under the {draft.playbook?.title} playbook&apos;s usual minimum of {formatMoney(minimum, currency)}. It can still run, with fewer channels and slower learning.
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor="first-run-target" className="font-mono text-micro uppercase tracking-[0.2em] text-muted-foreground">
              3 &middot; {targetQuestion(targetKind, unit?.one ?? "outcome")}
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              {targetKind === "cost_per_outcome" ? <span className="text-sm text-muted-foreground">{currency}</span> : null}
              <Input id="first-run-target" inputMode="decimal" className="w-32 tabular-nums" value={shownTarget} onChange={(e) => p.onTarget(e.target.value)} />
              {targetKind === "roas" ? <span className="text-sm text-muted-foreground">x return</span> : null}
              {resolved?.source === "playbook" ? <ToneBadge tone="ai">{startingFromWords(offer?.startingFrom) ?? `Filled in by the ${draft.playbook?.title} playbook`}</ToneBadge> : null}
              <span className="text-xs text-muted-foreground">Change it any time.</span>
            </div>
            {targetKind === "cost_per_outcome" ? <p className="text-xs text-muted-foreground">{TARGET_NOT_A_FEE}</p> : null}
          </div>
        </CardContent>
      </Card>
      )}

      {"absent" in draft.timeZone ? (
        <Card>
          <CardHeader>
            <CardTitle>Your time zone</CardTitle>
            <CardDescription>{draft.timeZone.absent} Your ceiling is counted by the month on this clock, and your decisions go out at 10:00 on it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="first-run-zone" className="sr-only">
              Time zone
            </label>
            <Input id="first-run-zone" className="w-60" placeholder="Asia/Kolkata" value={p.zone} onChange={(e) => p.onZone(e.target.value)} />
            <Button type="button" onClick={p.onSaveZone} disabled={p.zoneSaving || p.zone.trim() === ""}>
              Save time zone
            </Button>
            {p.zoneError ? (
              <span role="alert" className="text-xs text-destructive-on-tint">
                {p.zoneError}
              </span>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {p.signalStep}

      {asksForCampaigns(draft, p.answers) ? <CampaignsStep {...p} /> : null}

      <Card id="first-run-plan">
        <CardHeader>
          <CardTitle>Your first plan</CardTitle>
          <CardDescription>
            {splitWords ? `${splitWords}. ` : `Drafted from the ${draft.playbook?.title} playbook. `}
            {draft.channels[0]?.startingFrom?.layer === "own" ? "" : "Your own data takes over from about week 4."}
          </CardDescription>
          {guessWords ? <p className="pt-1 text-xs text-muted-foreground">{guessWords}</p> : null}
        </CardHeader>
        <CardContent className="divide-y">
          {draft.channels.length === 0 ? <p className="py-3 text-sm text-muted-foreground">The playbook has no channel to start with for this business.</p> : null}
          {draft.channels.map((c) => (
            <div key={c.platform} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <div className="min-w-0">
                <b className="inline-flex items-center gap-2 text-sm font-medium">
                  <i aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: PLATFORM_COLOR[c.platform] }} />
                  {PLATFORM_LABEL[c.platform]} &middot; {Math.round(c.monthlyShare * 100)}%
                </b>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABEL[c.role]}. {c.reason}
                </p>
                {!c.connected ? <p className="text-xs text-warning-on-tint">Not connected yet. Connect it in Connected accounts to start here.</p> : null}
              </div>
              {ceiling !== undefined ? <b className="text-sm tabular-nums">{formatMoney(Math.round(ceiling * c.monthlyShare), currency)}</b> : <ToneBadge>{ROLE_LABEL[c.role]}</ToneBadge>}
            </div>
          ))}
          {draft.excludedByGuardrails.length > 0 ? (
            <p className="py-3 text-xs text-muted-foreground">Left out because you turned them off in Rules: {draft.excludedByGuardrails.map((x) => PLATFORM_LABEL[x]).join(", ")}.</p>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
            <div>
              <b className="text-sm font-medium">Measuring lift</b>
              <p className="text-xs text-muted-foreground">Part of your areas is held back, so we can show you what the ads actually caused.</p>
            </div>
            <ToneBadge tone="good">On</ToneBadge>
          </div>
          {p.shareStep}
        </CardContent>
        {p.sent ? (
          <div role="status" className="mx-6 mb-4 grid gap-1 rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
            <b>Check WhatsApp</b>
            <p>We sent you a message with a link. Open it, enter the six-digit code we text you, and the plan starts. The link works for 24 hours. Until then nothing spends.</p>
          </div>
        ) : null}
        {p.sendError ? (
          <p role="alert" className="px-6 pb-2 text-right text-sm text-destructive-on-tint">
            {p.sendError}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 pt-4">
          {p.blockedReason ? <span className="text-xs text-muted-foreground">{p.blockedReason}</span> : null}
          <Button type="button" onClick={p.onSend} disabled={p.blockedReason !== undefined || p.sending}>
            {p.sent ? "Send the link again" : "Send to WhatsApp to confirm"}
          </Button>
        </div>
      </Card>
    </>
  );
}

function TieQuestion({ draft, onChoose }: { draft: FirstRunDraftResponse; onChoose: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Which best describes you?</CardTitle>
        <CardDescription>Your answer decides which playbook starts you off. You can change it later.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        {draft.tie?.candidates.map((c) => (
          <button
            key={c.playbookId}
            type="button"
            onClick={() => onChoose(c.playbookId)}
            className="rounded-xl border bg-card p-3.5 text-left text-sm font-medium transition-shadow hover:border-chart-1"
          >
            {c.title}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function FocusPicker({ offer, chosen, onFocus, currency, id = "first-run-focus" }: { offer: DraftOffer; chosen: string | undefined; onFocus: (label: string | undefined) => void; currency: string; id?: string }) {
  const days = offer.focusWindowDays ?? 90;
  return (
    <div className="grid gap-1.5 rounded-lg border p-3 text-sm">
      <label htmlFor={id} className="font-medium">
        Focus on one part of what you sell? <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <select
        id={id}
        className="h-9 rounded-md border bg-background px-2 text-sm"
        value={chosen ?? ""}
        onChange={(e) => onFocus(e.target.value === "" ? undefined : e.target.value)}
      >
        <option value="">Everything</option>
        {offer.focusSuggestions.map((f) => (
          <option key={`${f.by}:${f.label}`} value={f.label}>
            {f.label} ({formatMoney(f.revenue, currency)} in the last {days} days)
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">Peakhour counts, bids on and reports only this part. Everything else is still shown, but never counted toward your goal.</p>
    </div>
  );
}

const LEGEND = "font-mono text-micro uppercase tracking-[0.2em] text-muted-foreground";

/**
 * PL-3: "What do you sell?", then one goal per ticked line, the ceiling with its suggested split, then each goal's target. The
 * steps are fixed; the lines and their pre-ticks are the api's (`draft.lines`), computed for this business.
 */
function LinesQuestions(p: FirstRunViewProps) {
  const draft = p.draft!;
  const currency = draft.currency ?? "";
  const lines = chosenLines(draft, p.answers);
  const shares = lineShares(draft, p.answers);
  const ceiling = parseAmount(p.answers.ceiling);
  const chips = ceilingChips(draft);
  const sum = lines.reduce((t, l) => t + (shares[l.id] ?? 0), 0);
  const typedAny = p.answers.shares !== undefined;
  const hasStoreOffer = (draft.lines ?? []).some((l) => l.offers.some((o) => o.kind === "store_visits"));
  return (
    <Card>
      <CardContent className="grid gap-6">
        <fieldset className="grid gap-2.5">
          <legend className={LEGEND}>1 &middot; What do you sell?</legend>
          <p className="text-xs text-muted-foreground">We ticked what your catalog and profile point to. Tick everything you want more of; each becomes a goal.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(draft.lines ?? []).map((l) => {
              const on = lines.some((x) => x.id === l.id);
              return (
                <label key={l.id} className="flex cursor-pointer items-start gap-2.5 rounded-xl border bg-card p-3 has-[:checked]:border-chart-1">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[var(--chart-1)]" checked={on} onChange={(e) => p.onToggleLine?.(l.id, e.target.checked)} />
                  <span className="grid gap-0.5">
                    <b className="text-sm">{l.label}</b>
                    <span className="text-xs text-muted-foreground">{l.why}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className={LEGEND}>2 &middot; {lines.length === 1 ? "Your goal" : "One goal for each"}</legend>
          {lines.length === 0 ? <p className="text-sm text-muted-foreground">Tick at least one thing you sell.</p> : null}
          {lines.map((l) => (
            <LineGoal key={l.id} line={l} p={p} currency={currency} />
          ))}
          {!hasStoreOffer ? (
            <div className="grid gap-1.5 rounded-lg border border-dashed p-3 text-sm">
              <span className="font-medium">Do customers visit you in person?</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={p.inPerson === true ? "default" : "outline"} aria-pressed={p.inPerson === true} onClick={() => p.onInPerson(true)}>
                  Yes
                </Button>
                <Button type="button" size="sm" variant={p.inPerson === false ? "default" : "outline"} aria-pressed={p.inPerson === false} onClick={() => p.onInPerson(false)}>
                  No
                </Button>
              </div>
            </div>
          ) : null}
        </fieldset>

        <div className="grid gap-2">
          <label htmlFor="first-run-ceiling" className={LEGEND}>
            3 &middot; Your monthly ceiling{lines.length > 1 ? ", split between your goals" : ""}
          </label>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm text-muted-foreground">{currency}</span>
            <Input
              id="first-run-ceiling"
              inputMode="numeric"
              className="w-40 tabular-nums"
              value={p.answers.ceiling}
              onChange={(e) => p.onCeiling(e.target.value)}
              aria-invalid={p.answers.ceiling !== "" && ceiling === undefined}
            />
            {chips.map((c) => (
              <Button key={c.key} type="button" size="sm" variant="outline" onClick={() => p.onCeiling(String(c.amount))}>
                {c.label} {formatMoney(c.amount, currency)}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Peakhour can never spend more than this in a month.</p>
          {lines.length > 1 ? (
            <div className="grid gap-2 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                {typedAny ? "Your split." : lines.every((l) => l.minMonthlyBudget) ? "Suggested in proportion to what each usually needs at least." : "Suggested evenly."} Change any share; they must add up to 100%.
              </p>
              {lines.map((l) => (
                <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-sm">
                  <label htmlFor={`first-run-share-${l.id}`}>{l.label}</label>
                  <span className="flex items-center gap-1">
                    <Input
                      id={`first-run-share-${l.id}`}
                      inputMode="decimal"
                      className="w-20 tabular-nums"
                      value={p.answers.shares?.[l.id] ?? String(shares[l.id] ?? "")}
                      onChange={(e) => p.onShare?.(l.id, e.target.value)}
                      aria-invalid={shares[l.id] === undefined}
                    />
                    %
                  </span>
                  <b className="w-28 text-right tabular-nums">{ceiling !== undefined && shares[l.id] !== undefined ? formatMoney(Math.round((ceiling * shares[l.id]!) / 100), currency) : ""}</b>
                </div>
              ))}
              {Math.abs(sum - 100) > 0.1 ? (
                <p role="status" className="text-xs text-warning-on-tint">
                  The shares add up to {Math.round(sum * 10) / 10}%.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <fieldset className="grid gap-3">
          <legend className={LEGEND}>4 &middot; {lines.length > 1 ? "Each goal's target" : "Your target"}</legend>
          {lines.map((l) => (
            <LineTargetBox key={l.id} line={l} p={p} currency={currency} />
          ))}
          <p className="text-xs text-muted-foreground">{TARGET_NOT_A_FEE}</p>
        </fieldset>
      </CardContent>
    </Card>
  );
}

function LineGoal({ line, p, currency }: { line: DraftLine; p: FirstRunViewProps; currency: string }) {
  const offer = lineOffer(line, p.answers);
  const chosenFocus = p.answers.goals?.[line.id]?.focus;
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <b className="text-sm">{line.label}</b>
      {line.offers.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing can be measured for {line.label} yet. Untick it, or connect your shop, your inbox or your analytics.</p>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`What ${line.label} should get you more of`}>
          {line.offers.map((o) => {
            const Icon = ICON[o.kind];
            return (
              <Button
                key={offerKey(o)}
                type="button"
                size="sm"
                variant={offer && offerKey(offer) === offerKey(o) ? "default" : "outline"}
                aria-pressed={offer !== undefined && offerKey(offer) === offerKey(o)}
                onClick={() => p.onLineOffer?.(line.id, offerKey(o))}
              >
                <Icon aria-hidden className="size-4" />
                {o.label}
              </Button>
            );
          })}
        </div>
      )}
      {offer && offer.source === "orders" && offer.focusSuggestions.length > 0 ? (
        <FocusPicker offer={offer} chosen={chosenFocus} onFocus={(label) => p.onLineFocus?.(line.id, label)} currency={currency} id={`first-run-focus-${line.id}`} />
      ) : null}
    </div>
  );
}

function LineTargetBox({ line, p, currency }: { line: DraftLine; p: FirstRunViewProps; currency: string }) {
  const offer = lineOffer(line, p.answers);
  if (!offer) return null;
  const kind = targetKindOf(offer);
  const resolved = lineTarget(line, p.answers);
  const typed = p.answers.goals?.[line.id]?.target;
  const id = `first-run-target-${line.id}`;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {line.label}: {targetQuestion(kind, OUTCOME_UNIT[offer.kind].one)}
      </label>
      <div className="flex flex-wrap items-center gap-2.5">
        {kind === "cost_per_outcome" ? <span className="text-sm text-muted-foreground">{currency}</span> : null}
        <Input id={id} inputMode="decimal" className="w-32 tabular-nums" value={typed ?? (resolved ? String(resolved.target.value) : "")} onChange={(e) => p.onLineTarget?.(line.id, e.target.value)} />
        {kind === "roas" ? <span className="text-sm text-muted-foreground">x return</span> : null}
        {resolved?.source === "playbook" ? <ToneBadge tone="ai">{startingFromWords(offer.startingFrom) ?? `Filled in by the ${p.draft?.playbook?.title} playbook`}</ToneBadge> : null}
      </div>
    </div>
  );
}

/** PL-3: the last step of a plan of several goals: which goal each campaign serves. A suggestion is pre-selected, never sent unseen. */
function CampaignsStep(p: FirstRunViewProps) {
  const draft = p.draft!;
  const lines = chosenLines(draft, p.answers);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Which goal does each campaign serve?</CardTitle>
        <CardDescription>Peakhour moves a campaign&apos;s budget only inside its goal. A campaign with no goal is left exactly as it is. You can change this later on Goals.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {(draft.campaigns ?? []).map((c) => {
          const value = campaignLine(draft, p.answers, c.campaignId);
          const id = `first-run-campaign-${c.campaignId}`;
          return (
            <div key={c.campaignId} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-center">
              <div className="min-w-0">
                <label htmlFor={id} className="block truncate text-sm font-medium">
                  {c.name}
                </label>
                <p className="text-xs text-muted-foreground">
                  {PLATFORM_LABEL[c.platform] ?? c.platform}
                  {c.status === "paused" ? " · Paused" : ""}
                  {c.suggestedLineId && value === c.suggestedLineId && p.answers.campaigns?.[c.campaignId] === undefined ? ` · Suggested: ${c.why}` : ""}
                </p>
              </div>
              <select id={id} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => p.onCampaign?.(c.campaignId, e.target.value)}>
                <option value="">No goal</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
