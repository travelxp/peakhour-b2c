"use client";

import { MapPin, BarChart3, MessageSquareText } from "lucide-react";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { GbpConnectCard } from "@/components/presence/gbp-connect-card";
import { ReviewSummaryCard } from "@/components/presence/review-summary-card";

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
 * ★THE SURFACES BELOW ARE STILL UNBUILT and are labelled as such. The
 * listing editor and the insights charts land with the storage and read PRs;
 * describing them in the present tense here while nothing renders them is the
 * same mistake in a different place.
 *
 * ★★AND REVIEWS HAS COME OFF THAT LIST, WHICH IS THE SAME RULE RUN BACKWARDS.
 * The lane is built (S0·4: a reply published to the listing from the Inbox)
 * and so is this summary (S0·5), so leaving it under 'Coming with Presence'
 * would understate the product exactly as the old `coming_soon` badge on the
 * connect card overstated the wait.
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
            Be found, accurate &amp; well-reviewed everywhere
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            One record you edit once — synced across Google, maps, and listing
            networks — with every review in one inbox and your local performance
            in one dashboard. Anchored on Google Business Profile.
          </p>
        </header>

        <GbpConnectCard />

        <ReviewSummaryCard />

        {/* ★STILL COMING, AND LABELLED. Moving "coming soon" off the connect
            card and onto the things that genuinely are not built is the point:
            the badge was on the one part that works. */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Coming with Presence
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <FeatureCard
              icon={<MapPin className="h-5 w-5" />}
              title="Listings"
              body="Edit your name, hours, categories, and photos once — we keep them in sync across every network and flag drift."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Insights"
              body="Calls, direction requests, website clicks, and profile views — day by day, with 'Explain this' narration."
            />
          </div>
        </section>

        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquareText className="h-4 w-4" />
          Later: update your listing from WhatsApp — even by voice note.
        </p>
      </div>
    </FeatureGate>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="font-medium">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
