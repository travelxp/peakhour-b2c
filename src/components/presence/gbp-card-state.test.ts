import { describe, it, expect } from "vitest";
import {
  gbpCardState,
  canSaveLocation,
  locationLabel,
  emptyListingReason,
  effectiveDraft,
  type GbpConnectionStatus,
} from "./gbp-card-state";

/**
 * The Presence card's branches.
 *
 * ★★THREE OF THESE STATES LOOK LIKE "WORKING" UNLESS SOMETHING DECIDES THEY DO
 * NOT — a merchant with no listing chosen, a connection the cron stamped
 * `error`, and a capabilities read we never got. Each renders a card that says
 * the product is fine while nothing arrives, which is the defect this whole
 * feature exists to remove; the first draft of this file reproduced two of them.
 */

describe("gbpCardState", () => {
  const cases: Array<{
    what: string;
    status: GbpConnectionStatus;
    location: string | null | undefined;
    kind: string;
    canPick: boolean;
  }> = [
    { what: "never connected", status: undefined, location: null, kind: "disconnected", canPick: false },
    { what: "disconnected", status: "disconnected", location: null, kind: "disconnected", canPick: false },
    { what: "active with a listing", status: "active", location: "locations/1", kind: "ready", canPick: true },
    { what: "active with NO listing", status: "active", location: null, kind: "needs_location", canPick: true },
    { what: "active, listing UNKNOWN", status: "active", location: undefined, kind: "connected_unknown", canPick: true },
    { what: "expired", status: "expired", location: "locations/1", kind: "needs_reconnect", canPick: false },
    { what: "needs_reauth", status: "needs_reauth", location: "locations/1", kind: "needs_reconnect", canPick: false },
    { what: "error with a listing", status: "error", location: "locations/1", kind: "sync_failing", canPick: true },
    // ★NO LISTING OUTRANKS A FAILING SYNC: choosing is the fix, and "Try again"
    // on a connection with nothing picked enqueues a sync the provider answers
    // `skipped: not_configured`.
    { what: "error with no listing", status: "error", location: null, kind: "needs_location", canPick: true },
    // ★But a KNOWN-BAD status beats an UNREAD pick — we are certain it failed.
    { what: "error, listing unknown", status: "error", location: undefined, kind: "sync_failing", canPick: true },
  ];

  for (const c of cases) {
    it(c.what, () => {
      const s = gbpCardState(c.status, c.location);
      expect(s.kind).toBe(c.kind);
      expect(s.canPick).toBe(c.canPick);
    });
  }

  it("★★an `error` connection is NEVER 'ready', whatever listing it points at", () => {
    // Both the hourly performance-sync and the review receiver select
    // `status: "active"`, so this row is in neither: it is not retried and it
    // is not receiving. Rendering "Connected · Syncing Bandra" over that is the
    // healthy-looking dead connection this card exists to remove — and the
    // first version of this file did exactly that.
    expect(gbpCardState("error", "locations/1").kind).not.toBe("ready");
    expect(gbpCardState("error", "locations/1").kind).toBe("sync_failing");
  });

  it("★★`undefined` is 'we have not read it', not 'nothing is selected'", () => {
    // The capabilities read is in flight, failed, or the api predates the
    // field — which is EVERY deployment until it ships. Collapsing that into
    // `null` told a fully configured merchant "Nothing syncs until you choose".
    expect(gbpCardState("active", undefined).kind).toBe("connected_unknown");
    expect(gbpCardState("active", null).kind).toBe("needs_location");
  });

  it("★★a dead token never offers the picker — that route 409s", () => {
    for (const status of ["expired", "needs_reauth"] as const) {
      expect(gbpCardState(status, null).canPick).toBe(false);
      expect(gbpCardState(status, null).action).toBe("Reconnect");
    }
  });

  it("★the action label distinguishes first choice from a change", () => {
    expect(gbpCardState("active", null).action).toBe("Choose your listing");
    expect(gbpCardState("active", undefined).action).toBe("Choose your listing");
    expect(gbpCardState("active", "locations/1").action).toBe("Change listing");
  });

  it("★and a failing sync is still pickable — the pick is one of the few fixes", () => {
    // The api restores `active` when a pick lands on an errored connection.
    expect(gbpCardState("error", "locations/1").canPick).toBe(true);
  });

  it("★★an errored connection with NOTHING PICKED is a picking problem", () => {
    // It used to say "Change listing" over copy blaming the last sync, and its
    // "Try again" enqueues a sync the provider answers `skipped:
    // not_configured` — because the thing actually missing is the pick.
    expect(gbpCardState("error", null).kind).toBe("needs_location");
    expect(gbpCardState("error", null).action).toBe("Choose your listing");
  });
});

