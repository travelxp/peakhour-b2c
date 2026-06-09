"use client";

import { useEffect, useState } from "react";

/**
 * Shopify Billing return page (SB-2d). After the merchant approves the charge
 * on Shopify's hosted page, Shopify redirects here (the app's returnUrl). We
 * get a fresh App Bridge session token and call billing/confirm, which
 * reconciles + grants the commerce.assistant entitlement.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

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
  | { status: "confirming" }
  | { status: "active" }
  | { status: "inactive" }
  | { status: "error"; message: string };

export default function ShopifyBillingReturn() {
  const [state, setState] = useState<State>({ status: "confirming" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getSessionToken();
      if (cancelled) return;
      if (!token) {
        setState({ status: "error", message: "Couldn't confirm — please reopen from your Shopify admin." });
        return;
      }
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/billing/confirm`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "error", message: "Couldn't confirm your subscription. Please try again." });
          return;
        }
        const data = (await res.json()) as { active?: boolean };
        setState({ status: data.active ? "active" : "inactive" });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Network error confirming your subscription." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Peakhour Commerce</h1>
      <div className="mt-8 rounded-xl border border-neutral-200 p-6">
        {state.status === "confirming" && (
          <p className="text-sm text-neutral-500">Confirming your subscription…</p>
        )}
        {state.status === "active" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden />
              <span className="font-medium">Your assistant is active 🎉</span>
            </div>
            <p className="text-sm text-neutral-600">
              The catalog-grounded WhatsApp assistant is switched on for your store. You can
              configure and preview it from your Peakhour dashboard.
            </p>
            <a href="/shopify/embedded" className="inline-block pt-1 text-sm text-[#075E54] underline">
              Back to Peakhour Commerce
            </a>
          </div>
        )}
        {state.status === "inactive" && (
          <p className="text-sm text-neutral-600">
            We couldn&apos;t find an active subscription yet. If you just approved it, give it a
            moment and refresh.
          </p>
        )}
        {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
      </div>
    </main>
  );
}
