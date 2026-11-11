"use client";

import { useEffect, useRef } from "react";
import { useParams, usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { API_BASE_URL } from "@/lib/api";
import {
  buildBeacon,
  connectionType,
  routePattern,
  sendBeacon,
  toSample,
  type VitalSample,
} from "@/lib/web-vitals";

/**
 * Reports this page load's Core Web Vitals (LCP, INP, CLS, FCP, TTFB) to the
 * api, once, when the page is hidden. Renders nothing; mounted once in the
 * root layout.
 *
 * The route is the one the page was LOADED on, read at the first render: LCP,
 * FCP and TTFB belong to that load, and INP and CLS accumulate over a visit
 * that may cross routes, so the entry route is the only stable key.
 *
 * Production only, and only when an api origin is configured.
 */
export function WebVitalsReporter() {
  const pathname = usePathname();
  const params = useParams();
  // Captured once: `useRef(initial)` keeps the first render's value.
  const entryRoute = useRef(routePattern(pathname, params));
  const samples = useRef<VitalSample[]>([]);
  const enabled = process.env.NODE_ENV === "production" && API_BASE_URL !== "";

  useReportWebVitals((metric) => {
    const sample = toSample(metric);
    if (sample) samples.current.push(sample);
  });

  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      const beacon = buildBeacon(entryRoute.current, samples.current, {
        viewportWidth: window.innerWidth,
        connection: connectionType(navigator as unknown as { connection?: { effectiveType?: string } }),
      });
      samples.current = [];
      if (beacon) sendBeacon(`${API_BASE_URL}/v1/web-vitals`, beacon);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    // Capture phase, registered after the hook above registered its own: the
    // library's INP and CLS callbacks run on this same event, and must run
    // first or their final values would miss the batch.
    document.addEventListener("visibilitychange", onVisibility, true);
    window.addEventListener("pagehide", flush, true);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility, true);
      window.removeEventListener("pagehide", flush, true);
    };
  }, [enabled]);

  return null;
}
