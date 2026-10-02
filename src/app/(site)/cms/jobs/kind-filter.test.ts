import { describe, it, expect } from "vitest";
import {
  childrenModeFor,
  effectiveKind,
  isUnknownKind,
  kindSelectOptions,
  kindsStateOf,
  resolveShowChildren,
  type KindsState,
} from "./kind-filter";

const loaded: KindsState = { status: "success", kinds: ["ad_boost_launch", "newsletter_publish", "tag_drafts"] };
const pending: KindsState = { status: "pending" };
const failed: KindsState = { status: "error" };

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

describe("isUnknownKind — ignored, not reset (round 2)", () => {
  it("★only once the kinds have loaded and do not contain it", () => {
    expect(isUnknownKind("retired_kind", loaded)).toBe(true);
    expect(isUnknownKind("tag_drafts", loaded)).toBe(false);
    expect(isUnknownKind("retired_kind", pending)).toBe(false);
    expect(isUnknownKind("retired_kind", failed)).toBe(false);
    expect(isUnknownKind("all", loaded)).toBe(false);
  });
  it("★★a kind back in the next answer applies again", () => {
    const degraded: KindsState = { status: "success", kinds: ["ad_boost_launch"] };
    expect(effectiveKind("tag_drafts", degraded)).toBe("all");
    expect(effectiveKind("tag_drafts", loaded)).toBe("tag_drafts");
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
  it("★★a failed background refetch keeps the loaded kinds", () => {
    expect(kindsStateOf({ data: { kinds }, isError: true, isPaused: false })).toEqual({ status: "success", kinds });
    expect(kindsStateOf({ data: { kinds }, isError: false, isPaused: true })).toEqual({ status: "success", kinds });
  });
  it("★no data: error if it failed, else pending", () => {
    expect(kindsStateOf({ data: undefined, isError: true, isPaused: false })).toEqual({ status: "error" });
    expect(kindsStateOf({ data: undefined, isError: false, isPaused: false })).toEqual({ status: "pending" });
  });
  it("★★paused with no data (offline) is an error, not loading forever (round 3)", () => {
    expect(kindsStateOf({ data: undefined, isError: false, isPaused: true })).toEqual({ status: "error" });
  });
});