describe("★★effectiveDraft", () => {
  const listed = [{ locationName: "locations/1" }, { locationName: "locations/2" }];

  it("a draft that is not in the list is not a draft", () => {
    // `draft` is seeded once, before the listing loads — and a RETIRED pick
    // means the fresh list holds neither it nor a replacement. The Select then
    // rendered blank while Save stayed enabled, and pressing it 400s
    // UNAVAILABLE_LOCATION: a button offering to save a value already refused.
    expect(effectiveDraft("locations/9", null, listed)).toBeNull();
  });

  it("keeps a draft the list contains", () => {
    expect(effectiveDraft("locations/2", "locations/1", listed)).toBe("locations/2");
  });

  it("falls back to the stored pick when there is no draft", () => {
    expect(effectiveDraft(null, "locations/1", listed)).toBe("locations/1");
  });

  it("★and drops a STORED pick the list no longer contains", () => {
    // The retirement case exactly: Google stopped listing it, so it cannot be
    // re-saved either.
    expect(effectiveDraft(null, "locations/9", listed)).toBeNull();
  });

  it("an empty list can confirm nothing", () => {
    expect(effectiveDraft("locations/1", "locations/1", [])).toBeNull();
  });

  it("★and the result disables Save, which is the point", () => {
    const chosen = effectiveDraft("locations/9", null, listed);
    expect(canSaveLocation(chosen, null, false)).toBe(false);
  });
});

describe("canSaveLocation", () => {
  it("★★refuses to re-save the value already stored", () => {
    // The route would 200 on it, the toast would say it worked, and nothing
    // would have changed — a success message for a no-op.
    expect(canSaveLocation("locations/1", "locations/1", false)).toBe(false);
  });

  it("allows a genuine change", () => {
    expect(canSaveLocation("locations/2", "locations/1", false)).toBe(true);
  });

  it("allows the first choice, when nothing is stored", () => {
    expect(canSaveLocation("locations/1", null, false)).toBe(true);
    expect(canSaveLocation("locations/1", undefined, false)).toBe(true);
  });

  it("refuses with nothing chosen", () => {
    expect(canSaveLocation(null, null, false)).toBe(false);
    expect(canSaveLocation("", "locations/1", false)).toBe(false);
  });

  it("refuses while a save is in flight", () => {
    expect(canSaveLocation("locations/2", "locations/1", true)).toBe(false);
  });
});

describe("locationLabel", () => {
  const known = [
    { locationName: "locations/1", title: "Bandra" },
    { locationName: "locations/2" },
    { locationName: "locations/3", title: "   " },
  ];

  it("prefers the human title", () => {
    expect(locationLabel("locations/1", known)).toBe("Bandra");
  });

  it("★falls back to the resource name rather than to nothing", () => {
    // "Syncing ___" with an empty span reads as a bug; `locations/2` is ugly
    // and true. The dropdown uses this for the same reason — `title ?? name`
    // rendered a blank, unpickable-looking row.
    expect(locationLabel("locations/2", known)).toBe("locations/2");
  });

  it("★a whitespace-only title is not a title", () => {
    expect(locationLabel("locations/3", known)).toBe("locations/3");
  });

  it("★and a listing missing from the list still gets a label", () => {
    expect(locationLabel("locations/9", known)).toBe("locations/9");
  });

  it("nothing selected is nothing to label", () => {
    expect(locationLabel(null, known)).toBeNull();
    expect(locationLabel(undefined, known)).toBeNull();
  });
});

describe("★★emptyListingReason", () => {
  it("only a COMPLETE listing may claim the merchant owns nothing", () => {
    // `resolveLocations` swallows a throttled per-account listing as [], so
    // "this Google account manages no listings" is a claim we are frequently
    // not entitled to — and the api makes exactly this distinction
    // (NO_LOCATIONS vs LOCATIONS_INCOMPLETE) while the card made neither.
    expect(emptyListingReason(true)).toBe("none");
    expect(emptyListingReason(false)).toBe("unreadable");
    expect(emptyListingReason(undefined)).toBe("unreadable");
  });
});
