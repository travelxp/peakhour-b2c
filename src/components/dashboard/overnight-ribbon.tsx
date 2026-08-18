"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ShoppingBag, PenLine, TrendingUp, MessagesSquare, MapPin } from "lucide-react";
import type { ActivityCount, ActivityMetric, Pillar } from "@/hooks/use-home-summary";
import { cn } from "@/lib/utils";

/**
 * "While you were away" — what the platform did on its own overnight.
 *
 * This is the first question a business owner opens the dashboard to answer,
 * and until now nothing on the page could. Backed by the `activity` block on
 * GET /v1/home/summary, which returns counts and a stable `metric` key; the
 * wording is here rather than in the api so a sentence has one home.
 *
 * Rendered on the always-dark instrument surface (--ink), the same material
 * as the console on the marketing hero — the panel is a picture of the
 * product, so it does not follow the page theme.
 */

/** The noun for each metric, singular and plural. */
const COPY: Record<ActivityMetric, [one: string, many: string]> = {
  actions_executed: ["action taken", "actions taken"],
  published: ["post published", "posts published"],
  drafted: ["draft written", "drafts written"],
  leads_captured: ["lead captured", "leads captured"],
  conversations_resolved: ["conversation closed", "conversations closed"],
  reviews_replied: ["review answered", "reviews answered"],
};

const PILLAR_ICON: Record<Pillar, React.ElementType> = {
  commerce: ShoppingBag,
  content: PenLine,
  growth: TrendingUp,
  support: MessagesSquare,
  presence: MapPin,
};

/**
 * Subscribes to the reduced-motion preference rather than sampling it once,
 * so flipping the OS setting takes effect without a reload.
 *
 * useSyncExternalStore, not useState+useEffect: setting state synchronously
 * inside an effect is what `react-hooks/set-state-in-effect` exists to stop,
 * and a media query is exactly the "external store" this hook is for. The
 * server snapshot reports "not reduced" — the safe default, since the count
 * only ever runs on the client.
 */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/**
 * Counts from 0 to `to` once, when the element first reaches the viewport.
 *
 * Motion means change: a figure animates because it moved. Under
 * prefers-reduced-motion the number is simply read — and because the initial
 * state is derived rather than assigned in an effect, that path renders the
 * final value on the very first paint instead of flashing zero.
 */
function useCountUp(to: number, enabled: boolean) {
  const [value, setValue] = useState(() => (enabled ? 0 : to));
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    // setValue lands in a rAF callback, never synchronously in the effect
    // body — the distinction the lint rule is drawing.
    const run = () => {
      const start = performance.now();
      const duration = 600 + Math.min(to, 200) * 2;
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      run(); // no observer to wait for — count immediately
      return () => cancelAnimationFrame(frame);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        run();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, enabled]);

  return { ref, value };
}

function Figure({ count, metric, pillar, animate }: ActivityCount & { animate: boolean }) {
  const { ref, value } = useCountUp(count, animate);
  const Icon = PILLAR_ICON[pillar];
  const [one, many] = COPY[metric];
  return (
    <span className="flex items-baseline gap-1.5 text-sm text-on-ink-dim">
      <Icon className="size-3.5 shrink-0 self-center text-brand" aria-hidden />
      <span ref={ref} className="text-base font-bold tabular-nums text-on-ink">
        {value}
      </span>
      {count === 1 ? one : many}
    </span>
  );
}

export function OvernightRibbon({
  activity,
  className,
}: {
  activity: { pillars: ActivityCount[]; windowHours: number } | undefined;
  className?: string;
}) {
  const animate = !usePrefersReducedMotion();

  if (!activity) return null;

  // Only the pillars that actually did something get a figure. The api sends
  // every pillar including the quiet ones so this component — not the api —
  // decides what silence looks like.
  const moved = activity.pillars.filter((p) => p.count > 0);

  return (
    <section
      aria-label={`What Peakhour did in the last ${activity.windowHours} hours`}
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-ink-line bg-ink px-4 py-3 shadow-elev-2",
        className,
      )}
    >
      <span className="flex items-center gap-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-brand">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full rounded-full bg-success opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex size-1.5 rounded-full bg-success" />
        </span>
        While you were away
      </span>

      {moved.length === 0 ? (
        // A quiet night is an answer, not an empty state. Saying nothing here
        // would read as a panel that failed to load.
        <span className="text-sm text-on-ink-dim">
          Nothing moved overnight — your pillars are caught up.
        </span>
      ) : (
        moved.map((p) => (
          <Figure key={`${p.pillar}-${p.metric}`} {...p} animate={animate} />
        ))
      )}
    </section>
  );
}
