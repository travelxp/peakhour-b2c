"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const params = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const token = params.get("t") ?? "";

  // Same-origin relative only, mirroring the sign-in page's guard: a single
  // leading slash, no protocol-relative form (browsers normalise "\" to "/").
  const next = (() => {
    const raw = params.get("next");
    return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")
      ? raw
      : null;
  })();

  // A missing token is knowable at RENDER time, so it is derived rather than
  // set from the effect — the same shape the store-claim page uses, and what
  // keeps setState out of the effect body (cascading-render lint rule).
  const missingToken = !token;
  const [failed, setFailed] = useState(false);
  // A token is single-use: React 18 StrictMode double-invokes effects in dev,
  // and a second POST would spend a token that the first already consumed and
  // then report failure for a sign-in that actually worked.
  const spent = useRef(false);

  useEffect(() => {
    if (missingToken) return;
    if (spent.current) return;
    spent.current = true;

    let cancelled = false;
    redeemShopifyHandoff(token)
      .then(async (res) => {
        if (cancelled) return;
        // The api set the session cookies on that response; pull the user into
        // context before navigating so the dashboard doesn't render a signed-out
        // frame and bounce.
        await refreshUser().catch(() => {
          /* the cookies are set either way — the dashboard re-fetches */
        });
        if (cancelled) return;
        router.replace(next ?? res.redirectTo ?? "/dashboard");
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [missingToken, token, next, router, refreshUser]);

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
