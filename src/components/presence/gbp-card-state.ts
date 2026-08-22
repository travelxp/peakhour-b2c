/**
 * What the Google Business Profile card says, as a pure function.
 *
 * ★★EXTRACTED BECAUSE THE BRANCH IS THE BUG, NOT THE MARKUP. The failure this
 * card exists to fix was itself a branch nobody could see: a merchant who
 * managed two listings connected successfully, the product said "Connected",
 * and nothing ever arrived. Every state below is one somebody can be stuck in,
 * and "connected but useless" is the one that has no visual difference from
 * "connected" unless this decides it does.
 */

export type GbpConnectionStatus =
  | "active"
  | "disconnected"
  | "expired"
  | "error"
  | "needs_reauth"
  | undefined;

export type GbpCardKind =
  /** Not connected at all. */
  | "disconnected"
  /** Connected, a listing chosen — the only state that syncs. */
  | "ready"
  /** Connected, no listing chosen. Nothing arrives until one is. */
  | "needs_location"
  /** Google stopped accepting our credentials. */
  | "needs_reconnect";

export interface GbpCardState {
  kind: GbpCardKind;
  /** Whether the location picker is reachable from this state. */
  canPick: boolean;
  /** Primary action label. */
  action: string;
}

/**
 * ★`error` COUNTS AS CONNECTED, `expired` AND `needs_reauth` DO NOT — the same
 * split the analytics and search-console pages use. A transient sync error must
 * still show the card and let the merchant change their listing (that may BE
 * the fix); a dead token can only be repaired by reconnecting, and offering a
 * picker there sends them to a route that will 409.
 */
export function gbpCardState(
  status: GbpConnectionStatus,
  locationName: string | null | undefined,
): GbpCardState {
  if (status === "expired" || status === "needs_reauth") {
    return { kind: "needs_reconnect", canPick: false, action: "Reconnect" };
  }
  if (status !== "active" && status !== "error") {
    return { kind: "disconnected", canPick: false, action: "Connect" };
  }
  if (locationName) {
    return { kind: "ready", canPick: true, action: "Change listing" };
  }
  return { kind: "needs_location", canPick: true, action: "Choose your listing" };
}

/**
 * Whether the picker's Save button does anything.
 *
 * ★★A BUTTON THAT RE-SAVES THE CURRENT VALUE IS A BUTTON THAT LIES. It reports
 * success, the merchant believes something changed, and nothing did — and the
 * route would happily 200 on it, so nothing downstream catches it either.
 */
export function canSaveLocation(
  draft: string | null | undefined,
  selected: string | null | undefined,
  saving: boolean,
): boolean {
  if (saving) return false;
  if (!draft) return false;
  return draft !== selected;
}

/**
 * The human name for a chosen listing.
 *
 * ★FALLS BACK TO THE RESOURCE NAME, NEVER TO NOTHING. `locations/12345` is ugly
 * and it is also the truth; an empty span in "Syncing ___" reads as a bug, and
 * the title is only absent when Google's listing omitted it or the picker has
 * not been opened on this page load.
 */
export function locationLabel(
  locationName: string | null | undefined,
  known: ReadonlyArray<{ locationName?: string; title?: string }>,
): string | null {
  if (!locationName) return null;
  const match = known.find((l) => l.locationName === locationName);
  return match?.title?.trim() || locationName;
}
