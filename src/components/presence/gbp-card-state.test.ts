import { describe, it, expect } from "vitest";
import {
  gbpCardState,
  canSaveLocation,
  locationLabel,
  type GbpConnectionStatus,
} from "./gbp-card-state";

/**
 * The Presence card's branches.
 *
 * ★★THE STATE THIS FILE EXISTS FOR IS `needs_location`. A merchant managing two
 * listings connected successfully, saw a connected card, and received nothing —
 * no metrics, no reviews, silently, for ever. "Connected" and "connected but
 * useless" look identical unless something decides they do not.
 */

describe("gbpCardState", () => {
  const cases: Array<{
    what: string;
    status: GbpConnectionStatus;
    location: string | null;
    kind: string;
    canPick: boolean;
  }> = [
    { what: "never connected", status: undefined, location: null, kind: "disconnected", canPick: false },
    { what: "disconnected", status: "disconnected", location: null, kind: "disconnected", canPick: false },
    { what: "active with a listing", status: "active", location: "locations/1", kind: "ready", canPick: true },
    { what: "active with NO listing", status: "active", location: null, kind: "needs_location", canPick: true },
    { what: "expired", status: "expired", location: "locations/1", kind: "needs_reconnect", canPick: false },
    { what: "needs_reauth", status: "needs_reauth", location: "locations/1", kind: "needs_reconnect", canPick: false },
    // ★`error` is a sync failure, not an auth one — changing the listing may be
    // the fix, so the picker stays reachable. Same split as the analytics and
    // search-console pages.
    { what: "error with a listing", status: "error", location: "locations/1", kind: "ready", canPick: true },
    { what: "error with no listing", status: "error", location: null, kind: "needs_location", canPick: true },
  ];

  for (const c of cases) {
    it(c.what, () => {
      const s = gbpCardState(c.status, c.location);
      expect(s.kind).toBe(c.kind);
      expect(s.canPick).toBe(c.canPick);
    });
  }

  it("★★a dead token never offers the picker — that route 409s", () => {
    // Offering "Choose your listing" on an expired connection sends the
    // merchant at `GET /gbp-locations`, which cannot refresh the token and
    // answers REAUTH_REQUIRED. The card must ask for the reconnect instead.
    for (const status of ["expired", "needs_reauth"] as const) {
      expect(gbpCardState(status, null).canPick).toBe(false);
      expect(gbpCardState(status, null).action).toBe("Reconnect");
    }
  });

  it("★the action label distinguishes first choice from a change", () => {
    expect(gbpCardState("active", null).action).toBe("Choose your listing");
    expect(gbpCardState("active", "locations/1").action).toBe("Change listing");
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
    // and true.
    expect(locationLabel("locations/2", known)).toBe("locations/2");
  });

  it("★a whitespace-only title is not a title", () => {
    expect(locationLabel("locations/3", known)).toBe("locations/3");
  });

  it("★and a listing missing from the list still gets a label", () => {
    // The captured set can be short, or the picker may not have loaded yet —
    // neither is a reason to render nothing where a name belongs.
    expect(locationLabel("locations/9", known)).toBe("locations/9");
  });

  it("nothing selected is nothing to label", () => {
    expect(locationLabel(null, known)).toBeNull();
    expect(locationLabel(undefined, known)).toBeNull();
  });
});
