"use client";

import { MapPin, MessageSquareText } from "lucide-react";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { GbpConnectCard } from "@/components/presence/gbp-connect-card";
import { ReviewSummaryCard } from "@/components/presence/review-summary-card";
import { ListingPanel } from "@/components/presence/listing-panel";
import { InsightsPanel } from "@/components/presence/insights-panel";

/**
 * Presence pillar home. The local-presence cockpit — keep a business found,
 * accurate, and well-reviewed everywhere, anchored on Google Business Profile.
 *
 * Gated on `presence.nav` (free pillar).
 *
 * ★★THE COMING_SOON STATE IS GONE, BECAUSE IT STOPPED BEING HONEST. Google
 * approved Business Profile API access on 2026-08-21 and the provider is
 * `available` — this page was telling merchants to wait for something they
 * could already do. The connect card is now real (see `GbpConnectCard`), and
 * it carries the step that actually blocks a multi-location merchant: choosing
 * WHICH listing this business is.
 *
 * ★THE LISTING AND INSIGHTS PANELS ARE REAL NOW (PE-04a), so the "Coming with
 * Presence" section is gone with them. What is NOT built is any way to change
 * the listing from here, and the header says only what the page does today.
 *
 * ★REVIEWS CAME OFF THAT LIST FIRST (S0·4 reply, S0·5 summary), for the same
 * reason: leaving a built thing under 'coming' understates the product exactly
 * as an old badge overstated the wait.
 *
 * ⚠️THE FIGURES ARE ALL ABSENT TODAY. No `google_review` row exists for
 * anybody until the Pub/Sub topic is provisioned (S0·1), so the card renders
 * its empty state — which says nothing has reached US, never that the
 * merchant has no reviews.
 */
export function PresenceHome() {
  return (
    <FeatureGate feature="presence.nav" featureName="Presence" mode="hide">
      <div className="mx-auto w-full max-w-5xl space-y-8 p-4 md:p-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wide">Presence</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Your Google listing and reviews, in one place
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            See your Google listing, how customers use it, and your Google
            reviews. To change your listing, use Google for now.
          </p>
        </header>

        <GbpConnectCard />

        <ReviewSummaryCard />

        <ListingPanel />

        <InsightsPanel />

        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquareText className="h-4 w-4" />
          Later: update your listing from WhatsApp — even by voice note.
        </p>
      </div>
    </FeatureGate>
  );
}
