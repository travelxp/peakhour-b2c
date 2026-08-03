"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ShoppingBag } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingScreen } from "@/components/molecules/loading-screen";
import { redeemShopifyHandoff } from "@/lib/auth";

/**
 * Spend a one-time Shopify dashboard-handoff token and land the merchant inside
 * the dashboard, signed in, having typed nothing.
 *
 * The token is the whole proof — this page runs in a browser with no peakhour.ai
 * session, which is the entire reason the token exists. It is single-use and
 * lives for minutes, and the api re-checks at spend time that the store still
 * exists and that the user still belongs to its org (a mapping recorded weeks
 * ago is not a standing grant).
 *
 * Every failure lands on the same place: an ordinary sign-in. Nothing here is
 * worth trapping a merchant over — the fallback costs them one emailed link.
 */
export function ShopifyHandoff() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  /**
   * The token arrives in the FRAGMENT, not the query — a fragment is never sent
   * to a server, so a bearer-equivalent secret stays out of the b2c edge log,
   * any WAF in front of it, and anything else that records URLs.
   *
   * ★READ VIA useSyncExternalStore SO THE SERVER SNAPSHOT IS `null`, NOT "".
   * The server cannot see a fragment, so a server pass that treated an empty
   * hash as "no token" would ship the red "that link has expired" card as the
   * static HTML of a page that is about to succeed — every merchant, every
   * working link, plus a hydration mismatch when the client disagreed. `null`
   * means "not knowable yet" and renders the loading state, which is also
   * exactly what the first client paint shows.
   */
  const subscribeToNothing = useCallback(() => () => {}, []);
  const hash = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.hash.slice(1),
    () => null,
  );
  const frag = new URLSearchParams(hash ?? "");
  const token = frag.get("t") ?? "";

  // Same-origin relative only. Mirrors the api's sanitizeDashboardPath rather
  // than the looser client-side copies: the fragment is fully attacker-supplied,
  // so this rejects control characters and a scheme as well as the
  // protocol-relative forms (browsers normalise "\" to "/", so "/\host"
  // resolves to "//host").
  const next = (() => {
    const raw = frag.get("next");
    if (!raw || raw.length > 512) return null;
    if (!raw.startsWith("/") || raw.startsWith("//")) return null;
    if (raw.includes("://")) return null;
    if (/[\u0000-\u0020\\]/.test(raw)) return null;
    return raw;
  })();

  // A missing token is knowable at RENDER time, so it is derived rather than
  // set from the effect — the same shape the store-claim page uses, and what
  // keeps setState out of the effect body (cascading-render lint rule).
  // `null` is "the hash isn't readable yet" (server / pre-hydration), which is
  // NOT the same as "there is no token" and must not render the failure card.
  //
  // ...and neither is "" AFTER we stripped the hash ourselves. useSyncExternalStore
  // re-reads on every render, and a render IS guaranteed while the redeem is in
  // flight — AuthProvider's own mount /me resolves and setStates. Without the
  // `spent` guard the merchant would watch "That link has expired", with a
  // button that abandons a sign-in about to succeed, for the whole round-trip.
  const [failed, setFailed] = useState(false);
  // A token is single-use, and StrictMode double-invokes effects in dev: a
  // second POST would spend nothing and report failure for a sign-in that
  // worked. The ref alone is the single-shot guarantee — deliberately WITHOUT a
  // per-run `cancelled` flag, because StrictMode's first cleanup would set it on
  // the only in-flight request and the page would then spin forever having
  // already signed the merchant in.
  const spent = useRef(false);

  // `null` is "the hash isn't readable yet" (server / pre-hydration), which is
  // NOT the same as "there is no token" and must not render the failure card.
  const missingToken = hash !== null && !token;

  useEffect(() => {
    if (hash === null || !token || spent.current) return;
    spent.current = true;

    // ★STRIPPED AFTER THE REQUEST, NOT BEFORE. useSyncExternalStore re-reads the
    // hash on EVERY render, and a render is guaranteed mid-redeem — AuthProvider's
    // own mount /me resolves and setStates while the POST is in flight. Clearing
    // the hash first would make the next render see "" (which is not null), flip
    // `missingToken`, and paint "That link has expired" over a sign-in that is
    // about to succeed — with a button that abandons it. The token is spent by
    // then, so the address bar is cleaned a moment later and loses nothing.
    const stripHash = () =>
      window.history.replaceState(null, "", window.location.pathname + window.location.search);

    redeemShopifyHandoff(token)
      .then(async (res) => {
        stripHash();
        // The api set the session cookies on that response; pull the user into
        // context before navigating so the dashboard doesn't render a signed-out
        // frame and bounce.
        await refreshUser().catch(() => {
          /* the cookies are set either way — the dashboard re-fetches */
        });
        router.replace(next ?? res.redirectTo ?? "/dashboard");
      })
      .catch(() => {
        stripHash();
        setFailed(true);
      });
  }, [hash, token, next, router, refreshUser]);

  if (!failed && !missingToken) {
    return <LoadingScreen fullScreen message="Signing you in…" />;
  }

  // Expired, already spent, or a store/membership that no longer checks out.
  // None of those are worth explaining in detail to a merchant — the way
  // forward is the same in every case.
  const signInHref = next ? `/auth?next=${encodeURIComponent(next)}` : "/auth";
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" aria-hidden />
            Sign in to Peakhour
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertCircle className="size-5" aria-hidden />
            That link has expired
          </div>
          <p className="text-sm text-muted-foreground">
            Sign-in links from your Shopify admin are single-use and last a few minutes. Sign in
            here, or reopen Peakhour in Shopify and try again.
          </p>
          <Button asChild>
            <Link href={signInHref}>Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
