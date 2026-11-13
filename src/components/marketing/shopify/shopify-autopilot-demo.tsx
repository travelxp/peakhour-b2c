"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "You stay in charge", as something to try: Autopilot switches, an activity
 * feed item with Undo, and the emergency stop. Nothing here talks to a store;
 * it is a picture of the app's own controls that a visitor can press.
 */
const TASKS = [
  { id: "markdowns", title: "Markdowns on slow stock", sub: "Lowers prices within your limit", on: true },
  { id: "cod", title: "COD confirmation on WhatsApp", sub: "Holds the parcel until the shopper replies", on: true },
  { id: "titles", title: "Fix product titles", sub: "Rewrites weak titles in your voice", on: false },
] as const;

export function ShopifyAutopilotDemo() {
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(TASKS.map((t) => [t.id, t.on])));
  const [stopped, setStopped] = useState(false);
  const [undone, setUndone] = useState(false);
  const count = Object.values(on).filter(Boolean).length;

  return (
    <div
      role="group"
      aria-label="Try it: Autopilot"
      className="rounded-3xl border bg-card p-5 shadow-[var(--daylight-shadow)] sm:p-6"
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-extrabold tracking-tight">Autopilot</span>
        <span
          aria-live="polite"
          className={cn(
            "rounded-full px-2.5 py-0.5 text-micro font-bold",
            stopped ? "bg-[var(--daylight-bad-soft)] text-[var(--daylight-bad-ink)]" : count ? "bg-[var(--daylight-ok-soft)] text-[var(--daylight-ok-ink)]" : "bg-muted text-foreground",
          )}
        >
          {stopped ? "Paused" : `${count} ${count === 1 ? "task" : "tasks"} on`}
        </span>
      </div>

      <ul className="mt-2">
        {TASKS.map((t) => (
          <li key={t.id} className="flex items-center gap-3 border-t py-3 first:border-t-0">
            <span className="min-w-0 flex-1">
              <b className="block text-[15px]">{t.title}</b>
              <span className="text-xs text-muted-foreground">{t.sub}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={on[t.id]}
              aria-label={t.title}
              disabled={stopped}
              onClick={() => setOn((s) => ({ ...s, [t.id]: !s[t.id] }))}
              className={cn(
                "relative h-[26px] w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-45",
                on[t.id] ? "bg-[var(--daylight-ok)]" : "bg-muted shadow-[inset_0_0_0_1.5px_var(--border)]",
              )}
            >
              <span
                className={cn(
                  "absolute left-[3px] top-[3px] size-5 rounded-full bg-white shadow transition-transform",
                  on[t.id] && "translate-x-[18px]",
                )}
              />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-col gap-1.5 rounded-2xl bg-muted px-3.5 py-3 text-[13px]">
        <span className="flex justify-between gap-3">
          <span className={cn(undone && "line-through opacity-50")}>Linen dupatta marked down to ₹1,099</span>
          <button
            type="button"
            disabled={undone}
            onClick={() => setUndone(true)}
            className="shrink-0 font-extrabold text-brand-strong disabled:cursor-default disabled:text-muted-foreground"
          >
            {undone ? "Undone" : "Undo"}
          </button>
        </span>
        <span className="flex justify-between gap-3">
          <span>COD order #1042 confirmed, parcel released</span>
          <span className="shrink-0 text-xs text-muted-foreground">2 min ago</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => setStopped((s) => !s)}
        className={cn(
          "mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          stopped ? "bg-muted text-foreground" : "bg-[var(--daylight-bad)] text-white hover:bg-[var(--daylight-bad-hover)]",
        )}
      >
        <ShieldCheck className="size-4" aria-hidden />
        {stopped ? "Paused. Switch back on" : "Emergency stop"}
      </button>
    </div>
  );
}
