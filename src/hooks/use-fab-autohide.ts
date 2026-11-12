"use client";

import { useEffect, useRef, useState } from "react";
import { FAB_IDLE_MS, fabHiddenAfterScroll } from "@/lib/fab-visibility";

/** Marks the dashboard shell's scroll column (the document itself never scrolls). */
export const DASHBOARD_SCROLL_SELECTOR = '[data-slot="dashboard-scroll"]';

/**
 * True while a floating button should be tucked away: the shell's scroll column
 * is being scrolled down. Returns to false on scroll up or after FAB_IDLE_MS
 * without scrolling. Callers apply FAB_HIDDEN_CLASSES, which act below md only.
 */
export function useFabAutohide(panelOpen: boolean): boolean {
  const [hidden, setHidden] = useState(false);
  const openRef = useRef(panelOpen);
  useEffect(() => {
    openRef.current = panelOpen;
  }, [panelOpen]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(DASHBOARD_SCROLL_SELECTOR);
    if (!el) return;
    let prev = el.scrollTop;
    let isHidden = false;
    let idle: number | undefined;
    const set = (v: boolean) => {
      if (v !== isHidden) {
        isHidden = v;
        setHidden(v);
      }
    };
    const onScroll = () => {
      const top = el.scrollTop;
      set(fabHiddenAfterScroll(prev, top, isHidden, openRef.current));
      prev = top;
      window.clearTimeout(idle);
      idle = window.setTimeout(() => set(false), FAB_IDLE_MS);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(idle);
    };
  }, []);

  return hidden && !panelOpen;
}

/** Below md only: slide down and fade; keyboard focus still brings it back. */
export const FAB_HIDDEN_CLASSES =
  "max-md:pointer-events-none max-md:translate-y-4 max-md:opacity-0 max-md:focus-visible:pointer-events-auto max-md:focus-visible:translate-y-0 max-md:focus-visible:opacity-100";
