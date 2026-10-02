import { describe, it, expect } from "vitest";
import {
  childrenModeFor,
  isStaleKind,
  kindSelectOptions,
  kindsStateOf,
  resolveKindFilter,
  resolveShowChildren,
  type KindsState,
} from "./kind-filter";

const loaded: KindsState = { status: "success", kinds: ["ad_boost_launch", "newsletter_publish", "tag_drafts"] };
const pending: KindsState = { status: "pending" };
const failed: KindsState = { status: "error" };

describe("resolveKindFilter", () => {
  it("★a served kind is kept", () => {
    expect(resolveKindFilter("tag_drafts", loaded)).toBe("tag_drafts");
  });
  it("★★a kind the served list no longer has is 'all' (never filter by a kind the dropdown cannot show)", () => {
    expect(resolveKindFilter("retired_kind", loaded)).toBe("all");
  });
  it("★if the kinds failed to load: 'all'", () => {
    expect(resolveKindFilter("tag_drafts", failed)).toBe("all");
  });
  it("while loading, the chosen kind is kept", () => {
    expect(resolveKindFilter("tag_drafts", pending)).toBe("tag_drafts");
  });
});

describe("isStaleKind", () => {
  it("★only once the kinds have loaded and do not contain it", () => {
    expect(isStaleKind("retired_kind", loaded)).toBe(true);
    expect(isStaleKind("tag_drafts", loaded)).toBe(false);
    expect(isStaleKind("retired_kind", pending)).toBe(false);
    expect(isStaleKind("retired_kind", failed)).toBe(false);
    expect(isStaleKind("all", loaded)).toBe(false);
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
    expect(kindsStateOf({ data: { kinds }, isError: true })).toEqual({ status: "success", kinds });
  });
  it("★no data: error if it failed, else pending", () => {
    expect(kindsStateOf({ data: undefined, isError: true })).toEqual({ status: "error" });
    expect(kindsStateOf({ data: undefined, isError: false })).toEqual({ status: "pending" });
  });
});
