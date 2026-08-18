import { Suspense } from "react";
import { getPublicCatalog } from "@/lib/catalog";
import {
  getPricing,
  minFreePeaksPerMonth,
  formatPeaks,
  FREE_PEAKS_FALLBACK,
} from "@/lib/pricing";
import { AuthFlow } from "./auth-flow";

/**
 * Server shell for the sign-in page.
 *
 * Its only job is to resolve the platform signup mode before the client flow
 * renders. That matters because the page makes a promise — "Live the same
 * day" — that is false while signups are gated, and the mode is the only
 * honest source for whether to make it.
 *
 * The obvious shortcut is to read `?intent=waitlist|invite`, which the landing
 * CTAs already append. It doesn't hold: `signupCta` omits the param for
 * `closed`, and the header's "Sign in" link is a bare `/auth` on every
 * marketing page, so the most common pre-launch arrival carries no intent at
 * all. `intent` still drives the heading wording — it says which button the
 * visitor pressed — but it can't be trusted to say what the platform is doing.
 *
 * Mirrors how `components/shared/header.tsx` resolves the same value.
 */
export default async function AuthPage() {
  // In parallel — these are two independent endpoints, and awaiting them in
  // sequence costs a second round trip on a cold cache.
  const [catalog, pricing] = await Promise.all([
    getPublicCatalog(),
    // "DEFAULT" is not a sentinel the API honours — it fails the two-letter
    // validation and the response comes back geo-resolved. We pass it purely
    // to pin one cache key, and read only `peaksIncluded`, which is a
    // plan-level allowance and country-independent. Never read a price here.
    getPricing("DEFAULT"),
  ]);
  const signupMode = catalog?.platform?.signupMode ?? "open";
  const freePeaks = formatPeaks(minFreePeaksPerMonth(pricing) ?? FREE_PEAKS_FALLBACK);

  return (
    // useSearchParams() must sit inside a Suspense boundary (App Router). A
    // minimal fallback filling the same space avoids a blank prerender flash
    // on this entry flow before the client fills in the heading.
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <div
            className="size-6 animate-spin rounded-full border-2 border-muted border-t-brand"
            aria-hidden
          />
          <span className="sr-only">Loading</span>
        </div>
      }
    >
      <AuthFlow signupMode={signupMode} freePeaks={freePeaks} />
    </Suspense>
  );
}
