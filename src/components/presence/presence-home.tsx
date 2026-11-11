"use client";

import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { NetworkConnectCard } from "@/components/presence/network-connect-card";
import { ReviewSummaryCard } from "@/components/presence/review-summary-card";
import { ReviewPlacesCard } from "@/components/presence/review-places-card";
import { reviewsPlaceIn, wantsPlacesView } from "@/lib/review-places";
import { ListingPanel } from "@/components/presence/listing-panel";
import { ListingScoreCard } from "@/components/presence/listing-score-card";
import { EditListingCard, type EditRequest } from "@/components/presence/edit/edit-listing-card";
import { PublishingStatus } from "@/components/presence/publishing-status";
import { PhotosCard } from "@/components/presence/edit/photos-card";
import { PostsCard } from "@/components/presence/edit/posts-card";
import { ServicesCard } from "@/components/presence/edit/services-card";
import { DetailsCard } from "@/components/presence/edit/details-card";
import { LinksCard } from "@/components/presence/edit/links-card";
import { InsightsPanel } from "@/components/presence/insights-panel";
import { ReviewKitCard } from "@/components/presence/review-kit-card";
import { useListingQuery } from "@/hooks/use-presence-listing";
import { api } from "@/lib/api";
import { presenceApi } from "@/lib/api/presence";
import { Skeleton } from "@/components/ui/skeleton";
import { connectedNetworks, unreadableNetworks, drawsListing, drawsReviews, locationSwitcher, networkSwitcher, presenceCapabilitiesQueryKey } from "@/lib/presence-panels";
import { drawsPhotos } from "@/lib/presence-photos";

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
/** Said, not dropped: a network whose connection status could not be read is not in the choices, and nothing else would say why. */
export function UnreadableNote({ networks }: { networks: readonly { label: string }[] }) {
  if (networks.length === 0) return null;
  return (
    <p className="text-sm text-muted-foreground" role="status">
      We couldn&rsquo;t check whether {networks.map((n) => n.label).join(", ")} is connected just now, so it is left out of the choices below. Reload to try again.
    </p>
  );
}

/** The location select's value for "every location" (never a place reference). */
const ALL_LOCATIONS = "__all__";

