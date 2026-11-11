/**
 * Real-user Core Web Vitals reporting, the pure half (the component is
 * `components/shared/web-vitals-reporter.tsx`).
 *
 * Each page load collects the metrics Next reports, then sends ONE batch to
 * `POST /v1/web-vitals` when the page is hidden. What is sent: the metric
 * name, its value, the browser's rating, the route PATTERN, a device class and
 * the connection type. Never the path (`/share/<token>` is a credential), a
 * user id, or anything else about the visitor.
 */

export const REPORTED_METRICS = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export type ReportedMetric = (typeof REPORTED_METRICS)[number];

export interface VitalSample {
  name: ReportedMetric;
  value: number;
  rating?: "good" | "needs-improvement" | "poor";
}

export interface VitalsBeacon {
  route: string;
  device: "mobile" | "desktop";
  connection?: "slow-2g" | "2g" | "3g" | "4g";
  metrics: VitalSample[];
}

/** Below Tailwind's `md` breakpoint (768 px) the dashboard shows its mobile layout. */
const MOBILE_MAX_WIDTH = 767;
/** One page load reports a handful of metrics; the cap only bounds a runaway. */
const MAX_SAMPLES = 20;

export function deviceClass(viewportWidth: number): "mobile" | "desktop" {
  return viewportWidth <= MOBILE_MAX_WIDTH ? "mobile" : "desktop";
}

export function isReportedMetric(name: string): name is ReportedMetric {
  return (REPORTED_METRICS as readonly string[]).includes(name);
}

/** A static route word: letters, digits, `_`, `-`, starting with a letter, short,
 *  with no long digit run. Anything else (an id, a token) is masked, so a param
 *  `useParams()` did not resolve can never put a raw segment in a beacon. */
function isRouteWord(seg: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(seg) && !/d{6,}/.test(seg) && !(seg.length >= 20 && /d/.test(seg));
}

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * "/dashboard/content/6650f1c2…" -> "/dashboard/content/[id]", using the
 * dynamic params Next already resolved for this page (`useParams()`), so no
 * route table has to be kept in step with the app. A param's value is replaced
 * wherever it appears in the path, and a catch-all collapses to `[...name]`.
 * Query string and hash are never part of a pathname.
 */
export function routePattern(
  pathname: string,
  params: Record<string, string | string[] | undefined> | null,
): string {
  const segments = pathname.split("/").filter(Boolean).map(decoded);
  const out: string[] = [];
  for (let i = 0; i < segments.length; ) {
    let matched = false;
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value === undefined) continue;
      const run = Array.isArray(value) ? value.map(decoded) : [decoded(value)];
      if (run.length === 0 || i + run.length > segments.length) continue;
      if (run.every((v, j) => segments[i + j] === v)) {
        out.push(Array.isArray(value) ? `[...${key}]` : `[${key}]`);
        i += run.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const seg = segments[i++];
      out.push(isRouteWord(seg) ? seg : "[id]");
    }
  }
  return "/" + out.join("/");
}

type NetworkInformationLike = { effectiveType?: string };

export function connectionType(
  nav: { connection?: NetworkInformationLike } | undefined,
): VitalsBeacon["connection"] {
  const t = nav?.connection?.effectiveType;
  return t === "slow-2g" || t === "2g" || t === "3g" || t === "4g" ? t : undefined;
}

/** The sample for one Next metric, or null when it is not one we report. */
export function toSample(metric: { name: string; value: number; rating?: string }): VitalSample | null {
  if (!isReportedMetric(metric.name) || !Number.isFinite(metric.value) || metric.value < 0) return null;
  const rating =
    metric.rating === "good" || metric.rating === "needs-improvement" || metric.rating === "poor"
      ? metric.rating
      : undefined;
  return { name: metric.name, value: metric.value, ...(rating ? { rating } : {}) };
}

/** INP and CLS are reported again as they grow: keep the latest value per metric. */
function latestPerMetric(samples: readonly VitalSample[]): VitalSample[] {
  const byName = new Map<string, VitalSample>();
  for (const s of samples) byName.set(s.name, s);
  return [...byName.values()];
}

export function buildBeacon(
  route: string,
  samples: readonly VitalSample[],
  env: { viewportWidth: number; connection?: VitalsBeacon["connection"] },
): VitalsBeacon | null {
  if (samples.length === 0) return null;
  return {
    route,
    device: deviceClass(env.viewportWidth),
    ...(env.connection ? { connection: env.connection } : {}),
    metrics: latestPerMetric(samples).slice(0, MAX_SAMPLES),
  };
}

/**
 * Send with `sendBeacon` (survives the page being hidden or closed); fall back
 * to a `keepalive` fetch. The body is a text/plain Blob on purpose: a JSON
 * content type would make a cross-origin beacon preflight, which a beacon
 * cannot wait for. The api parses the body as JSON regardless.
 */
export function sendBeacon(url: string, beacon: VitalsBeacon): void {
  const body = JSON.stringify(beacon);
  try {
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) {
      return;
    }
  } catch {
    // fall through to fetch
  }
  try {
    void fetch(url, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": "text/plain" },
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // a lost perf beacon is never an error
  }
}
