/**
 * What the Google Business Profile card says, as a pure function.
 *
 * ★★EXTRACTED BECAUSE THE BRANCH IS THE BUG, NOT THE MARKUP. The failure this
 * card exists to fix was itself a branch nobody could see: a merchant who
 * managed two listings connected successfully, the product said "Connected",
 * and nothing ever arrived. Every state below is one somebody can be stuck in,
 * and each of the three failing ones has no visual difference from "working"
 * unless this decides it does.
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
  /** Google stopped accepting our credentials. */
  | "needs_reconnect"
  /** The last sync failed. The cron will not retry it — see below. */
  | "sync_failing"
  /** Connected, a listing chosen — the only state that syncs. */
  | "ready"
  /** Connected, no listing chosen. Nothing arrives until one is. */
  | "needs_location"
  /** Connected; we have not been able to read WHETHER a listing is chosen. */
  | "connected_unknown";

export interface GbpCardState {
  kind: GbpCardKind;
  /** Whether the location picker is reachable from this state. */
  canPick: boolean;
  /** Primary action label. */
  action: string;
}

/**
 * `locationName` is deliberately three-valued:
 *   a string  — this listing is selected
 *   `null`    — read successfully, nothing selected
 *   `undefined` — NOT READ. In flight, failed, or an api old enough not to
 *                 return the field at all.
 *
 * ★★THE THIRD VALUE IS THE POINT. Collapsing "unknown" into "not selected" told
 * a fully configured merchant "Nothing syncs until you choose" for as long as
 * the capabilities read was in flight — and PERMANENTLY on any deployment whose
 * api predates the field, which is every production deployment until the api
 * ships. The route returns `locationName: … ?? null`, so the key is always
 * present on a new api and always absent on an old one: `undefined` is a
 * reliable "we do not know", not a guess.
 *
 * ★AND `error` IS ITS OWN STATE, NOT A KIND OF "READY". A connection the cron
 * stamped `error` is skipped by BOTH the hourly performance-sync and the review
 * receiver — each selects `status: "active"` — so it is not syncing whatever
 * listing it points at. Rendering it as "Connected · Syncing Bandra" is exactly
 * the healthy-looking dead connection this card exists to remove.
 */
export function gbpCardState(
  status: GbpConnectionStatus,
  locationName: string | null | undefined,
): GbpCardState {
  if (status === "expired" || status === "needs_reauth") {
    return { kind: "needs_reconnect", canPick: false, action: "Reconnect" };
  }
  // ★`undefined` HERE MEANS "READ, AND NOT CONNECTED" — never "not read". The
  //  component early-returns while the status query is loading or failed, so a
  //  fetch problem cannot arrive as a claim that the merchant has no
  //  connection. Same rule as `locationName`, enforced one level up because a
  //  failed read is a fetch state rather than a product state.
  if (status !== "active" && status !== "error") {
    return { kind: "disconnected", canPick: false, action: "Connect" };
  }

  // ★★NO LISTING OUTRANKS A FAILING SYNC, and the order used to be the other
  // way round. An errored connection with nothing picked was told "Change
  // listing" over copy blaming the last sync — while its "Try again" enqueues a
  // sync the provider answers `skipped: not_configured`, because the thing
  // actually missing is the pick. Choosing is the fix; say so.
  if (locationName === null) {
    return { kind: "needs_location", canPick: true, action: "Choose your listing" };
  }

  if (status === "error") {
    // Still pickable: pointing at a different listing is one of the few things
    // a merchant can do about a failing sync, and the api restores `active`
    // when they do. ★A KNOWN-BAD STATUS BEATS AN UNREAD PICK — we are certain
    // the sync failed, so this outranks `connected_unknown`.
    return { kind: "sync_failing", canPick: true, action: "Change listing" };
  }

  if (locationName === undefined) {
    return { kind: "connected_unknown", canPick: true, action: "Choose your listing" };
  }

  return { kind: "ready", canPick: true, action: "Change listing" };
}

/**
 * The listing the picker should show as chosen.
 *
 * ★★A DRAFT THAT IS NOT IN THE LIST IS NOT A DRAFT. `draft` is seeded once from
 * the stored pick, before the listing has loaded — and when the api RETIRES a
 * selection Google no longer lists, the fresh list contains neither the draft
 * nor a replacement. The Select then rendered blank while Save stayed enabled,
 * and pressing it 400s `UNAVAILABLE_LOCATION`: a button offering to save a
 * value the server has already refused.
 */
export function effectiveDraft(
  draft: string | null | undefined,
  selected: string | null | undefined,
  locations: ReadonlyArray<{ locationName?: string }>,
): string | null {
  const has = (v: string | null | undefined) =>
    !!v && locations.some((l) => l.locationName === v);
  if (has(draft)) return draft as string;
  if (has(selected)) return selected as string;
  return null;
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
 * The human name for a listing.
 *
 * ★FALLS BACK TO THE RESOURCE NAME, NEVER TO NOTHING. `locations/12345` is ugly
 * and it is also the truth; an empty span in "Syncing ___" — or a blank row in
 * the dropdown — reads as a bug, and the title is absent whenever Google's
 * listing omitted it.
 */
export function locationLabel(
  locationName: string | null | undefined,
  known: ReadonlyArray<{ locationName?: string; title?: string }>,
): string | null {
  if (!locationName) return null;
  const match = known.find((l) => l.locationName === locationName);
  return match?.title?.trim() || locationName;
}

/**
 * What the picker says when it has no listings to offer.
 *
 * ★★"WE READ NOTHING" AND "YOU HAVE NOTHING" ARE DIFFERENT ANSWERS — the same
 * distinction the api makes between LOCATIONS_INCOMPLETE and NO_LOCATIONS, and
 * the card was making neither. `resolveLocations` swallows a throttled
 * per-account listing as `[]`, so "this Google account manages no listings" is
 * a claim we are frequently not entitled to.
 */
export function emptyListingReason(complete: boolean | undefined): "none" | "unreadable" {
  return complete === true ? "none" : "unreadable";
}
