"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Tag } from "lucide-react";
import { ProductTile, SampleTag } from "./shopify-art";
import { cn } from "@/lib/utils";

/**
 * The /shopify hero: one shopper moment on a sample store, played as a loop.
 * A shopper asks, the storefront assistant answers from stock and the
 * shipping policy, the cart fills, WhatsApp confirms the COD order, and a
 * markdown lands in the activity feed with an Undo.
 *
 * The server renders the FINAL frame, so the first paint, a link preview and a
 * no-JS visitor all see the whole story. The loop starts after a pause, never
 * under prefers-reduced-motion, and the visitor can stop it.
 */
const LAST = 8;
const TIMES = [400, 1500, 2900, 4500, 5300, 6500, 7900, 9100]; // ms for steps 1..8
const LOOP_MS = 13500;
const FIRST_DELAY_MS = 2500;

const RAIL = [
  { art: "scarf", tint: "rose", why: "bought with this kurta" },
  { art: "bag", tint: "marigold", why: "popular in Pune now" },
  { art: "bottle", tint: "leaf", why: "back in stock" },
] as const;

export function ShopifyHeroDemo() {
  const [step, setStep] = useState(LAST);
  const [playing, setPlaying] = useState(false);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => setPlaying(true), FIRST_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const run = () => {
      clear();
      setStep(0);
      TIMES.forEach((ms, i) => timers.current.push(window.setTimeout(() => setStep(i + 1), ms)));
      timers.current.push(window.setTimeout(run, LOOP_MS));
    };
    run();
    return clear;
  }, [playing]);

  const toggle = () => {
    if (playing) {
      clear();
      setPlaying(false);
      setStep(LAST);
    } else {
      setPlaying(true);
    }
  };

  const on = (n: number) => step >= n;

  return (
    <div className="relative sm:pb-28" aria-label="Sample store: the Peakhour assistant answering a shopper" role="group">
      <SampleTag className="absolute -top-3 right-3 z-20" />

      {/* The storefront */}
      <div className="overflow-hidden rounded-3xl border bg-card shadow-[0_2px_4px_rgb(15_17_48/6%),0_28px_56px_-20px_rgb(15_17_48/30%)]">
        <div className="flex items-center gap-1.5 border-b bg-muted px-3.5 py-2.5">
          <i className="size-2.5 rounded-full bg-border" />
          <i className="size-2.5 rounded-full bg-border" />
          <i className="size-2.5 rounded-full bg-border" />
          <span className="ml-2.5 min-w-0 flex-1 truncate rounded-full bg-background px-3 py-1 text-micro text-muted-foreground">
            neelandco.in/products/indigo-handblock-kurta
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-4">
          <ProductTile art="kurta" tint="indigo" className="aspect-square rounded-2xl" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-micro font-bold uppercase tracking-wider text-muted-foreground">Neel &amp; Co.</span>
            <span className="text-base font-extrabold leading-tight tracking-tight sm:text-lg">Indigo hand-block cotton kurta</span>
            <span className="font-extrabold">₹1,499</span>
            <span className="flex flex-wrap gap-1">
              {["S", "M", "L", "XL"].map((s) => (
                <span
                  key={s}
                  className={cn(
                    "rounded-md border-[1.5px] px-1.5 text-micro font-bold",
                    s === "XL" ? "border-foreground" : "border-border",
                  )}
                >
                  {s}
                </span>
              ))}
            </span>
            <span className="hidden text-micro text-muted-foreground sm:block">Hand-printed in Bagru, Rajasthan</span>
            <span
              className={cn(
                "mt-auto rounded-full py-1.5 text-center text-xs font-bold text-white transition-colors",
                on(5) ? "bg-[var(--daylight-ok)]" : "bg-foreground",
              )}
            >
              {on(5) ? "✓ Added to cart" : "Add to cart"}
            </span>
          </div>
        </div>
        <div className="hidden px-4 pb-4 sm:block">
          <div className="flex items-baseline justify-between text-sm font-extrabold">
            <span>Often bought together</span>
            <span className="font-mono text-micro font-semibold tracking-wider text-muted-foreground">SMART RAIL</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2.5">
            {RAIL.map((r) => (
              <div key={r.art} className="min-w-0">
                <ProductTile art={r.art} tint={r.tint} className="aspect-[4/3] rounded-xl" iconClassName="w-2/5" />
                <p className="mt-1 text-micro leading-snug text-muted-foreground">
                  <b className="text-foreground">Why:</b> {r.why}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity feed item */}
      <div
        data-on={on(8)}
        className="daylight-bubble absolute -top-5 left-4 z-10 hidden items-center gap-2.5 rounded-2xl border bg-card px-3 py-2.5 text-xs shadow-lg sm:flex"
      >
        <span className="grid size-7 place-items-center rounded-lg bg-brand-soft text-brand-strong">
          <Tag className="size-3.5" aria-hidden />
        </span>
        <span>
          <b className="block">Markdown applied</b>
          <span className="text-muted-foreground">Linen dupatta ₹1,299 → ₹1,099</span>
        </span>
        <span className="ml-1 rounded-md border px-2 py-0.5 font-bold">Undo</span>
      </div>

      {/* Storefront chat */}
      <div className="relative z-10 -mt-3 ml-6 overflow-hidden rounded-3xl border bg-card shadow-xl sm:absolute sm:-right-2 sm:bottom-0 sm:mt-0 sm:ml-0 sm:w-[300px] xl:-right-8">
        <div className="flex items-center gap-2 bg-ink py-1.5 pl-3.5 pr-1.5 text-sm font-bold text-on-ink">
          <span className="size-2 rounded-full bg-brand" aria-hidden />
          Ask Neel &amp; Co.
          <button
            type="button"
            onClick={toggle}
            aria-pressed={!playing}
            className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-semibold text-on-ink-dim transition-colors hover:bg-white/10 hover:text-on-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {playing ? <Pause className="size-3" aria-hidden /> : <Play className="size-3" aria-hidden />}
            {playing ? "Pause demo" : "Play demo"}
          </button>
        </div>
        <div className="flex min-h-[208px] flex-col gap-2 p-3 text-[13px] leading-snug">
          <Bubble on={on(1)} me>Is the indigo kurta in XL? I need it in Pune by Friday.</Bubble>
          {step === 2 && (
            <span className="daylight-typing flex w-fit gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-3 text-muted-foreground" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          )}
          <Bubble on={on(3)}>
            Yes, XL is in stock, and there are 3 left. Orders to Pune usually arrive in 2–3 days, so Friday works. Shall I add it to
            your cart?
            <span className="mt-1 block text-micro text-muted-foreground">From: product stock · Shipping policy</span>
          </Bubble>
          <Bubble on={on(4)} me>Yes please</Bubble>
        </div>
      </div>

      {/* WhatsApp COD check */}
      <div
        data-on={on(6)}
        className="daylight-bubble absolute bottom-6 -left-2 z-10 hidden w-[236px] lg:-left-6 rounded-2xl border bg-card p-3 text-xs shadow-xl sm:block"
      >
        <p className="mb-1.5 flex items-center gap-1.5 font-extrabold text-[var(--daylight-wa)]">
          <WhatsAppGlyph className="size-4" />
          WhatsApp · COD check
        </p>
        <p className="rounded-xl bg-[var(--daylight-wa-soft)] px-2.5 py-2 leading-snug">
          Hi Aanya, please confirm your cash-on-delivery order #1042 for ₹1,499.
        </p>
        <p className="mt-2 flex gap-1.5 text-center font-bold">
          <span className={cn("flex-1 rounded-lg py-1", on(7) ? "bg-[var(--daylight-wa)] text-white" : "bg-[var(--daylight-wa-soft)] text-[var(--daylight-wa)]")}>
            {on(7) ? "✓ Confirmed" : "Confirm"}
          </span>
          <span className="flex-1 rounded-lg bg-[var(--daylight-wa-soft)] py-1 text-[var(--daylight-wa)]">Cancel</span>
        </p>
      </div>

      <span className="sr-only">
        A shopper asks about size and delivery, the assistant answers from stock and the shipping policy, the item is
        added to the cart, the COD order is confirmed on WhatsApp, and a markdown appears in the activity feed with an Undo.
      </span>
    </div>
  );
}

function Bubble({ on, me = false, children }: { on: boolean; me?: boolean; children: React.ReactNode }) {
  return (
    <p
      data-on={on}
      className={cn(
        "daylight-bubble max-w-[88%] rounded-2xl px-3 py-2",
        me ? "self-end rounded-br-sm bg-ink text-on-ink" : "self-start rounded-bl-sm bg-muted",
      )}
    >
      {children}
    </p>
  );
}

export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M12 3a9 9 0 00-7.8 13.5L3 21l4.6-1.2A9 9 0 1012 3z" fill="currentColor" />
      <path
        d="M9 8.5c.3-.6.6-.6 1-.6l.6 1.5-.6.9c.5 1 1.3 1.8 2.4 2.4l.9-.6 1.5.6c0 .4 0 .8-.6 1.1-1 .6-4.7-1.4-5.5-4.3-.1-.5.1-.8.3-1z"
        fill="#fff"
      />
    </svg>
  );
}
