import { Suspense } from "react";
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
        <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center justify-center px-4 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <WordpressReconnect />
    </Suspense>
  );
}
