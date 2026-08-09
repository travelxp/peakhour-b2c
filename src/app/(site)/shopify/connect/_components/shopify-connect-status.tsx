"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * What peakhour-api sends here, and what each one actually means to a merchant.
 *
 * ★EVERY CODE BELOW IS ONE THAT THE API REALLY EMITS — they were read off the
 * redirect sites in `integrations/routes.ts`, not imagined. `misconfigured`
 * and `hmac_invalid` in particular are OUR faults, not the merchant's, and the
 * copy says so rather than implying they did something wrong.
 */
const ERRORS: Record<string, { title: string; body: string }> = {
  hmac_invalid: {
    title: "We couldn't verify that request",
    body: "The install request didn't carry a valid signature from Shopify, so we stopped rather than trust it. Starting again from your Shopify admin will produce a fresh, signed one.",
  },
  invalid_shop: {
    title: "That store address didn't look right",
    body: "The request named a store we couldn't recognise as a Shopify domain. Installing from the Shopify App Store or your admin will send us the right one.",
  },
  misconfigured: {
    title: "This is on us",
    body: "Peakhour's Shopify connection isn't configured correctly right now, so the install couldn't complete. Nothing is wrong with your store. Please try again shortly, and tell us if it keeps happening.",
  },
  shop_mismatch: {
    title: "The store changed mid-install",
    body: "The store Shopify sent back wasn't the one the install started with, so we stopped instead of connecting the wrong shop. Start the install again from the store you meant.",
  },
};

/** Anything else the API forwards (it passes some provider messages through
 *  verbatim). Shown as itself rather than swallowed — a merchant repeating an
 *  unknown message to support is more useful than "something went wrong". */
function unknownError(raw: string): { title: string; body: string } {
  return {
    title: "That didn't finish",
    body: `Shopify reported: ${raw}. Opening Peakhour from your Shopify admin is the quickest way to pick up where this left off.`,
  };
}

export function ShopifyConnectStatus() {
  const params = useSearchParams();
  const rawError = (params.get("error") ?? "").trim();
  const shop = (params.get("shop") ?? "").trim();
  /**
   * ★A `token` HERE MEANS AUTO-PROVISIONING FAILED. The API mints one only on
   * the degraded path, where an install could not be turned into an account and
   * a pending row was parked instead. There is no longer a client that can spend
   * it — and inventing one would rebuild the wizard this page exists to replace.
   * So its presence is not shown as a token or a code; it changes what the page
   * ADVISES, because reinstalling is what actually clears that state.
   */
  const stalled = !!(params.get("token") ?? "").trim();

  const err = rawError ? (ERRORS[rawError] ?? unknownError(rawError)) : null;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            {err ? (
              <AlertCircle className="h-5 w-5 text-muted-foreground" aria-hidden />
            ) : (
              <Store className="h-5 w-5 text-muted-foreground" aria-hidden />
            )}
          </div>
          <CardTitle>
            {err ? err.title : stalled ? "Your store needs one more step" : "Finish in your Shopify admin"}
          </CardTitle>
          <CardDescription>
            {shop ? shop : "Peakhour for Shopify"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {err ? (
            <p>{err.body}</p>
          ) : stalled ? (
            <p>
              Your install reached us, but we couldn&apos;t finish setting up your Peakhour account
              automatically. Reinstalling from your Shopify admin starts that again cleanly — nothing
              you have already done is lost.
            </p>
          ) : (
            <p>
              There&apos;s nothing to do on this page. Peakhour sets your account up automatically when
              you install it, and everything else happens inside the app.
            </p>
          )}

          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="mb-2 font-medium text-foreground">What to do</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Open your Shopify admin.</li>
              <li>
                Go to <span className="font-medium text-foreground">Apps</span> and open{" "}
                <span className="font-medium text-foreground">Peakhour</span>
                {stalled ? " — or reinstall it from the Shopify App Store if it isn't listed." : "."}
              </li>
              <li>
                If we need you to link an existing Peakhour account, the app will ask you there.
              </li>
            </ol>
          </div>

          <p>
            Peakhour can only read your store from inside the Shopify admin, so this page has no way
            to connect it for you.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild variant="outline">
              <Link href="/support">
                Get help
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">Back to Peakhour</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