export function PresenceHome() {
  // ★A PAGE CHOICE, NOT A SESSION PIN. The session pins one organisation and one
  // business; which of that business's listings this page describes is the
  // merchant's choice here, and it resets with the page.
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const [chosenNetwork, setChosenNetwork] = useState<string | undefined>(undefined);
  // ★THE REVIEWS' OWN SCOPE (PE-R): every location (undefined) or one place. It is NOT the listing select's value: that one means "which
  // listing" for the listing, score, edit forms, photos and insights, and nothing there may ever read as applying to "all locations".
  const [reviewsPicked, setReviewsPicked] = useState<string | undefined>(undefined);
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  // One way to open a field's editor, for the score card's fixes and the requests list's "Make the change again".
  const openForm = (field: string) => {
    // A photos fix opens the photos panel, not a form.
    if (field === "media") {
      document.getElementById("photos-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setEditRequest({ field });
    document.getElementById("edit-listing")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
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
  // The network the panels are about, for its words and its declarations before any listing has answered: the switcher's choice, else the one
  // connected network, else the only network there is.
  const soleNetwork = connected.length === 1 ? connected.at(0) : networks.length === 1 ? networks.at(0) : undefined;
  const aboutNetwork = netSwitcher ? connected.find((n) => n.network === netSwitcher.value) : soleNetwork;
  // ★THE PANELS READ THE NETWORK THE PAGE JUDGES. With a switcher the choice is sent; with one network the api's default would be that
  // network anyway, but it is sent by name so the declarations applied below and the answers read are for the same network.
  const panelNetwork = aboutNetwork?.network;
  const fallbackLabel = aboutNetwork?.label ?? null;
  // Each card draws only for a network that declares what it shows (no declaration to go by, as on an older api, draws them).
  const reviewsOn = drawsReviews(aboutNetwork);
  // The listing, score and edit panels draw only for a network that declares a listing (a reviews-only network has none to show).
  const listingOn = drawsListing(aboutNetwork);
  // The edit card needs a network that can be written.
  const editOn = listingOn && aboutNetwork?.capabilities.edit !== false;
  // The photos panel draws only for a network that DECLARES photos (PE-11).
  const photosOn = listingOn && drawsPhotos(aboutNetwork);
  // Figures: the panel judges the network's declaration itself (off the listing entry, else the connect declaration handed to it below).
  // A status read that failed is said, not dropped: that network is not in the switcher, and nothing else says why.
  const unreadable = unreadableNetworks(networks, statusQs);
  // The list of listings always comes from the default read of that network, so a stale choice (a
  // listing since removed) can never ask the api for a place it refuses: the switcher
  // falls back to the first listing instead.
  const listAnswer = useListingQuery(undefined, panelNetwork, panelsReady);
  const switcher = locationSwitcher(listAnswer.data?.connection?.locations, chosen);
  // the reviews' own place, if it is still one the business has
  const reviewsPlace = reviewsPlaceIn(switcher?.options, reviewsPicked);
  // Panels follow the switcher only when it is shown; a one-listing business is read as before.
  const location = switcher?.value;
  // The listing and insights panels share the default read's cache unless another listing is chosen.
  const panelLocation = switcher && !switcher.isDefault ? switcher.value : undefined;

  return (
    <FeatureGate feature="presence.nav" featureName="Presence" mode="hide">
      <PageShell width="standard" className="space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wide">Presence</span>
          </div>
          <PageHeader
            title="Your listing and reviews, in one place"
            description="See your listing, how customers use it, and your reviews. You can prepare changes to your listing here. A person approves each one before it is sent."
          />
        </div>

        {capsQ.isPending ? <Skeleton className="h-24 w-full" /> : null}
        {networks.map((n) => (
          <NetworkConnectCard key={n.network} network={n} />
        ))}
        {capsQ.isError && !capsQ.data ? (
          <p className="text-sm text-muted-foreground">
            We couldn&rsquo;t load the networks you can connect just now. Reload to try again.
          </p>
        ) : null}

        <UnreadableNote networks={unreadable} />

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
                    setReviewsPicked(undefined);
                    // a form opened for one network's listing is not a request for another's
                    setEditRequest(null);
                  }}
                >
                  {netSwitcher.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  Everything below is for this network. Figures are never added across networks.
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
                  The listing, score, edit forms, photos, insights and review link below show this one listing. Figures are never added across listings.
                </span>
              </div>
            ) : null}

            {/* ★WAIT FOR THE LISTING READ that says whether there are several places: drawing the summary first and swapping it for the places
                view a moment later flashed one view and discarded its read. */}
            {reviewsOn && listAnswer.isPending ? <Skeleton className="h-40 w-full" /> : null}
            {reviewsOn && !listAnswer.isPending && switcher ? (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="presence-reviews-scope" className="text-sm font-medium">
                  Reviews for
                </label>
                <select
                  id="presence-reviews-scope"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={reviewsPlace ?? ALL_LOCATIONS}
                  onChange={(e) => setReviewsPicked(e.target.value === ALL_LOCATIONS ? undefined : e.target.value)}
                >
                  <option value={ALL_LOCATIONS}>All locations</option>
                  {switcher.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">This only changes the reviews. Figures are never added across locations.</span>
              </div>
            ) : null}
            {reviewsOn && !listAnswer.isPending ? (
              wantsPlacesView({ hasSwitcher: !!switcher, narrowed: reviewsPlace !== undefined }) ? (
                <ReviewPlacesCard
                  key={panelNetwork ?? "default"}
                  network={panelNetwork}
                  label={fallbackLabel}
                  onPick={(place) => setReviewsPicked(place)}
                />
              ) : (
                <ReviewSummaryCard location={reviewsPlace ?? location} network={panelNetwork} label={fallbackLabel} onShowAll={switcher ? () => setReviewsPicked(undefined) : undefined} />
              )
            ) : null}

            {/* A network with a listing draws the kit as before. A network with NO listing draws it only when its link exists (it lives on
                the connection); with none the card is not drawn (PE-16's hiding). */}
            {reviewsOn && !listAnswer.isPending ? <ReviewKitCard location={location} network={panelNetwork} hideUnlessReady={!listingOn} /> : null}

            {listingOn ? (
              <>
                {/* ★ONE publishing status for the panels below, never one per panel (GBP Issue 1). Wherever a change can be made: the edit
                    forms, or the photos card, which is drawn on its own declaration. */}
                {editOn || photosOn ? <PublishingStatus location={panelLocation} network={panelNetwork} onRedo={openForm} /> : null}

                <ListingScoreCard
                  location={panelLocation}
                  network={panelNetwork}
                  onOpenForm={openForm}
                />

                <ListingPanel location={panelLocation} network={panelNetwork} label={fallbackLabel} />

                {editOn ? (
                  <div id="edit-listing">
                    <EditListingCard location={panelLocation} network={panelNetwork} request={editRequest} photoChangesElsewhere={photosOn} />
                  </div>
                ) : null}

                {/* The id is on the wrapper, so a score fix scrolls here whatever the card is showing (loading, failed, ready). */}
                {photosOn ? (
                  <div id="photos-card">
                    {/* Keyed by place and network: a card never carries one place's category, batch or error into another's. */}
                    <PhotosCard key={`${panelLocation ?? ""}|${panelNetwork ?? ""}`} location={panelLocation} network={panelNetwork} />
                  </div>
                ) : null}

                {/* Posts, services, details and links (PE-12): each card draws only for a network whose declaration offers it, and keyed by place and network. */}
                {editOn ? (
                  <>
                    <PostsCard key={`posts|${panelLocation ?? ""}|${panelNetwork ?? ""}`} location={panelLocation} network={panelNetwork} />
                    <ServicesCard key={`services|${panelLocation ?? ""}|${panelNetwork ?? ""}`} location={panelLocation} network={panelNetwork} />
                    <DetailsCard key={`details|${panelLocation ?? ""}|${panelNetwork ?? ""}`} location={panelLocation} network={panelNetwork} />
                    <LinksCard key={`links|${panelLocation ?? ""}|${panelNetwork ?? ""}`} location={panelLocation} network={panelNetwork} />
                  </>
                ) : null}
              </>
            ) : null}

            <InsightsPanel location={panelLocation} network={panelNetwork} label={fallbackLabel} capabilities={aboutNetwork?.capabilities} />
          </>
        )}
      </PageShell>
    </FeatureGate>
  );
}
