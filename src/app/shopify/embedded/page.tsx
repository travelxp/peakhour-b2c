"use client";

import { useEffect, useState } from "react";

/**
 * Embedded surface home — the primary workflow entry inside Shopify admin.
 * Authenticates via the App Bridge session token (no cookie — iframes block
 * third-party cookies), calls the api `/v1/shopify/embedded/context`, and
 * renders the connected store's status (or a link-account prompt when the
 * shop isn't yet tied to a Peakhour account → onboarding lands in S3).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

interface EmbeddedContext {
  connected: boolean;
  shop?: string;
  storeName?: string | null;
  currency?: string | null;
  productsSyncedAt?: string | null;
  connectionStatus?: string | null;
  assistantActive?: boolean;
  pricing?: {
    displayName: string;
    amount: string;
    currency: string;
    interval: "monthly" | "annual";
  } | null;
}

/** App Bridge attaches `window.shopify` asynchronously after its CDN script
 *  loads; poll briefly for it, then fetch a fresh session token. */
async function getSessionToken(timeoutMs = 6000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== "undefined" && window.shopify?.idToken) {
      try {
        return await window.shopify.idToken();
      } catch {
        return null;
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; ctx: EmbeddedContext };

export default function ShopifyEmbeddedHome() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [subscribing, setSubscribing] = useState(false);
  const [subErr, setSubErr] = useState<string | null>(null);

  /** Start the Shopify Billing checkout: mint a charge, then break out of the
   *  admin iframe to Shopify's hosted approve-and-pay page. */
  async function handleSubscribe() {
    setSubscribing(true);
    setSubErr(null);
    const token = await getSessionToken();
    if (!token) {
      setSubErr("Couldn't get a Shopify session. Please reopen from your admin.");
      setSubscribing(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/billing/subscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as { confirmationUrl?: string };
      if (!res.ok || !data.confirmationUrl) {
        setSubErr("Could not start checkout. Please try again.");
        setSubscribing(false);
        return;
      }
      // confirmationUrl is a Shopify-hosted page — navigate the TOP frame.
      (window.top ?? window).location.href = data.confirmationUrl;
    } catch {
      setSubErr("Network error starting checkout.");
      setSubscribing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getSessionToken();
      if (cancelled) return;
      if (!token) {
        setState({
          status: "error",
          message:
            "Couldn't get a Shopify session. Please open Peakhour from your Shopify admin.",
        });
        return;
      }
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/context`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "error", message: `Could not load your store (${res.status}).` });
          return;
        }
        const ctx = (await res.json()) as EmbeddedContext;
        if (!cancelled) setState({ status: "ready", ctx });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Network error contacting Peakhour." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Peakhour Commerce</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Your catalog-grounded WhatsApp assistant, connected to your Shopify store.
      </p>

      <div className="mt-8 rounded-xl border border-neutral-200 p-6">
        {state.status === "loading" && (
          <p className="text-sm text-neutral-500">Connecting to your store…</p>
        )}

        {state.status === "error" && (
          <p className="text-sm text-red-600">{state.message}</p>
        )}

        {state.status === "ready" && state.ctx.connected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden />
              <span className="font-medium">
                {state.ctx.storeName || state.ctx.shop} is connected
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-neutral-600">
              {state.ctx.shop && (
                <>
                  <dt className="text-neutral-400">Store</dt>
                  <dd>{state.ctx.shop}</dd>
                </>
              )}
              {state.ctx.currency && (
                <>
                  <dt className="text-neutral-400">Currency</dt>
                  <dd>{state.ctx.currency}</dd>
                </>
              )}
              <dt className="text-neutral-400">Catalog last synced</dt>
              <dd>
                {state.ctx.productsSyncedAt
                  ? new Date(state.ctx.productsSyncedAt).toLocaleString()
                  : "Syncing…"}
              </dd>
            </dl>
            {state.ctx.assistantActive ? (
              <div className="mt-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                ✓ Your WhatsApp catalog assistant is active. Manage and preview it from your
                Peakhour dashboard.
              </div>
            ) : (
              <div className="mt-2 space-y-2 rounded-lg border border-neutral-200 p-4">
                <p className="text-sm text-neutral-600">
                  Switch on the catalog-grounded WhatsApp assistant — it answers shopper
                  questions using your real products, in their own language.
                </p>
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="rounded-lg bg-[#075E54] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {subscribing
                    ? "Starting checkout…"
                    : state.ctx.pricing
                      ? `Subscribe — ${state.ctx.pricing.currency === "USD" ? "$" : state.ctx.pricing.currency + " "}${state.ctx.pricing.amount}/mo`
                      : "Subscribe"}
                </button>
                {subErr && <p className="text-sm text-red-600">{subErr}</p>}
              </div>
            )}
          </div>
        )}

        {state.status === "ready" && !state.ctx.connected && (
          <div className="space-y-3">
            <p className="font-medium">Link your Peakhour account</p>
            <p className="text-sm text-neutral-600">
              {state.ctx.shop ? `${state.ctx.shop} ` : "This store "}
              isn&apos;t linked to a Peakhour account yet. Finish setup to connect your
              catalog and switch on the assistant.
            </p>
            <p className="text-xs text-neutral-400">
              Guided onboarding is coming to this screen shortly.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
