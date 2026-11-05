"use client";

import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
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
import { api } from "@/lib/api";
import { presenceApi } from "@/lib/api/presence";
import { Skeleton } from "@/components/ui/skeleton";
import { connectedNetworks, locationSwitcher, networkSwitcher, presenceCapabilitiesQueryKey } from "@/lib/presence-panels";

/**
 * Presence pillar home. The local-presence cockpit — keep a business found,
 * accurate, and well-reviewed everywhere.
 *
 * ★NO NETWORK IS NAMED HERE (PE-EC). The connect cards, the network switcher and every panel's words come from the networks the api
 * lists at `/v1/presence/capabilities` and from each listing's `networks[]`, so a network added as an adapter shows up with no edit.
 *
 * ★THE SWITCHER OFFERS THE NETWORKS THE MERCHANT IS CONNECTED ON, and its default is the api's own default connection, read from the
 * default listing answer. An unconnected network stays a connect card. Nothing below the cards is read until the capabilities and the
 * connection statuses have settled, so no panel flashes one network and then another or reads twice.
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
  // Every network a merchant can connect, from the adapters' declarations: one card each.
  const capsQ = useQuery({
    queryKey: presenceCapabilitiesQueryKey,
    queryFn: () => presenceApi.capabilities(),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const networks = capsQ.data?.items ?? [];
  // The same keys and reads the connect cards make, so these are shared with them, not repeated.
  const statusQs = useQueries({
    queries: networks.map((n) => ({
      queryKey: ["integration-status", n.network],
      queryFn: () => api.get<{ status?: string }>(`/v1/integrations/${n.network}/status`),
      refetchOnWindowFocus: false,
    })),
  });
  const statusOf = (network: string) => statusQs[networks.findIndex((n) => n.network === network)]?.data?.status;
  const baseReady = !capsQ.isPending && statusQs.every((q) => !q.isPending);
  const connected = connectedNetworks(networks, statusOf);
  // The api's own default connection, from the default listing answer: asked once, and only when there is a choice to make.
  const defaultQ = useListingQuery(undefined, undefined, baseReady && connected.length >= 2);
  const panelsReady = baseReady && (connected.length < 2 || !defaultQ.isPending);
  const netSwitcher = networkSwitcher(connected, chosenNetwork, defaultQ.data?.connection?.network);
  // With a switcher the choice is always sent; with fewer than two connected networks the api's default is the only answer.
  const panelNetwork = netSwitcher?.value;
  // The network the panels are about, for its words and its declarations before any listing has answered.
  const aboutNetwork = netSwitcher
    ? connected.find((n) => n.network === netSwitcher.value)
    : connected.length === 1
      ? connected.at(0)
      : networks.length === 1
        ? networks.at(0)
        : undefined;
  const fallbackLabel = aboutNetwork?.label ?? null;
  // Review cards draw only for a network that declares reviews (no declaration to go by, as on an older api, draws them).
  const reviewsOn = aboutNetwork ? aboutNetwork.capabilities.reviews !== false : true;
  // The list of listings always comes from the default read of that network, so a stale choice (a
  // listing since removed) can never ask the api for a place it refuses: the switcher
  // falls back to the first listing instead.
  const listAnswer = useListingQuery(undefined, panelNetwork, panelsReady);
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

        {capsQ.isPending ? <Skeleton className="h-24 w-full" /> : null}
        {networks.map((n) => (
          <NetworkConnectCard key={n.network} network={n} />
        ))}
        {capsQ.isError && !capsQ.data ? (
          <p className="text-sm text-muted-foreground">
            We couldn&rsquo;t load the networks you can connect just now. Reload to try again.
          </p>
        ) : null}

        {!panelsReady ? (
          <div className="space-y-8" aria-busy="true">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : (
          <>
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

            {reviewsOn ? <ReviewSummaryCard location={location} network={panelNetwork} label={fallbackLabel} /> : null}

            {reviewsOn ? <ReviewKitCard location={location} network={panelNetwork} /> : null}

            <ListingScoreCard
              location={panelLocation}
              network={panelNetwork}
              onOpenForm={(field) => {
                setEditRequest({ field });
                document.getElementById("edit-listing")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />

            <ListingPanel location={panelLocation} network={panelNetwork} label={fallbackLabel} />

            <div id="edit-listing">
              <EditListingCard location={panelLocation} network={panelNetwork} request={editRequest} />
            </div>

            <InsightsPanel location={panelLocation} network={panelNetwork} label={fallbackLabel} />
          </>
        )}
      </div>
    </FeatureGate>
  );
}
