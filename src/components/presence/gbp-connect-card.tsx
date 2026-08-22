"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, ArrowRight, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  gbpCardState,
  canSaveLocation,
  locationLabel,
  emptyListingReason,
  effectiveDraft,
  type GbpConnectionStatus,
} from "@/components/presence/gbp-card-state";

/**
 * The Google Business Profile connect + location card on the Presence home.
 *
 * ★★IT REPLACES A "COMING SOON" BADGE THAT STOPPED BEING TRUE. Google approved
 * Business Profile API access on 2026-08-21 and the provider is `available`, so
 * the card was telling merchants to wait for something they could already do.
 *
 * ★★AND CONNECTING IS NOT THE END OF SETUP, WHICH IS THE WHOLE REASON THIS
 * EXISTS. `onConnect` auto-picks a location only when the merchant manages
 * EXACTLY ONE and the listing came back complete. Everyone else connected
 * successfully and then received nothing — no metrics, no reviews, silently,
 * for ever: the hourly sync returns `not_configured` without
 * `config.locationName`, and the review receiver resolves each notification by
 * that same field. A merchant with two shops had no way to say which one,
 * anywhere in the product.
 *
 * ★THE BRANCHES LIVE IN `gbp-card-state.ts`, WHICH HAS TESTS. This file has
 * none — b2c renders nothing in vitest — so anything that decides what a
 * merchant is TOLD belongs there rather than inline here.
 */

interface ConnectionStatus {
  provider: string;
  status?: GbpConnectionStatus;
  account?: { name?: string };
  lastError?: string;
}

interface CapabilitiesResponse {
  provider: string;
  /** ★NOT where a Google selection lives — see the api route's note. */
  capabilities: Record<string, unknown> | null;
  /** Absent entirely on an api that predates the field. See `gbpCardState`. */
  locationName?: string | null;
  account?: {
    extra?: {
      locations?: Array<{ locationName?: string; title?: string }>;
      locationsComplete?: boolean;
    };
  };
}

interface LocationsResponse {
  provider: string;
  locations: Array<{ locationName: string; title?: string }>;
  complete: boolean;
  selected: string | null;
  selectionRetired?: boolean;
}

const PROVIDER = "google_business_profile";
const STATUS_KEY = ["integration-status", PROVIDER];
const CAP_KEY = ["integration-cap", PROVIDER];
const LOCATIONS_KEY = ["gbp-locations", PROVIDER];

