"use client";

import { useEffect, useState } from "react";

/** The time, read once and again every minute: a render must not read the clock, and an idle tab must still see a proposal run out. */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
