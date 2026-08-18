import { Suspense } from "react";
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
        <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center justify-center px-4 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <WordpressClaim />
    </Suspense>
  );
}