export function GbpConnectCard() {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const statusQ = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => api.get<ConnectionStatus>(`/v1/integrations/${PROVIDER}/status`),
    refetchOnWindowFocus: false,
  });

  const isConnected = statusQ.data?.status === "active" || statusQ.data?.status === "error";

  const capQ = useQuery({
    queryKey: CAP_KEY,
    queryFn: () => api.get<CapabilitiesResponse>(`/v1/integrations/${PROVIDER}/capabilities`),
    enabled: isConnected,
    refetchOnWindowFocus: false,
  });

  // ★DEFERRED UNTIL THE PICKER OPENS. This route re-lists live from Google, one
  // paginated request per account the merchant manages — real quota, on their
  // token. The card renders from the cheap capabilities read; only choosing
  // costs a call.
  const locationsQ = useQuery({
    queryKey: LOCATIONS_KEY,
    queryFn: () => api.get<LocationsResponse>(`/v1/integrations/${PROVIDER}/gbp-locations`),
    enabled: pickerOpen,
    refetchOnWindowFocus: false,
  });

  const setLocationMut = useMutation({
    mutationFn: (locationName: string) =>
      api.put(`/v1/integrations/${PROVIDER}/gbp-location`, { locationName }),
    // ★★THE LOCATIONS CACHE HAS TO MOVE TOO, OR THE SAVE APPEARS TO UNDO ITSELF.
    // `selected` prefers this query over the capabilities read, and a disabled
    // query keeps its cache — so invalidating only CAP_KEY left the stale
    // `selected: null` winning, and the card reverted to "Nothing syncs until
    // you choose" the instant after the success toast. Written directly rather
    // than invalidated: the query is disabled once the picker closes, so an
    // invalidation would not re-fetch it.
    onSuccess: (_data, locationName) => {
      toast.success("Listing selected — insights and reviews will start arriving");
      setPickerOpen(false);
      qc.setQueryData<LocationsResponse>(LOCATIONS_KEY, (old) =>
        old ? { ...old, selected: locationName, selectionRetired: false } : old,
      );
      qc.invalidateQueries({ queryKey: CAP_KEY });
      qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not select that listing"),
  });

  const syncMut = useMutation({
    mutationFn: () => api.post(`/v1/integrations/${PROVIDER}/sync`, {}),
    onSuccess: () => {
      toast.success("Sync started");
      qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError: (e: Error) => toast.error(e.message ?? "Sync failed"),
  });

  // ★★THE PICKER'S ANSWER IS FRESHER THAN THE CAPABILITIES READ, so it wins once
  // it exists. That is also how a RETIRED pick reaches the card: when a complete
  // listing shows the selected listing is gone, the api clears it and returns
  // `selected: null` — without this the card would go on saying "Syncing X" for
  // the rest of the session.
  //
  // ★`undefined` MEANS NOT READ, and must not collapse into `null`. See
  // `gbpCardState`: on an api that predates the field the key is absent
  // entirely, and treating that as "nothing selected" nags every configured
  // merchant on every deployment that has not shipped it yet.
  const selected = locationsQ.data ? locationsQ.data.selected : capQ.data?.locationName;
  const card = gbpCardState(statusQ.data?.status, selected);
  // The picker's list once it has loaded, else what connect captured — so the
  // selected listing has a name to show without a Google call.
  const known = locationsQ.data?.locations ?? capQ.data?.account?.extra?.locations ?? [];
  const selectedLabel = locationLabel(selected, known);

  // ★THE CAPABILITIES READ IS PART OF THE ANSWER, so its loading state is part
  // of the skeleton. Rendering the card first showed "Finish setup" for a
  // moment on every configured merchant's page load.
  if (statusQ.isLoading || (isConnected && capQ.isLoading)) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  // ★★A FAILED STATUS READ IS NOT A DISCONNECTED MERCHANT. `statusQ.data` is
  // `undefined` on error, which `gbpCardState` reads as "not connected" — so a
  // connected, syncing store would have been shown a Connect button. That is
  // the same unknown-collapsed-into-negative this card fixed for
  // `locationName`, and it belongs here rather than in the state machine
  // because a fetch failure is not a product state.
  if (statusQ.isError) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <PickerNotice onRetry={() => statusQ.refetch()}>
          We couldn&rsquo;t check your Google Business Profile connection just now.
        </PickerNotice>
      </div>
    );
  }

  return (
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
              {card.kind === "ready" ? (
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />
                  Connected
                </Badge>
              ) : card.kind === "connected_unknown" ? (
                <Badge variant="secondary">Connected</Badge>
              ) : card.kind === "needs_location" ? (
                <Badge variant="outline">Finish setup</Badge>
              ) : card.kind === "sync_failing" ? (
                <Badge variant="destructive">Not syncing</Badge>
              ) : card.kind === "needs_reconnect" ? (
                <Badge variant="destructive">Reconnect</Badge>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {card.kind === "ready" ? (
                <>
                  Syncing <span className="font-medium text-foreground">{selectedLabel}</span>.
                </>
              ) : card.kind === "connected_unknown" ? (
                "Connected. Choose which listing this business is if you haven't already."
              ) : card.kind === "needs_location" ? (
                // ★NOT "you manage more than one listing" — that is asserted as
                // fact and is not always true. Auto-pick also declines when the
                // listing came back partial, so a single-location merchant who
                // connected during a Google throttle lands here too.
                "We need to know which listing this business is. Nothing syncs until you choose."
              ) : card.kind === "sync_failing" ? (
                // ★★THE ONE STATE THAT USED TO RENDER AS "Connected · Syncing".
                // The hourly sync and the review receiver both select
                // `status: "active"`, so this connection is in neither: it is
                // not retried, and it is not receiving.
                <>
                  The last sync failed and this connection isn&rsquo;t being retried
                  automatically.
                  {statusQ.data?.lastError ? (
                    <span className="mt-1 block wrap-break-word text-xs">
                      {statusQ.data.lastError}
                    </span>
                  ) : null}
                </>
              ) : card.kind === "needs_reconnect" ? (
                "Google stopped accepting our access. Reconnect to resume insights and reviews."
              ) : (
                "Connect your listing to sync calls, direction requests and website clicks — and to get every review in one inbox."
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {/* ★A STATE THAT SAYS "not syncing" MUST OFFER A WAY OUT. The cron
              never revisits an errored connection, so without this the merchant
              is told it is broken and given nothing to press. */}
          {card.kind === "sync_failing" ? (
            <Button
              variant="outline"
              disabled={syncMut.isPending}
              onClick={() => syncMut.mutate()}
            >
              {syncMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              Try again
            </Button>
          ) : null}

          {card.canPick ? (
            <Button
              variant={card.kind === "ready" ? "outline" : "default"}
              onClick={() => setPickerOpen((v) => !v)}
            >
              {card.action}
            </Button>
          ) : (
            <Button asChild variant={card.kind === "needs_reconnect" ? "default" : "outline"}>
              <Link href="/dashboard/integrations">
                {card.action}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {pickerOpen && card.canPick ? (
        <LocationPicker
          query={locationsQ}
          selected={selected ?? null}
          saving={setLocationMut.isPending}
          onChoose={(name) => setLocationMut.mutate(name)}
        />
      ) : null}
    </div>
  );
}

/** A warning line with an optional retry — the picker's three failure states
 *  all render this rather than three near-identical blocks. */
function PickerNotice({ children, onRetry }: { children: React.ReactNode; onRetry?: () => void }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <span>
        {children}
        {onRetry ? (
          <>
            {" "}
            <button type="button" className="underline underline-offset-2" onClick={onRetry}>
              Try again
            </button>
            .
          </>
        ) : null}
      </span>
    </p>
  );
}

function LocationPicker({
  query,
  selected,
  saving,
  onChoose,
}: {
  query: UseQueryResult<LocationsResponse, Error>;
  selected: string | null;
  saving: boolean;
  onChoose: (locationName: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(selected);
  // ★DERIVED, NOT STORED. `draft` is seeded once — before the listing loads —
  // and a retired pick means the fresh list contains neither it nor a
  // replacement. See `effectiveDraft`.
  const chosen = effectiveDraft(draft, selected, query.data?.locations ?? []);

  if (query.isLoading) {
    return (
      <div className="mt-5 border-t pt-5">
        <Skeleton className="h-9 w-full max-w-sm" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mt-5 border-t pt-5">
        <PickerNotice onRetry={() => query.refetch()}>
          {query.error instanceof Error
            ? query.error.message
            : "Could not read your listings from Google."}
        </PickerNotice>
      </div>
    );
  }

  const locations = query.data?.locations ?? [];

  if (locations.length === 0) {
    // ★★"WE READ NOTHING" IS NOT "YOU HAVE NOTHING". A throttled per-account
    // listing comes back as an empty set, and the api distinguishes the two —
    // this used to assert the merchant owns no listings either way, with no
    // retry, which is a claim we are frequently not entitled to make.
    const reason = emptyListingReason(query.data?.complete);
    return (
      <div className="mt-5 border-t pt-5">
        {reason === "none" ? (
          <PickerNotice>
            This Google account manages no Business Profile listings. Create one in
            Google Business Profile, then refresh.
          </PickerNotice>
        ) : (
          <PickerNotice onRetry={() => query.refetch()}>
            Google didn&rsquo;t return any of your listings just now, so we can&rsquo;t
            show the choices yet.
          </PickerNotice>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={chosen ?? undefined} onValueChange={setDraft}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue placeholder="Choose a listing" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.locationName} value={l.locationName}>
                {/* ★THE SAME FALLBACK AS THE HEADLINE. `title ?? locationName`
                    rendered a BLANK ROW for a whitespace-only title. */}
                {locationLabel(l.locationName, locations)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          disabled={!canSaveLocation(chosen, selected, saving)}
          onClick={() => chosen && onChoose(chosen)}
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </div>

      {/* ★SAY SO WHEN THE LIST MAY BE SHORT. Google throttles per-account
          listings, and a partial answer is indistinguishable from a whole one —
          a merchant who cannot find their shop here would otherwise conclude it
          is not connectable. */}
      {query.data && !query.data.complete ? (
        <PickerNotice onRetry={() => query.refetch()}>
          Google didn&rsquo;t return all of your listings just now, so this list may
          be short.
        </PickerNotice>
      ) : null}
    </div>
  );
}
