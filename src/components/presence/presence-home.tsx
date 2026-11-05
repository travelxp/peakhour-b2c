"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { NetworkConnectCard } from "@/components/presence/network-connect-card";
import { ReviewSummaryCard } from "@/components/presence/review-summary-card";
import { ListingPanel } from "@/components/presence/listing-panel";
import { ListingScoreCard } from "@/components/presence/listing-score-card";
import { EditListingCard, type EditRequest } from "@/components/presence/edit/edit-listing-card";
import { InsightsPanel } from "@/components/presence/insights-panel";
import { ReviewKitCard } from "@/components/presence/review-kit-card";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { presenceApi } from "@/lib/api/presence";
import { locationSwitcher, networkSwitcher, presenceCapabilitiesQueryKey } from "@/lib/presence-panels";

/**
 * Presence pillar home. The local-presence cockpit — keep a business found,
 * accurate, and well-reviewed everywhere.
 *
 * ★NO NETWORK IS NAMED HERE (PE-EC). The connect cards, the network switcher and every panel's words come from the networks the api
 * lists at `/v1/presence/capabilities` and from each listing's `networks[]`, so a network added as an adapter shows up with no edit.
 *
 * Gated on `presence.nav` (free pillar).
 *
 * ★★THE COMING_SOON STATE IS GONE, BECAUSE IT STOPPED BEING HONEST. Google
 * approved Business Profile API access on 2026-08-21 and the provider is
 * `available` — this page was telling merchants to wait for something they
 * could already do. The connect card is now real (see `NetworkConnectCard`), and
 * it carries the step that actually blocks a multi-location merchant: choosing
 * WHICH listing this business is.
 *
 * ★THE LISTING AND INSIGHTS PANELS ARE REAL NOW (PE-04a), so the "Coming with
 * Presence" section is gone with them. A merchant changes the listing here
 * through `EditListingCard` (PE-07); a listing-score fix opens the same form.
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
  // ★A PAGE CHOICE, NOT A SESSION PIN. The session pins one organisation and one
  // business; which of that business's listings this page describes is the
  // merchant's choice here, and it resets with the page.
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const [chosenNetwork, setChosenNetwork] = useState<string | undefined>(undefined);
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  // Every network a merchant can connect, from the adapters' declarations: one card each, and a switcher when there is a choice.
  const capsQ = useQuery({
    queryKey: presenceCapabilitiesQueryKey,
    queryFn: () => presenceApi.capabilities(),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const networks = capsQ.data?.items ?? [];
  const netSwitcher = networkSwitcher(networks, chosenNetwork);
  // The first network is the api's default, so only a different choice is sent.
  const panelNetwork = netSwitcher && !netSwitcher.isDefault ? netSwitcher.value : undefined;
  // The list of listings always comes from the default read, so a stale choice (a
  // listing since removed) can never ask the api for a place it refuses: the switcher
  // falls back to the first listing instead.
  const listAnswer = useListingQuery(undefined, panelNetwork);
  const switcher = locationSwitcher(listAnswer.data?.connection?.locations, chosen);
  // Panels follow the switcher only when it is shown; a one-listing business is read as before.
  const location = switcher?.value;
  // The listing and insights panels share the default read's cache unless another listing is chosen.
  const panelLocation = switcher && !switcher.isDefault ? switcher.value : undefined;

  return (
    <FeatureGate feature="presence.nav" featureName="Presence" mode="hide">
      <div className="mx-auto w-full max-w-5xl space-y-8 p-4 md:p-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wide">Presence</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Your listing and reviews, in one place
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            See your listing, how customers use it, and your reviews.
            You can prepare changes to your listing here. A person approves each one before it is sent.
          </p>
        </header>

        {networks.map((n) => (
          <NetworkConnectCard key={n.network} network={n} />
        ))}
        {capsQ.isError && !capsQ.data ? (
          <p className="text-sm text-muted-foreground">
            We couldn&rsquo;t load the networks you can connect just now. Reload to try again.
          </p>
        ) : null}

        {netSwitcher ? (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="presence-network" className="text-sm font-medium">
              Network
            </label>
            <select
              id="presence-network"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={netSwitcher.value}
              onChange={(e) => {
                setChosenNetwork(e.target.value);
                // a listing of one network is not a listing of another
                setChosen(undefined);
              }}
            >
              {netSwitcher.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              The listing, reviews and insights below are for this network. Figures are never added across networks.
            </span>
          </div>
        ) : null}

        {switcher ? (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="presence-location" className="text-sm font-medium">
              Listing
            </label>
            <select
              id="presence-location"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={switcher.value}
              onChange={(e) => setChosen(e.target.value)}
            >
              {switcher.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              Listing, reviews and insights show this one listing. Figures are never added across listings.
            </span>
          </div>
        ) : null}

        <ReviewSummaryCard location={location} network={panelNetwork} />

        <ReviewKitCard location={location} />

        <ListingScoreCard
          location={panelLocation}
          network={panelNetwork}
          onOpenForm={(field) => {
            setEditRequest({ field });
            document.getElementById("edit-listing")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />

        <ListingPanel location={panelLocation} network={panelNetwork} />

        <div id="edit-listing">
          <EditListingCard location={panelLocation} network={panelNetwork} request={editRequest} />
        </div>

        <InsightsPanel location={panelLocation} network={panelNetwork} />
      </div>
    </FeatureGate>
  );
}
