import { Suspense } from "react";
import { FlowCard, FlowPage } from "@/components/marketing/flow/flow-kit";
import { WordpressClaim } from "./_components/wordpress-claim";

/**
 * /claim/wordpress?site=<id>&t=<token>
 * Landing the WordPress plugin's "Claim" link points at. The merchant signs in
 * (if needed), then attaches their silently-connected site to a real Peakhour
 * account via the account chooser. The token rides in the body of the api calls,
 * not onward URLs. Wrapped in Suspense because the client component reads
 * useSearchParams.
 */
export default function WordpressClaimPage() {
  return (
    <Suspense
      fallback={
        <FlowPage>
          <FlowCard>
            <h1 className="sr-only">Connect your WordPress site</h1>
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          </FlowCard>
        </FlowPage>
      }
    >
      <WordpressClaim />
    </Suspense>
  );
}
