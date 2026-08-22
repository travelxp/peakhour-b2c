"use client";

import { MapPin, Star, BarChart3, MessageSquareText } from "lucide-react";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { GbpConnectCard } from "@/components/presence/gbp-connect-card";

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
 * ★THE THREE SURFACES BELOW ARE STILL UNBUILT and are labelled as such. The
 * listing editor, the reviews inbox and the insights charts land with the
 * storage and read PRs; describing them in the present tense here while
 * nothing renders them is the same mistake in a different place.
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

        {/* ★STILL COMING, AND LABELLED. Moving "coming soon" off the connect
            card and onto the things that genuinely are not built is the point:
            the badge was on the one part that works. */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Coming with Presence
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <FeatureCard
              icon={<MapPin className="h-5 w-5" />}
              title="Listings"
              body="Edit your name, hours, categories, and photos once — we keep them in sync across every network and flag drift."
            />
            <FeatureCard
              icon={<Star className="h-5 w-5" />}
              title="Reviews"
              body="Every review lands in one inbox with an AI-drafted reply a tap away — negative reviews jump the queue."
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
