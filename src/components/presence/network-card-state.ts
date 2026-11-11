/**
 * What a network's connect card says, as a pure function.
 *
 * ★★EXTRACTED BECAUSE THE BRANCH IS THE BUG, NOT THE MARKUP. The failure this
 * card exists to fix was itself a branch nobody could see: a merchant who
 * managed two listings connected successfully, the product said "Connected",
 * and nothing ever arrived. Every state below is one somebody can be stuck in,
 * and each of the three failing ones has no visual difference from "working"
 * unless this decides it does.
 */

export type NetworkConnectionStatus =
  | "active"
  | "disconnected"
  | "expired"
  | "error"
  | "needs_reauth"
  | undefined;

export type NetworkCardKind =
  /** Not connected at all. */
  | "disconnected"
  /** The network stopped accepting our credentials. */
  | "needs_reconnect"
  /** The last sync failed. The cron will not retry it — see below. */
  | "sync_failing"
  /** Connected, a listing chosen — the only state that syncs. */
  | "ready"
  /** Connected, no listing chosen. Nothing arrives until one is. */
  | "needs_location"
  /** Connected; we have not been able to read WHETHER a listing is chosen. */
  | "connected_unknown";

export interface NetworkCardState {
  kind: NetworkCardKind;
  /** Whether the location picker is reachable from this state. */
  canPick: boolean;
  /** Primary action label. */
  action: string;
}

/**
 * `locationNames` is deliberately three-valued:
 *   a non-empty list - these listings are selected
 *   `[]`             - read successfully, nothing selected
 *   `undefined`      - NOT READ. In flight, failed, or an api old enough not to
 *                      return the field at all.
 *
 * ★★THE THIRD VALUE IS THE POINT. Collapsing "unknown" into "not selected" told
 * a fully configured merchant "Nothing syncs until you choose" for as long as
 * the capabilities read was in flight - and PERMANENTLY on any deployment whose
 * api predates the field. The route returns the list for a connection with a picker,
 * so the key is always present on a new api and always absent on an old one:
 * `undefined` is a reliable "we do not know", not a guess.
 *
 * ★AND `error` IS ITS OWN STATE, NOT A KIND OF "READY". A connection the cron
 * stamped `error` is skipped by BOTH the hourly performance-sync and the review
 * receiver - each selects `status: "active"` - so it is not syncing whatever
 * listings it points at. Rendering it as "Connected - Syncing Bandra" is exactly
 * the healthy-looking dead connection this card exists to remove.
 */
export function networkCardState(
  status: NetworkConnectionStatus,
  locationNames: readonly string[] | undefined,
  /** Whether the network has places to choose among (its adapter declares a picker). A network with one place has nothing to pick. */
  hasPicker = true,
): NetworkCardState {
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
  // A network with one place has nothing to choose, so the picker states never apply: it is connected, or it is failing.
  if (!hasPicker) {
    return status === "error"
      ? { kind: "sync_failing", canPick: false, action: "Manage connection" }
      : { kind: "ready", canPick: false, action: "Manage connection" };
  }

  if (locationNames !== undefined && locationNames.length === 0) {
    return { kind: "needs_location", canPick: true, action: "Choose your listing" };
  }

  if (status === "error") {
    // Still pickable: pointing at a different listing is one of the few things
    // a merchant can do about a failing sync, and the api restores `active`
    // when they do. ★A KNOWN-BAD STATUS BEATS AN UNREAD PICK — we are certain
    // the sync failed, so this outranks `connected_unknown`.
    return { kind: "sync_failing", canPick: true, action: "Change listings" };
  }

  // ★PICKABLE, DELIBERATELY, EVEN THOUGH ONE ROUTE TO THIS STATE IS AN API TOO
  // OLD TO HAVE THE PICKER. The other routes are a capabilities read that
  // failed or is stale — a merchant who genuinely has no listing chosen, and
  // for whom hiding the picker means no way to finish setup at all. An
  // unavailable route surfaces as an error with a retry inside the picker;
  // a missing button surfaces as nothing. The louder failure is the right one.
  if (locationNames === undefined) {
    return { kind: "connected_unknown", canPick: true, action: "Choose your listing" };
  }

  return { kind: "ready", canPick: true, action: "Change listings" };
}

