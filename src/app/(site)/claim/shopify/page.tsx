import { Suspense } from "react";
import { ShopifyClaim } from "./_components/shopify-claim";

/**
 * /claim/shopify?store=<connId>&t=<token>
 * Landing the embedded app's "Claim this store" button points at. The merchant
 * signs in (if needed), then adopts their cold-installed store into a real
 * Peakhour account — attaching it to an existing brand or moving it in as a new
 * Business. The token rides in the body of the api calls, not onward URLs.
 * Wrapped in Suspense because the client component reads useSearchParams.
 */
export default function ShopifyClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center justify-center px-4 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ShopifyClaim />
    </Suspense>
  );
}
