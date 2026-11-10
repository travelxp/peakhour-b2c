/**
 * Server-side session helpers for /dashboard (see middleware.ts and the site
 * layout). Pure functions of their arguments (fetch is injectable) so they are
 * testable and safe in both the Edge middleware and the Node server.
 *
 * Rules every function here keeps:
 *  - Cookies go ONLY to the origin of NEXT_PUBLIC_API_URL, and only the one
 *    cookie the call needs (access for /me, refresh for /refresh).
 *  - Redirects are never followed (`redirect: "manual"`), so a cookie cannot be
 *    replayed to another host by a 3xx.
 *  - Every failure (bad config, network, timeout, non-2xx, bad JSON) resolves to
 *    null. Callers fall back to today's client-side path; nothing here throws.
 *  - A token value is never logged, returned in a payload, or put in an error.
 */
import { dehydrate, QueryClient, type DehydratedState } from "@tanstack/react-query";
import type { MeResponse } from "./auth";
import { ME_KEY } from "./auth-session";

/** Budget for the server-side /me call. Past this the page renders as it does today. */
export const SERVER_ME_TIMEOUT_MS = 800;
/** Budget for the middleware refresh call (it can hit the database to re-issue). */
export const REFRESH_TIMEOUT_MS = 1500;
/** An access token this close to expiry is treated as expired. */
const EXPIRY_SKEW_S = 30;

/**
 * Request header the middleware sets on /dashboard document requests so the site
 * layout knows to seed ['me'] on the server. Always overwritten or removed there,
 * so a value sent by a client is never believed.
 */
export const DASHBOARD_REQUEST_HEADER = "x-ph-dashboard";

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Origin of the api, or null when NEXT_PUBLIC_API_URL is unset or malformed. */
export function apiOriginOf(apiUrl: string | undefined): string | null {
  if (!apiUrl) return null;
  try {
    const u = new URL(apiUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * True when the JWT's `exp` is in the past (or within the skew). A token we
 * cannot read counts as expired. This only decides whether to try a refresh; the
 * api is the one that verifies tokens.
 */
export function accessTokenExpired(token: string | undefined, nowMs = Date.now()): boolean {
  if (!token) return true;
  const part = token.split(".")[1];
  if (!part) return true;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const exp = (JSON.parse(atob(padded)) as { exp?: unknown }).exp;
    if (typeof exp !== "number") return true;
    return exp - EXPIRY_SKEW_S <= nowMs / 1000;
  } catch {
    return true;
  }
}

/** Only these keys of the /me payload are ever serialized into the page. */
const ME_KEYS = [
  "user",
  "org",
  "orgs",
  "business",
  "businesses",
  "entitlements",
  "entitlementsError",
] as const;

/** Narrow an api envelope to the /me payload, or null when it is not one. */
export function pickMe(envelope: unknown): MeResponse | null {
  if (!envelope || typeof envelope !== "object") return null;
  const e = envelope as { ok?: unknown; data?: unknown };
  if (e.ok !== true || !e.data || typeof e.data !== "object") return null;
  const data = e.data as Record<string, unknown>;
  if (!data.user || typeof data.user !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const k of ME_KEYS) if (k in data) out[k] = data[k];
  return out as unknown as MeResponse;
}

/** GET {api}/v1/auth/me with the access cookie. null on anything but a clean 200. */
export async function fetchMeServer(opts: {
  apiUrl: string | undefined;
  accessCookieName: string;
  accessToken: string | undefined;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<MeResponse | null> {
  const origin = apiOriginOf(opts.apiUrl);
  if (!origin || !opts.accessToken) return null;
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${origin}/v1/auth/me`, {
      method: "GET",
      headers: {
        cookie: `${opts.accessCookieName}=${opts.accessToken}`,
        accept: "application/json",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs ?? SERVER_ME_TIMEOUT_MS),
    });
    if (res.status !== 200) return null;
    return pickMe(await res.json());
  } catch {
    return null;
  }
}

/** The react-query state that seeds ['me']: one query, holding only the me payload. */
export function meDehydratedState(me: MeResponse): DehydratedState {
  const qc = new QueryClient();
  qc.setQueryData(ME_KEY, me);
  return dehydrate(qc);
}

export interface RefreshedSession {
  /** Raw Set-Cookie header values from the api, to copy onto the response unchanged. */
  setCookies: string[];
  /** The request's own Cookie header with the new values applied, for the render that follows. */
  cookieHeader: string;
}

/** `name=value` pairs of a Cookie header, or the first pair of a Set-Cookie line. */
function firstPair(line: string): [string, string] | null {
  const head = line.split(";", 1)[0];
  const i = head.indexOf("=");
  if (i <= 0) return null;
  return [head.slice(0, i).trim(), head.slice(i + 1).trim()];
}

/**
 * POST {api}/v1/auth/refresh with ONLY the refresh cookie. On 2xx returns the
 * api's Set-Cookie lines and the request's Cookie header updated with them; on
 * anything else (401, 5xx, network, timeout) returns null and the caller carries on
 * as if no refresh was attempted. The api's own cookie-clearing on a 401 is not
 * copied: the client path owns the signed-out experience.
 */
export async function refreshSessionServer(opts: {
  apiUrl: string | undefined;
  refreshCookieName: string;
  refreshToken: string | undefined;
  requestCookieHeader: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<RefreshedSession | null> {
  const origin = apiOriginOf(opts.apiUrl);
  if (!origin || !opts.refreshToken) return null;
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${origin}/v1/auth/refresh`, {
      method: "POST",
      headers: {
        cookie: `${opts.refreshCookieName}=${opts.refreshToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs ?? REFRESH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const setCookies = res.headers.getSetCookie();
    if (setCookies.length === 0) return null;

    const updates = new Map<string, string>();
    for (const line of setCookies) {
      const pair = firstPair(line);
      if (pair) updates.set(pair[0], pair[1]);
    }
    const kept = opts.requestCookieHeader
      .split(";")
      .map((p) => p.trim())
      .filter((p) => p && !updates.has(p.split("=", 1)[0]));
    const cookieHeader = [...kept, ...[...updates].filter(([, v]) => v !== "").map(([k, v]) => `${k}=${v}`)].join("; ");
    return { setCookies, cookieHeader };
  } catch {
    return null;
  }
}
