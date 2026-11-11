"use client";

import { useSyncExternalStore } from "react";
import { createSharedClock } from "@/lib/shared-clock";

/** ★ONE CLOCK for everything on the Presence page that reads the time (the status, the summary line, each section's waiting line): one interval, not one each. */
const MINUTE_CLOCK = createSharedClock(60_000);

/** The time, ticking every minute and when the tab is shown again: a render must not read the clock, and an idle tab must still see a proposal run out. */
export function useNow(): number {
  return useSyncExternalStore(MINUTE_CLOCK.subscribe, MINUTE_CLOCK.now, MINUTE_CLOCK.now);
}
