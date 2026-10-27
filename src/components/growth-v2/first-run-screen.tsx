"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, MapPin, MessageSquare, Phone, ShoppingCart, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useConfirmPlan, useFirstRunDraft, usePatchRules, type DraftOffer, type FirstRunDraftResponse, type OutcomeKind } from "@/lib/api/growth-v2";
import { useSignalReadiness } from "@/lib/api/growth-v2-signal";
import { canContinue } from "@/lib/growth-v2-signal";
import { OUTCOME_UNIT, PLATFORM_COLOR, PLATFORM_LABEL, formatMoney } from "@/lib/growth-v2-figure";
import {
  buildPlanBody,
  ceilingChips,
  offerKey,
  parseAmount,
  planBlockedReason,
  resolveTarget,
  selectedFocus,
  selectedOffer,
  sendErrorMessage,
  targetKindOf,
  type FirstRunAnswers,
} from "@/lib/growth-v2-firstrun";
import { GROWTH_HOME } from "@/lib/growth-v2-nav";
import { patchErrorMessage } from "@/lib/growth-v2-rules";
import { PageHead } from "./page-head";
import { SignalStep } from "./signal-step";
import { ToneBadge } from "./tone";

/**
 * First run: three questions, then a drafted plan, then one WhatsApp confirmation (plan 1 and 2.10, row H5).
 *
 * ★THE OPTIONS ARE THE API'S OFFERS, NOT A FIXED LIST. `onboarding/draft` builds them from this business's own evidence
 * (`offerableOutcomes`): store visits appear only when Google would count them, calls only with call conversions, and sales
 * and bookings show the categories the shop really sold. A business that is offered nothing is told so, not shown a menu.
 * ★A TIE IS ASKED BEFORE ANYTHING ELSE: when two playbooks fit equally the draft carries the candidates and no plan.
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
  };
  const body = draft ? buildPlanBody(draft, answers) : undefined;
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
    <div className="mx-auto grid w-full max-w-3xl gap-4">
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
            optimizeFor={(draft && selectedOffer(draft, answers)?.optimizeFor) ?? "count"}
            focusLabel={draft ? selectedFocus(selectedOffer(draft, answers), answers)?.label : undefined}
            onContinue={() => document.getElementById("first-run-plan")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
        }
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
        onZone={setZone}
        onSaveZone={() => {
          const tz = (zone ?? suggestedZone).trim();
          if (tz) saveZone.mutate({ guardrails: { timeZone: tz } });
        }}
        onSend={() => body && confirm.mutate(body)}
      />
    </div>
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
}

export function FirstRunView(p: FirstRunViewProps) {
  const { draft } = p;
  if (!draft) {
    return (
      <>
        <PageHead title="Let's get you more of what matters" description="Three questions, then the engine drafts your first plan. Nothing spends until you confirm on WhatsApp." />
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
        <PageHead title="Your plan is already running" description="The growth engine is on for this business." />
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">To change your ceiling, your target or what you want more of, use Rules. A change is confirmed on WhatsApp, as your plan was.</p>
            <Button asChild>
              <Link href={`${GROWTH_HOME}/rules`}>Open Rules</Link>
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

  const offer = selectedOffer(draft, p.answers);
  const unit = offer ? OUTCOME_UNIT[offer.kind] : undefined;
  const currency = draft.currency ?? "";
  const ceiling = parseAmount(p.answers.ceiling);
  const resolved = resolveTarget(offer, p.answers);
  const chips = ceilingChips(draft);
  const minimum = chips.find((c) => c.key === "starter")?.amount;
  const targetKind = offer ? targetKindOf(offer) : "cost_per_outcome";
  const shownTarget = p.typedTarget ?? (resolved ? String(resolved.target.value) : "");
  const hasStoreOffer = draft.offers.some((o) => o.kind === "store_visits");

  return (
    <>
      <PageHead
        title={unit ? `Let's get you more ${unit.many}` : "Let's get you more of what matters"}
        description={`Three questions, then the engine drafts your first plan from the ${draft.playbook?.title ?? "right"} playbook. Nothing spends until you confirm on WhatsApp.`}
      />

      <Card>
        <CardContent className="grid gap-6">
          <fieldset className="grid gap-2.5">
            <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">1 &middot; What do you want more of?</legend>
            {draft.offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing can be measured for this business yet. Connect your shop, your inbox or your analytics in{" "}
                <Link href="/dashboard/integrations" className="underline underline-offset-2">Integrations</Link>, then come back.
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
                <Link href="/dashboard/integrations" className="underline underline-offset-2">Integrations</Link>, and store visits will appear here.
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-2">
            <label htmlFor="first-run-ceiling" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">The engine can never spend more than this in a month.</p>
            {ceiling !== undefined && minimum !== undefined && ceiling < minimum ? (
              <p role="status" className="text-xs text-warning-on-tint">
                This is under the {draft.playbook?.title} playbook&apos;s usual minimum of {formatMoney(minimum, currency)}. It can still run, with fewer channels and slower learning.
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor="first-run-target" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              3 &middot; {targetKind === "roas" ? "What return do you need on your ad spend?" : `What can you pay for one ${unit?.one ?? "outcome"}?`}
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              {targetKind === "cost_per_outcome" ? <span className="text-sm text-muted-foreground">{currency}</span> : null}
              <Input id="first-run-target" inputMode="decimal" className="w-32 tabular-nums" value={shownTarget} onChange={(e) => p.onTarget(e.target.value)} />
              {targetKind === "roas" ? <span className="text-sm text-muted-foreground">x return</span> : null}
              {resolved?.source === "playbook" ? <ToneBadge tone="ai">Filled in by the {draft.playbook?.title} playbook</ToneBadge> : null}
              <span className="text-xs text-muted-foreground">Change it any time.</span>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <Card id="first-run-plan">
        <CardHeader>
          <CardTitle>Your first plan</CardTitle>
          <CardDescription>Drafted from the {draft.playbook?.title} playbook. Your own data takes over from about week 4.</CardDescription>
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
                {!c.connected ? <p className="text-xs text-warning-on-tint">Not connected yet. Connect it in Integrations to start here.</p> : null}
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

function FocusPicker({ offer, chosen, onFocus, currency }: { offer: DraftOffer; chosen: string | undefined; onFocus: (label: string | undefined) => void; currency: string }) {
  const days = offer.focusWindowDays ?? 90;
  return (
    <div className="grid gap-1.5 rounded-lg border p-3 text-sm">
      <label htmlFor="first-run-focus" className="font-medium">
        Focus on one part of what you sell? <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <select
        id="first-run-focus"
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
      <p className="text-xs text-muted-foreground">The engine counts, bids on and reports only this part. Everything else is still shown, but never counted toward your goal.</p>
    </div>
  );
}
