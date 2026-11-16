import { Suspense } from "react";
import { FlowCard, FlowPage } from "@/components/marketing/flow/flow-kit";
import { WordpressReconnect } from "./_components/wordpress-reconnect";

/**
 * /reconnect/wordpress?site=<id>
 * Landing the WordPress plugin's "Reconnect on Peakhour.ai" link points at, after
 * a reinstalled-but-already-claimed site files a pending reconnect. The signed-in
 * owner enters the pairing code shown in their plugin to re-establish the link.
 * Wrapped in Suspense because the client component reads useSearchParams.
 */
export default function WordpressReconnectPage() {
  return (
    <Suspense
      fallback={
        <FlowPage>
          <FlowCard>
            <h1 className="sr-only">Reconnect your WordPress site</h1>
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          </FlowCard>
        </FlowPage>
      }
    >
      <WordpressReconnect />
    </Suspense>
  );
}
