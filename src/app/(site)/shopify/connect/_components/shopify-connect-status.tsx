"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SITE } from "@/lib/utils";

/**
 * What peakhour-api sends here, and what each one actually means to a merchant.
 *
 * ★A MAP, NOT AN OBJECT LITERAL. A bare `ERRORS[param]` lookup answers
 * `?error=toString` with an inherited Object.prototype member — truthy, so the
 * fallback never fires and the card renders with an empty title over an empty
 * body. A Map has no prototype chain to walk into.
 *
 * ★EVERY CODE HERE IS ONE THE API REALLY EMITS — read off the redirect sites in
 * `integrations/routes.ts`, not imagined. `misconfigured` and `hmac_invalid` are
 * OUR faults, and the copy says so rather than implying the merchant did
 * something wrong.
 */
const ERRORS = new Map<string, { title: string; body: string }>([
  [
    "hmac_invalid",
    {
      title: "We couldn't verify that request",
      body: "The install request didn't carry a valid signature from Shopify, so we stopped rather than trust it. Starting again from your Shopify admin will produce a fresh, signed one.",
    },
  ],
  [
    "invalid_shop",
    {
      title: "That store address didn't look right",
      body: "The request named a store we couldn't recognise as a Shopify domain. Installing from the Shopify App Store or your admin will send us the right one.",
    },
  ],
  [
    "misconfigured",
    {
      title: "This is on us",
      body: "Peakhour's Shopify connection isn't configured correctly right now, so the install couldn't complete. Nothing is wrong with your store. Please try again shortly, and tell us if it keeps happening.",
    },
  ],
  [
    "shop_mismatch",
    {
      title: "The store changed mid-install",
      body: "The store Shopify sent back wasn't the one the install started with, so we stopped instead of connecting the wrong shop. Start the install again from the store you meant.",
    },
  ],
]);

const UNKNOWN_ERROR = {
  title: "That didn't finish",
  body: "Something went wrong while connecting your store, and we don't have a more specific explanation for it. Opening Peakhour from your Shopify admin is the quickest way to pick up where this left off.",
};

/**
 * ★NOTHING FROM THE URL IS ECHOED AS PROSE. This route is public,
 * unauthenticated, and now linked from an install flow — so any text it repeated
 * back would be Peakhour-branded copy written by whoever composed the link
 * ("Your store was suspended, call +1-555-0100"). An earlier draft printed the
 * raw `error` value and the raw `shop`; both were a phishing surface handed out
 * for free.
 *
 * So the error param selects from copy WE wrote, and the shop is shown only if
 * it is really a Shopify domain — displayed to reassure the merchant they are in
 * the right place, which is only reassuring if it cannot be forged into
 * something else.
 */
const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]{0,59}\.myshopify\.com$/i;

export function ShopifyConnectStatus() {
  const params = useSearchParams();
  const rawError = (params.get("error") ?? "").trim();
  const rawShop = (params.get("shop") ?? "").trim();
  const shop = SHOP_DOMAIN.test(rawShop) ? rawShop.toLowerCase() : "";
  /**
   * ★A `token` HERE MEANS AUTO-PROVISIONING FAILED. The API mints one only on
   * the degraded path, where an install could not be turned into an account and
   * a pending row was parked instead. No client can spend it any more — and
   * inventing one would rebuild the wizard this page exists to replace. So its
   * presence is never displayed; it changes what the page ADVISES, because
   * reinstalling is what actually clears that state.
   */
  const stalled = !!(params.get("token") ?? "").trim();

  const err = rawError ? (ERRORS.get(rawError) ?? UNKNOWN_ERROR) : null;

  /**
   * ★THE NO-PARAMS CASE IS NOT "NOTHING HAPPENED". A bare `/shopify/connect` is
   * where `GET /shopify/reconnect` lands every one of its failure exits — an
   * unverifiable session token, an unlinked store, a transient error. Telling
   * that merchant there is nothing to do here would be the page's one wrong
   * answer, because their reconnect just failed.
   */
  const heading = err
    ? err.title
    : stalled
      ? "Your store needs one more step"
      : "Finish in your Shopify admin";

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
          <CardTitle>{heading}</CardTitle>
          <CardDescription>{shop || "Peakhour for Shopify"}</CardDescription>
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
              If you were connecting or reconnecting your store, that didn&apos;t finish. Everything
              Peakhour needs happens inside the Shopify admin, so that is where to pick it up.
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
              <li>If we need you to link an existing Peakhour account, the app will ask you there.</li>
            </ol>
          </div>

          <p>
            Peakhour can only read your store from inside the Shopify admin, so this page has no way
            to connect it for you.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            {/* ★A mailto, NOT a route. Every internal page except this one is
                rewritten to the teaser while COMING_SOON is on — which is the
                only condition under which this page's own exemption matters. A
                "Get help" button that lands on "coming soon" is worse than no
                button, and email works in every state this page can be reached
                in. */}
            <Button asChild variant="outline">
              <a
                href={`mailto:${SITE.contactGeneral}?subject=${encodeURIComponent(
                  "Shopify install didn't finish",
                )}`}
              >
                Email us
              </a>
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
