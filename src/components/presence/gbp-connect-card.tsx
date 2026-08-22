"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
 * EXACTLY ONE. Everyone else connected successfully and then received nothing —
 * no metrics, no reviews, silently, for ever: the hourly sync returns
 * `not_configured` without `config.locationName`, and the review receiver
 * resolves each notification by that same field. A merchant with two shops had
 * no way to say which one, anywhere in the product.
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
}

const PROVIDER = "google_business_profile";
const STATUS_KEY = ["integration-status", PROVIDER];
const CAP_KEY = ["integration-cap", PROVIDER];

export function GbpConnectCard() {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const statusQ = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => api.get<ConnectionStatus>(`/v1/integrations/${PROVIDER}/status`),
    refetchOnWindowFocus: false,
  });

  // ★THE BRANCHES LIVE IN `gbp-card-state.ts`, WHICH HAS TESTS. This file has
  // none — b2c renders nothing in vitest — so anything that decides what a
  // merchant is told belongs there rather than inline here.
  const capQ = useQuery({
    queryKey: CAP_KEY,
    queryFn: () => api.get<CapabilitiesResponse>(`/v1/integrations/${PROVIDER}/capabilities`),
    enabled: statusQ.data?.status === "active" || statusQ.data?.status === "error",
    refetchOnWindowFocus: false,
  });

  // ★DEFERRED UNTIL THE PICKER OPENS. This route re-lists live from Google, one
  // paginated request per account the merchant manages — real quota, on their
  // token. The card renders from the cheap capabilities read; only choosing
  // costs a call.
  const locationsQ = useQuery({
    queryKey: ["gbp-locations", PROVIDER],
    queryFn: () => api.get<LocationsResponse>(`/v1/integrations/${PROVIDER}/gbp-locations`),
    enabled: pickerOpen,
    refetchOnWindowFocus: false,
  });

  const setLocationMut = useMutation({
    mutationFn: (locationName: string) =>
      api.put(`/v1/integrations/${PROVIDER}/gbp-location`, { locationName }),
    onSuccess: () => {
      toast.success("Listing selected — insights and reviews will start arriving");
      setPickerOpen(false);
      qc.invalidateQueries({ queryKey: CAP_KEY });
      qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not select that listing"),
  });

  const selected = capQ.data?.locationName ?? null;
  const card = gbpCardState(statusQ.data?.status, selected);
  // The picker's list once it has loaded, else what connect captured — so the
  // selected listing has a name to show without a Google call.
  const known = locationsQ.data?.locations ?? capQ.data?.account?.extra?.locations ?? [];
  const selectedLabel = locationLabel(selected, known);

  if (statusQ.isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <Skeleton className="h-11 w-full" />
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
              ) : card.kind === "needs_location" ? (
                <Badge variant="outline">Finish setup</Badge>
              ) : card.kind === "needs_reconnect" ? (
                <Badge variant="destructive">Reconnect</Badge>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {card.kind === "ready" ? (
                <>
                  Syncing{" "}
                  <span className="font-medium text-foreground">{selectedLabel}</span>.
                </>
              ) : card.kind === "needs_location" ? (
                // ★THE SPECIFIC SENTENCE, NOT A GENERIC ONE. This state is
                // reached only by a merchant who manages more than one listing,
                // and it is the state in which nothing arrives.
                "You manage more than one listing, so we need to know which one this business is. Nothing syncs until you choose."
              ) : card.kind === "needs_reconnect" ? (
                "Google stopped accepting our access. Reconnect to resume insights and reviews."
              ) : (
                "Connect your listing to sync calls, direction requests and website clicks — and to get every review in one inbox."
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
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
          selected={selected}
          saving={setLocationMut.isPending}
          onChoose={(name) => setLocationMut.mutate(name)}
        />
      ) : null}
    </div>
  );
}

function LocationPicker({
  query,
  selected,
  saving,
  onChoose,
}: {
  query: ReturnType<typeof useQuery<LocationsResponse>>;
  selected: string | null;
  saving: boolean;
  onChoose: (locationName: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(selected);

  if (query.isLoading) {
    return (
      <div className="mt-5 border-t pt-5">
        <Skeleton className="h-9 w-full max-w-sm" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mt-5 flex items-start gap-2 border-t pt-5 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>
          {query.error instanceof Error
            ? query.error.message
            : "Could not read your listings from Google."}
        </span>
      </div>
    );
  }

  const locations = query.data?.locations ?? [];

  if (locations.length === 0) {
    return (
      <div className="mt-5 flex items-start gap-2 border-t pt-5 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>
          This Google account manages no Business Profile listings. Create one in
          Google Business Profile, then refresh.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={draft ?? undefined} onValueChange={setDraft}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue placeholder="Choose a listing" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.locationName} value={l.locationName}>
                {l.title ?? l.locationName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          disabled={!canSaveLocation(draft, selected, saving)}
          onClick={() => draft && onChoose(draft)}
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
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Google didn&rsquo;t return all of your listings just now, so this
            list may be short.{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => query.refetch()}
            >
              Try again
            </button>
            .
          </span>
        </p>
      ) : null}
    </div>
  );
}
