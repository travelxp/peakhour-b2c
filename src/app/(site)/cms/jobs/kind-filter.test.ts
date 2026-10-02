import { describe, it, expect } from "vitest";
import {
  childrenModeFor,
  effectiveKind,
  ignoredKind,
  kindSelectOptions,
  kindsStateOf,
  resolveShowChildren,
  type KindsState,
} from "./kind-filter";

const loaded: KindsState = { status: "success", kinds: ["ad_boost_launch", "newsletter_publish", "tag_drafts"], complete: true };
const pending: KindsState = { status: "pending" };
const failed: KindsState = { status: "error" };
const paused: KindsState = { status: "paused" };

describe("effectiveKind", () => {
  it("★a served kind is kept", () => {
    expect(effectiveKind("tag_drafts", loaded)).toBe("tag_drafts");
  });
  it("★★a kind the served list no longer has is 'all' (never filter by a kind the dropdown cannot show)", () => {
    expect(effectiveKind("retired_kind", loaded)).toBe("all");
  });
  it("'all' is 'all'", () => {
    expect(effectiveKind("all", loaded)).toBe("all");
  });
});

describe("ignoredKind — ignored, not reset (round 2), and said which", () => {
  it("★only once the kinds have loaded and do not contain it", () => {
    expect(ignoredKind("retired_kind", loaded)).toBe("unknown");
    expect(ignoredKind("tag_drafts", loaded)).toBeNull();
    expect(ignoredKind("retired_kind", pending)).toBeNull();
    expect(ignoredKind("retired_kind", paused)).toBeNull();
    expect(ignoredKind("retired_kind", failed)).toBeNull();
    expect(ignoredKind("all", loaded)).toBeNull();
  });
  it("★★a kind back in the next answer applies again", () => {
    const short: KindsState = { status: "success", kinds: ["ad_boost_launch"], complete: true };
    expect(effectiveKind("tag_drafts", short)).toBe("all");
    expect(effectiveKind("tag_drafts", loaded)).toBe("tag_drafts");
  });
  it("★★an INCOMPLETE answer lacking it is partial, not unknown (cms#175 parity)", () => {
    const degraded: KindsState = { status: "success", kinds: ["ad_boost_launch"], complete: false };
    expect(ignoredKind("tag_drafts", degraded)).toBe("partial");
    expect(effectiveKind("tag_drafts", degraded)).toBe("all");
  });
});

describe("kindSelectOptions", () => {
  it("★the served kinds once loaded, else none", () => {
    expect(kindSelectOptions(loaded)).toEqual(["ad_boost_launch", "newsletter_publish", "tag_drafts"]);
    expect(kindSelectOptions(pending)).toEqual([]);
    expect(kindSelectOptions(failed)).toEqual([]);
  });
});

describe("resolveShowChildren", () => {
  it("★★auto: ON for a chosen kind, OFF again with 'All kinds'", () => {
    expect(resolveShowChildren("auto", "tag_drafts")).toBe(true);
    expect(resolveShowChildren("auto", "all")).toBe(false);
  });
  it("★★an explicit 'off' survives a change of kind (round 1)", () => {
    expect(resolveShowChildren("off", "voice_card_refresh")).toBe(false);
  });
  it("★an explicit 'on' holds with 'All kinds'", () => {
    expect(resolveShowChildren("on", "all")).toBe(true);
  });
});

describe("childrenModeFor — the toggle returns to auto", () => {
  it("★★switching back to what auto does sets auto, not a pinned choice", () => {
    expect(childrenModeFor(false, "all")).toBe("auto");
    expect(childrenModeFor(true, "tag_drafts")).toBe("auto");
  });
  it("★against auto it is explicit", () => {
    expect(childrenModeFor(true, "all")).toBe("on");
    expect(childrenModeFor(false, "tag_drafts")).toBe("off");
  });
});

describe("kindsStateOf", () => {
  const kinds = ["tag_drafts"];
  it("★★a failed background refetch keeps the loaded kinds, with the api's complete", () => {
    expect(kindsStateOf({ data: { kinds, complete: true }, isError: true, isPaused: false })).toEqual({ status: "success", kinds, complete: true });
    expect(kindsStateOf({ data: { kinds, complete: false }, isError: false, isPaused: true })).toEqual({ status: "success", kinds, complete: false });
  });
  it("★no data: error if it failed, else pending", () => {
    expect(kindsStateOf({ data: undefined, isError: true, isPaused: false })).toEqual({ status: "error" });
    expect(kindsStateOf({ data: undefined, isError: false, isPaused: false })).toEqual({ status: "pending" });
  });
  it("★★paused with no data is 'paused', not an error: a retry may only be waiting for focus (cms#175)", () => {
    expect(kindsStateOf({ data: undefined, isError: false, isPaused: true })).toEqual({ status: "paused" });
    expect(kindsStateOf({ data: undefined, isError: true, isPaused: true })).toEqual({ status: "error" });
  });
});
