import { describe, expect, it } from "vitest";
import type { BatchPreview, BatchView } from "@/lib/api/creative-studio";
import {
  actionableSelection,
  approvedForFinal,
  filterCounts,
  filterTiles,
  gridTiles,
  liveSelection,
  moveFocus,
  shortcutFor,
  toggleAll,
  toggleSelected,
  undoOf,
} from "./studio-batch";

const p = (id: string, over: Partial<BatchPreview> = {}): BatchPreview => ({
  id,
  creativeId: `c-${id}`,
  state: "ready",
  liked: false,
  index: 0,
  thumbUrl: null,
  productTitle: null,
  headline: null,
  lapsed: false,
  ...over,
});

const tiles = [
  p("a"),
  p("b", { liked: true, state: "shortlisted" }),
  p("c", { lapsed: true }),
  p("d", { state: "finalizing", liked: true }),
  p("e", { state: "failed" }),
  p("f", { state: "rendering" }),
];

describe("the grid's tiles and filters (S16)", () => {
  it("shows only previews that came through", () => {
    const batch = { previews: tiles } as BatchView;
    expect(gridTiles(batch).map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("filters: waiting is untouched and still actionable; approved is hearted; changed is lapsed", () => {
    const t = gridTiles({ previews: tiles } as BatchView);
    expect(filterTiles(t, "waiting").map((x) => x.id)).toEqual(["a"]);
    expect(filterTiles(t, "approved").map((x) => x.id)).toEqual(["b", "d"]);
    expect(filterTiles(t, "changed").map((x) => x.id)).toEqual(["c"]);
    expect(filterTiles(t, "all")).toHaveLength(4);
    expect(filterCounts(t)).toEqual({ all: 4, waiting: 1, approved: 2, changed: 1 });
  });

  it("only a shortlisted, un-lapsed preview is ready for Make final (one being made is not)", () => {
    expect(approvedForFinal(gridTiles({ previews: tiles } as BatchView)).map((x) => x.id)).toEqual(["b"]);
  });
});

describe("selection", () => {
  const t = gridTiles({ previews: tiles } as BatchView);

  it("a bulk action reaches only selected previews that can take it", () => {
    expect(actionableSelection(t, new Set(["a", "d", "zz"]))).toEqual(["a"]);
  });

  it("a tile that left the page drops out of the count", () => {
    expect([...liveSelection(t, new Set(["a", "gone"]))]).toEqual(["a"]);
  });

  it("toggle adds and removes; select-all selects the visible actionable ones, then clears them", () => {
    expect([...toggleSelected(new Set(["a"]), "b")]).toEqual(["a", "b"]);
    expect([...toggleSelected(new Set(["a"]), "a")]).toEqual([]);
    const all = toggleAll(t, new Set());
    expect([...all].sort()).toEqual(["a", "b", "c"]);
    expect([...toggleAll(t, all)]).toEqual([]);
  });
});

describe("keyboard", () => {
  it("arrows move along a row and between rows, and stay put at the edge", () => {
    expect(moveFocus(0, "ArrowRight", 4, 10)).toBe(1);
    expect(moveFocus(1, "ArrowDown", 4, 10)).toBe(5);
    expect(moveFocus(5, "ArrowUp", 4, 10)).toBe(1);
    expect(moveFocus(0, "ArrowLeft", 4, 10)).toBe(0);
    expect(moveFocus(9, "ArrowDown", 4, 10)).toBe(9);
    expect(moveFocus(0, "ArrowRight", 4, 0)).toBe(0);
  });

  it("A approves, X rejects, Z undoes, Space selects, ? helps; a modified key is the browser's", () => {
    expect(shortcutFor({ key: "a" })).toBe("approve");
    expect(shortcutFor({ key: "X" })).toBe("reject");
    expect(shortcutFor({ key: "z" })).toBe("undo");
    expect(shortcutFor({ key: " " })).toBe("select");
    expect(shortcutFor({ key: "?" })).toBe("help");
    expect(shortcutFor({ key: "a", ctrlKey: true })).toBeNull();
    expect(shortcutFor({ key: "z", metaKey: true })).toBeNull();
    expect(shortcutFor({ key: "q" })).toBeNull();
  });

  it("undo reverses a heart change and cannot reverse a skip", () => {
    expect(undoOf("approve")).toBe("clear");
    expect(undoOf("clear")).toBe("approve");
    expect(undoOf("reject")).toBeNull();
  });
});
