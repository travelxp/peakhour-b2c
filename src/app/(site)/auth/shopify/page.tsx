import { Suspense } from "react";
import { ShopifyHandoff } from "./_components/shopify-handoff";
import { LoadingScreen } from "@/components/molecules/loading-screen";

/**
 * /auth/shopify?t=<token>&next=<path>
 *
 * Where "Open Peakhour Dashboard" lands a merchant who has ALREADY completed one
 * email sign-in from this Shopify store. The embedded app asked the api for a
 * link; the api found a mapping for this Shopify staff user and minted a
 * single-use, minutes-lived token instead of sending them to type an address
 * they have typed before.
 *
 * The token rides in the request BODY, never onward in a URL. Wrapped in
 * Suspense because the client component reads useSearchParams.
 */
export default function ShopifyHandoffPage() {
  return (
    <Suspense fallback={<LoadingScreen fullScreen message="Signing you in…" />}>
      <ShopifyHandoff />
    </Suspense>
  );
}