/**
 * The listings the picker should show as chosen.
 *
 * ★★A DRAFT THAT IS NOT IN THE LIST IS NOT A DRAFT. `draft` is seeded once from
 * the stored pick, before the listing has loaded — and when the api RETIRES a
 * selection Google no longer lists, the fresh list contains neither the draft
 * nor a replacement. The Select then rendered blank while Save stayed enabled,
 * and pressing it 400s `UNAVAILABLE_LOCATION`: a button offering to save a
 * value the server has already refused.
 */
export function effectiveDraft(
  draft: readonly string[] | null | undefined,
  selected: readonly string[] | null | undefined,
  locations: ReadonlyArray<{ locationName?: string }>,
): string[] {
  // Only listings that are still on offer count: a retired one is not a draft.
  const offered = (names: readonly string[] | null | undefined) =>
    (names ?? []).filter((v) => locations.some((l) => l.locationName === v));
  return draft ? offered(draft) : offered(selected);
}

/** Add or remove one listing from a draft, keeping the order the merchant ticked them in. */
export function toggleLocation(draft: readonly string[], name: string): string[] {
  return draft.includes(name) ? draft.filter((n) => n !== name) : [...draft, name];
}

/**
 * Whether the picker's Save button does anything.
 *
 * ★★A BUTTON THAT RE-SAVES THE CURRENT SET IS A BUTTON THAT LIES. It reports
 * success, the merchant believes something changed, and nothing did. The set is
 * compared as a set: ticking the same listings in another order is no change.
 * ★AND AT LEAST ONE LISTING, because the api refuses an empty set.
 */
export function canSaveLocation(
  draft: readonly string[],
  selected: readonly string[] | null | undefined,
  saving: boolean,
): boolean {
  if (saving) return false;
  if (draft.length === 0) return false;
  const have = new Set(selected ?? []);
  return draft.length !== have.size || draft.some((n) => !have.has(n));
}

/** "Bandra", "Bandra and Andheri", "Bandra, Andheri and 2 more". */
export function selectionLabel(
  names: readonly string[],
  known: ReadonlyArray<{ locationName?: string; title?: string }>,
): string | null {
  const labels = names.map((n) => locationLabel(n, known) ?? n);
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels[0]}, ${labels[1]} and ${labels.length - 2} more`;
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

/** The facts the card and the picker show about one listing, beside its name. */
export interface ListingFacts {
  locationName?: string;
  title?: string;
  /** One line: the first address line, then the town. */
  address?: string;
  /** The listing's page on the network's map. */
  mapsUri?: string;
}

/**
 * The map link, only when it is a web address. ★A stored value is shown as a link target, so anything but http(s) is no link at all.
 */
export function mapLink(mapsUri: string | null | undefined): string | null {
  const t = mapsUri?.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Words that say what kind of company a name is, not which one: they never make two names "the same". */
const NAME_NOISE = new Set(["pvt", "private", "limited", "ltd", "llp", "inc", "the", "and"]);

/** The words of a name that tell it from another: lower case, no punctuation, no company-form words. */
function meaningfulWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w !== "" && !NAME_NOISE.has(w));
}

/**
 * Whether a listing's name looks like it belongs to some other business: it shares no meaningful word with the business's own name.
 *
 * ★A WARNING, NEVER A BLOCK. Two names can share nothing and still be one business, so the answer only decides whether a soft line
 * is shown. ★AND NO ANSWER FROM NO WORDS: a name that is all company-form words, or blank, has nothing to compare, so it never warns.
 */
export function listingNameLooksOff(listingTitle: string | null | undefined, businessName: string | null | undefined): boolean {
  const listing = meaningfulWords(listingTitle ?? "");
  const business = new Set(meaningfulWords(businessName ?? ""));
  if (listing.length === 0 || business.size === 0) return false;
  return !listing.some((w) => business.has(w));
}

/**
 * What "this is not my business" does: with other listings on the account, choose among them; with only this one on it, the fix is a
 * different account, so it goes to connect. `complete` is whether the list of listings is the whole of them.
 */
export function chooseAnotherAction(knownListings: number, complete: boolean | undefined): { kind: "picker" | "reconnect"; text: string } {
  // ★ONE KNOWN LISTING IS ONE ONLY WHEN THE LIST IS WHOLE: a partial or unread capture can hold one of several, and the picker re-lists.
  return knownListings === 1 && complete === true
    ? { kind: "reconnect", text: "Connect the account that manages your listing" }
    : { kind: "picker", text: "Choose another listing" };
}
