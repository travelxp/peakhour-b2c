import { Suspense } from "react";
import { ShopifyConnectStatus } from "./_components/shopify-connect-status";

/**
 * /shopify/connect?error=<code>&shop=<domain>&token=<linkToken>
 *
 * ★THIS ROUTE EXISTED, WAS DELETED, AND IS STILL BEING LINKED TO. The 576-line
 * account-linking wizard that used to live here went with the embedded app in
 * b2c#384 (2026-07-10) — correctly, because Shopify-managed install now provisions
 * the account automatically and the embedded app's own claim gate handles linking.
 * What did not go with it: twenty redirects in peakhour-api still point here, from
 * every fresh-install HMAC/misconfig/shop-mismatch failure and every reconnect
 * fallback. Each has been a 404 on the dashboard domain for a month, at the exact
 * moment a merchant is already having a bad time.
 *
 * ★SO THIS IS NOT THE WIZARD, DELIBERATELY. Rebuilding it would restore a flow
 * that the platform has replaced and that the team has locked a decision against
 * ("managed install, NEVER legacy"). What a merchant needs on these paths is the
 * truth and one working next step, and the working next step really is "open
 * Peakhour from your Shopify admin" — that is the path that provisions, links and
 * recovers. The page says that, and says what went wrong on the way here.
 */
export default function ShopifyConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center justify-center px-4 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ShopifyConnectStatus />
    </Suspense>
  );
}
