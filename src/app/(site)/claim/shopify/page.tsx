import { Suspense } from "react";
import { ShopifyClaim } from "./_components/shopify-claim";
import { LoadingScreen } from "@/components/molecules/loading-screen";
import { FlowCard, FlowPage } from "@/components/marketing/flow/flow-kit";

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
        <FlowPage>
          <FlowCard>
            <h1 className="sr-only">Claim your Shopify store</h1>
            <LoadingScreen message="Loading your store…" className="min-h-40 p-4" />
          </FlowCard>
        </FlowPage>
      }
    >
      <ShopifyClaim />
    </Suspense>
  );
}
