"use client";

import Link from "next/link";
import { MapPin, Star, BarChart3, MessageSquareText, ArrowRight } from "lucide-react";
import { FeatureGate } from "@/components/upgrade/feature-gate";

/**
 * Presence pillar home. The local-presence cockpit — keep a business found,
 * accurate, and well-reviewed everywhere, anchored on Google Business Profile.
 *
 * Gated on `presence.nav` (free pillar). The live surfaces (listing editor,
 * insights charts, reviews inbox) light up once Google approves API access and
 * the GBP connector flips live; until then this renders an honest coming_soon
 * state with the value proposition + a link to connect.
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

        {/* Connect card — coming_soon until Google API access lands. */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: "#34A853" }}
              >
                <MapPin className="h-6 w-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">Google Business Profile</h2>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Coming soon
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connecting your Business Profile is almost here — available as
                  soon as Google approves our Business Profile API access.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/integrations"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              View in Integrations
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* What's coming — the three surfaces. */}
        <section className="grid gap-4 md:grid-cols-3">
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
        </section>

        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquareText className="h-4 w-4" />
          Coming with Presence: update your listing from WhatsApp — even by voice note.
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
