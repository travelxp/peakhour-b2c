"use client";

import { useEffect, useState } from "react";

/**
 * The current time, re-read every `intervalMs` — so a component that renders a
 * countdown re-renders while it sits open.
 *
 * ★★A COUNTDOWN THAT READS `Date.now()` DURING RENDER IS ONLY AS FRESH AS THE
 * LAST RENDER, and an idle page does not render. The Meta-category callout
 * learned this twice: first a `useMemo` froze the clock, and removing the memo
 * changed nothing, because react-query does not re-render a component for a
 * refetch that returned identical data. A page left open across a deadline
 * went on saying "1 day left". ★This is the only thing that makes time pass on
 * screen.
 *
 * ★THE INTERVAL IS THE CALLER'S — a countdown in days needs nothing finer than
 * a few minutes, and a table that re-renders every second for it would be
 * paying for precision it cannot show.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    // ★AND AT ONCE WHEN THE TAB IS SHOWN AGAIN (b2c review R1). Browsers
    //  throttle a hidden tab's intervals, so without this a tab brought back
    //  reads a clock up to a minute old until the next tick: "under a minute
    //  left" on a window that closed. `auth-flow.tsx`'s ticker does the same.
    const onVisibility = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
  return now;
}
