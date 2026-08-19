"use client";

import { useEffect, useRef, useState } from "react";
import { formatPeaks } from "@/lib/pricing";

/**
 * The hero's proof: Peakhour's five modules working, on a timer.
 *
 * This is the asset the landing page never had. A page that describes software
 * asks to be believed; a page that shows it running does not — and it is the
 * one thing every competitor in this category ships and peakhour.ai did not.
 *
 * ── ★IT IS A DRAMATISATION, AND IT MUST STAY AN HONEST ONE ────────────────
 *
 * Nothing here is live data. Every line below is a thing the shipped product
 * genuinely does — Commerce answers catalogue questions on WhatsApp, Content
 * schedules, Growth pauses ad sets, Support routes, Presence fixes listings —
 * written the way it actually reports. Do not add a line for a capability that
 * does not exist, and do not let this drift into implying it is one tenant's
 * real account. If it ever shows real numbers, it needs a real source.
 *
 * The example business is fictional and the phone number is masked, for the
 * same reason.
 */

interface LogLine {
  time: string;
  module: string;
  colour: string;
  text: string;
}

const LOG: LogLine[] = [
  {
    time: "20:14",
    module: "Commerce",
    colour: "#C9820C",
    text: "“is the blue kurta in M?” → in stock, checkout link sent",
  },
  {
    time: "20:15",
    module: "Support",
    colour: "#4A8FE0",
    text: "WhatsApp refund query → assigned, SLA 12m",
  },
  {
    time: "20:17",
    module: "Content",
    colour: "#8E76E8",
    text: "drafted “Diwali gifting guide” from 3 trusted sources",
  },
  {
    time: "20:19",
    module: "Growth",
    colour: "#109C87",
    text: "paused ad set Prospecting-04 · CPA up 38%",
  },
  {
    time: "20:21",
    module: "Presence",
    colour: "#E05A93",
    text: "Google listing hours corrected for the holiday",
  },
  {
    time: "20:23",
    module: "Commerce",
    colour: "#C9820C",
    text: "reserved the last size L for +91 98••••41 · 15 min hold",
  },
  {
    time: "20:26",
    module: "Content",
    colour: "#8E76E8",
    text: "queued for Tuesday 08:00 — awaiting your approval",
  },
  {
    time: "20:28",
    module: "Support",
    colour: "#4A8FE0",
    text: "Instagram DM → order status answered from the catalogue",
  },
];

const VISIBLE = 5;
const TICK_MS = 2600;
const PEAKS_CAP = 5000;

export function HeroConsole() {
  // Start part-filled so the first paint is a console mid-shift rather than an
  // empty box that fills up — the point is "this has been running", not "watch
  // it start".
  const [cursor, setCursor] = useState(VISIBLE);
  const [peaks, setPeaks] = useState(880);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Respect the preference rather than merely slowing down: a log that
    // rewrites itself every few seconds is exactly the motion someone with
    // vestibular sensitivity turned this off to avoid. They get the same five
    // lines, still.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    timer.current = setInterval(() => {
      setCursor((c) => c + 1);
      setPeaks((p) => Math.min(PEAKS_CAP, p + 120 + Math.round(Math.random() * 160)));
    }, TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const lines = Array.from({ length: VISIBLE }, (_, i) => {
    const index = (cursor - VISIBLE + i + LOG.length * 8) % LOG.length;
    return { ...LOG[index], key: `${cursor - VISIBLE + i}` };
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink/80 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 border-b border-ink-line bg-white/[0.03] px-4 py-2.5">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-on-ink-dim">
          Your business, tonight
        </span>
        <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-success">
          <span className="relative flex size-1.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
          running
        </span>
      </div>

      <ul className="flex flex-col justify-end gap-0.5 p-2" style={{ minHeight: "13.5rem" }}>
        {lines.map((line) => (
          <li
            key={line.key}
            className="grid grid-cols-[2.9rem_1fr] items-baseline gap-2 rounded-lg px-2 py-1.5 text-[0.72rem] leading-snug motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
            style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
          >
            <time className="text-[0.62rem] text-on-ink-dim">{line.time}</time>
            <span className="min-w-0 text-on-ink">
              <b className="font-medium" style={{ color: line.colour }}>
                {line.module}
              </b>
              <span className="text-on-ink-dim"> · </span>
              {line.text}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-ink-line px-4 pb-3.5 pt-3">
        <div className="flex items-baseline justify-between text-[0.65rem] uppercase tracking-[0.1em] text-on-ink-dim">
          <span>Peaks used today</span>
          <span
            className="text-sm tracking-normal text-on-ink"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            {formatPeaks(peaks)} / {formatPeaks(PEAKS_CAP)}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-brand-gradient transition-[width] duration-1000 ease-out"
            style={{ width: `${(peaks / PEAKS_CAP) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
