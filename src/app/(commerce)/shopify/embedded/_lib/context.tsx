"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSessionToken } from "./session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Shape of GET /v1/shopify/embedded/context. Shared so the shell (persistent
 * reconnect banner) and pages agree on one type. `status` is the raw merchant
 * status — distinguishes a truly-disconnected store ("disconnected") from a
 * never-linked one (no merchant row → connected:false, status absent), which
 * the banner relies on so it never shows on a fresh install.
 */
export interface EmbeddedContextData {
  connected: boolean;
  status?: "active" | "disconnected" | string;
  shop: string;
  orgId?: string;
  businessId?: string;
  storeName?: string | null;
  accountEmail?: string | null;
  currency?: string | null;
  productsSyncedAt?: string | null;
  connectionStatus?: string | null;
  assistantActive?: boolean;
  productsCount?: number;
  pricing?: {
    displayName: string;
    amount: string;
    currency: string;
    interval: "monthly" | "annual";
    trialDays?: number;
    annual?: { amount: string; currency: string } | null;
  } | null;
}

interface EmbeddedContextValue {
  ctx: EmbeddedContextData | null;
  loading: boolean;
  /** Re-fetch context — call after an action that changes connection/plan
   *  state (disconnect, downgrade) so the UI updates in place without a reopen. */
  refresh: () => Promise<void>;
}

const Ctx = createContext<EmbeddedContextValue | null>(null);

/** Pure fetch of the embedded context — no React state, so it's safe to call
 *  from both the mount effect (inline) and the exposed refresh() without
 *  tripping react-hooks/set-state-in-effect. Returns null on no-session or error. */
async function fetchEmbeddedContext(): Promise<EmbeddedContextData | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/v1/shopify/embedded/context`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return (await res.json()) as EmbeddedContextData;
  } catch {
    // Non-fatal — the banner simply doesn't render; pages surface their own errors.
  }
  return null;
}

/**
 * Fetches the embedded context once for the whole embedded surface and exposes
 * it (plus a `refresh()`) via React context. Mounted in the Polaris shell so
 * the persistent reconnect banner and any consumer share a single fetch.
 * Pages may still fetch their own context independently — this provider does
 * not force a migration; it powers the shell banner and in-place refreshes.
 */
export function EmbeddedContextProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<EmbeddedContextData | null>(null);
  const [loading, setLoading] = useState(true);

  // Exposed for event handlers (e.g. Settings disconnect/downgrade) — NOT
  // called from the mount effect, so its setState calls don't trip the lint.
  const refresh = useCallback(async () => {
    const data = await fetchEmbeddedContext();
    if (data) setCtx(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchEmbeddedContext();
      if (cancelled) return;
      if (data) setCtx(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <Ctx.Provider value={{ ctx, loading, refresh }}>{children}</Ctx.Provider>;
}

export function useEmbeddedContext(): EmbeddedContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEmbeddedContext must be used within EmbeddedContextProvider");
  return v;
}

/** The top-level connect URL that re-runs OAuth. Used by every Reconnect CTA.
 *  Returns an ABSOLUTE URL (origin + path) on purpose: the CTAs assign it to
 *  `window.top.location.href` to escape the Shopify admin iframe. A RELATIVE
 *  path is resolved by the Location setter against the TARGET document's base
 *  URL — and `window.top` is the cross-origin admin document — so
 *  `/shopify/connect` becomes `https://admin.shopify.com/shopify/connect`
 *  (never our origin), which dead-ends in admin and surfaces as
 *  "<host> refused to connect". An absolute URL navigates the top window to
 *  OUR origin, escaping the iframe cleanly to the connect flow (→ OAuth → the
 *  Peakhour dashboard) — the same pattern the billing `confirmationUrl`
 *  top-redirect already uses. SSR has no `window`, but these CTAs only fire
 *  from client click handlers. */
export function reconnectUrl(shop?: string | null): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const path = shop
    ? `/shopify/connect?shop=${encodeURIComponent(shop)}&reconnect=1`
    : "/shopify/connect";
  return `${origin}${path}`;
}

/**
 * Start the one-click, token-based embedded reconnect. Hands the App Bridge
 * session token to the API's /shopify/reconnect via a top-level navigation
 * (which escapes the admin iframe; the token rides in the query because a
 * navigation can't send an Authorization header). The API resolves the shop's
 * linked org/business and re-runs OAuth, landing the merchant back inside the
 * embedded app — no Peakhour cookie, no magic-link, no org/business gate.
 *
 * Falls back to the connect wizard (cookie flow) only when no session token is
 * available — e.g. opened outside the admin iframe, where App Bridge can't
 * mint one.
 */
export async function startReconnect(shop?: string | null): Promise<void> {
  const top = window.top ?? window;
  let token: string | null = null;
  try {
    token = await getSessionToken();
  } catch {
    // getSessionToken shouldn't throw, but never let a token hiccup turn the
    // CTA into a no-op — fall through to the cookie-flow URL below.
    token = null;
  }
  top.location.href = token
    ? `${API_URL}/v1/integrations/shopify/reconnect?token=${encodeURIComponent(token)}`
    : reconnectUrl(shop);
}
