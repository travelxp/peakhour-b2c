"use client";

import { useState } from "react";
import { Building2, MapPin, MessageSquare, Phone, ShoppingCart, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { firstRunPlanPreview, type OutcomeKind } from "@/lib/api/growth-v2";
import { OUTCOME_UNIT, PLATFORM_COLOR, PLATFORM_LABEL, figureValue, formatMoney } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";
import { PageHead } from "./page-head";
import { PreviewBanner } from "./preview-banner";
import { ToneBadge } from "./tone";

/**
 * First run: three questions, then a drafted plan (plan 1, H5).
 *
 * ★THE OPTIONS BELOW ARE THE FIVE KINDS, NOT WHAT THIS BUSINESS IS OFFERED. Which
 * kinds appear is `offerableOutcomes(business)` (C6b): a business with no store
 * never sees store visits. That call has no route yet, so the preview lists all
 * five. Nothing here is sent: confirming is H5, and until it lands the buttons
 * are off.
 */
const OPTIONS: Array<{ kind: OutcomeKind; title: string; hint: string; icon: LucideIcon }> = [
  { kind: "bookings", title: "Bookings", hint: "Paid bookings", icon: Building2 },
  { kind: "leads", title: "Leads", hint: "Enquiries and forms", icon: MessageSquare },
  { kind: "sales", title: "Online sales", hint: "Shop orders", icon: ShoppingCart },
  { kind: "calls", title: "Calls", hint: "Phone and WhatsApp", icon: Phone },
  { kind: "store_visits", title: "Store visits", hint: "Walk-ins", icon: MapPin },
];

const ROLE_LABEL = { lead: "Lead channel", test: "Test", not_now: "Not now" } as const;

export function FirstRunScreen() {
  const { data: plan } = firstRunPlanPreview();
  const m = plan.mandate;
  const [kind, setKind] = useState<OutcomeKind>(m.outcome.kind);
  const unit = OUTCOME_UNIT[kind];
  // A slider grid built from the starting ceiling; a zero or odd ceiling falls back to a sane one, and the start is snapped onto the grid.
  const base = m.monthlyCeiling > 0 ? m.monthlyCeiling : 10_000;
  const step = 10 ** Math.max(Math.floor(Math.log10(base)) - 1, 0);
  const min = step * 5;
  const max = Math.ceil((base * 5) / step) * step;
  const snap = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const [ceiling, setCeiling] = useState(() => snap(m.monthlyCeiling));
  const targetText = m.target.kind === "roas" ? `${m.target.value.toFixed(1)}x return` : formatMoney(m.target.value, m.currency);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PreviewBanner row="H5" />
      <PageHead
        title={`Let's get you more ${unit.many}`}
        description={`Three questions, then the engine drafts your first plan from the ${m.playbook.id} playbook. Nothing spends until you confirm on WhatsApp.`}
      />

      <Card>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-4 gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn("h-1.5 rounded-full", i < 3 ? "bg-chart-1" : "bg-muted")} />
            ))}
          </div>

          <fieldset className="grid gap-2.5">
            <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">1 &middot; What do you want more of?</legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
              {OPTIONS.map((o) => (
                <button
                  key={o.kind}
                  type="button"
                  aria-pressed={kind === o.kind}
                  onClick={() => setKind(o.kind)}
                  className="grid gap-1.5 rounded-xl border bg-card p-3.5 text-left transition-shadow aria-pressed:border-chart-1 aria-pressed:shadow-[0_0_0_2px_color-mix(in_oklch,var(--chart-1)_35%,transparent)]"
                >
                  <o.icon aria-hidden className="size-5" />
                  <b className="text-sm">{o.title}</b>
                  <span className="text-xs text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-2">
            <label htmlFor="first-run-ceiling" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              2 &middot; Your monthly ceiling
            </label>
            <b className="text-2xl tabular-nums">{formatMoney(ceiling, m.currency)}</b>
            <input
              id="first-run-ceiling"
              type="range"
              min={min}
              max={max}
              step={step}
              value={ceiling}
              onChange={(e) => setCeiling(Number(e.target.value))}
              className="w-full accent-[var(--chart-1)]"
              aria-valuetext={formatMoney(ceiling, m.currency)}
            />
            <p className="text-xs text-muted-foreground">The engine can never spend more than this in a month.</p>
          </div>

          <div className="grid gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">3 &middot; What can you pay for one {unit.one}?</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <b className="text-2xl tabular-nums">{targetText}</b>
              {m.targetSource === "playbook" ? <ToneBadge tone="ai">Filled in by the {m.playbook.id} playbook</ToneBadge> : null}
              <span className="text-xs text-muted-foreground">Change it any time.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your first plan</CardTitle>
          <CardDescription>
            Drafted by the Growth Council from the {m.playbook.id} playbook. Your own data takes over from about week 4.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {plan.channels.map((c) => {
            const share = figureValue(c.monthlyShare);
            return (
              <div key={c.platform} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                <div className="min-w-0">
                  <b className="inline-flex items-center gap-2 text-sm font-medium">
                    <i aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: PLATFORM_COLOR[c.platform] }} />
                    {PLATFORM_LABEL[c.platform]}
                    {share !== undefined ? ` · ${Math.round(share * 100)}%` : ""}
                  </b>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
                {share !== undefined ? (
                  <b className="text-sm tabular-nums">{formatMoney(Math.round(ceiling * share), m.currency)}</b>
                ) : (
                  <ToneBadge>{ROLE_LABEL[c.role]}</ToneBadge>
                )}
              </div>
            );
          })}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
            <div>
              <b className="text-sm font-medium">Measuring lift</b>
              <p className="text-xs text-muted-foreground">Part of your areas is held back, so we can show you what the ads actually caused.</p>
            </div>
            <ToneBadge tone="good">On</ToneBadge>
          </div>
        </CardContent>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 pt-4">
          <Button variant="outline" disabled>
            Edit plan
          </Button>
          <Button disabled title="Confirming the plan arrives with the Rules release">
            Send to WhatsApp to confirm
          </Button>
        </div>
        <p className="px-6 text-right text-xs text-muted-foreground">
          This is a sample plan. Nothing is sent from here yet.
        </p>
      </Card>
    </div>
  );
}
