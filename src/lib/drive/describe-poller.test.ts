import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api/media", () => ({ getDescribeState: vi.fn() }));

const { DescribePoller, MAX_IDS_PER_ASK, defaultWaitMs } = await import("./describe-poller");
type Row = import("@/lib/api/media").DescribeStateRow;

/** A clock the test turns by hand, so "no timer" is something it can see rather than something it waits for. */
function harness(answer: (ids: string[]) => Row[] | Error, over: { hidden?: () => boolean } = {}) {
  const timers: Array<{ fn: () => void; ms: number; live: boolean }> = [];
  const asked: string[][] = [];
  const poller = new DescribePoller({
    fetchStates: async (ids) => {
      asked.push(ids);
      const r = answer(ids);
      if (r instanceof Error) throw r;
      return r;
    },
    setTimer: (fn, ms) => {
      const t = { fn, ms, live: true };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      (t as { live: boolean }).live = false;
    },
    hidden: over.hidden ?? (() => false),
    waitMs: defaultWaitMs,
  });
  const live = () => timers.filter((t) => t.live);
  /** Fire the pending timer and let the ask finish. */
  const turn = async () => {
    const t = live()[0];
    expect(t, "a timer was due").toBeDefined();
    t!.live = false;
    t!.fn();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  return { poller, asked, live, turn, timers };
}

const row = (id: string, describeState: Row["describeState"], over: Partial<Row> = {}): Row => ({ id, describeState, name: `name ${id}`, ...over });

describe("the describing poll runs only while something is waiting", () => {
  it("makes no request and holds no timer when nothing is watched, or when everything watched is already settled", async () => {
    const h = harness(() => []);
    expect(h.live()).toHaveLength(0);
    h.poller.watch("files", []);
    expect(h.live()).toHaveLength(0);
    expect(h.asked).toHaveLength(0);
    expect(h.poller.isRunning).toBe(false);
  });

  it("asks about the waiting ids, hands the rows back, and stops when the last one is named", async () => {
    let state: Row["describeState"] = "pending";
    const h = harness((ids) => ids.map((id) => row(id, state, state === "described" ? { name: "Gold tin with marigolds", tags: ["gold tin"] } : {})));
    const got: Row[][] = [];
    h.poller.subscribe((r) => got.push(r));
    h.poller.watch("files", ["a", "b"]);
    await h.turn();
    expect(h.asked[0]).toEqual(["a", "b"]);
    expect(h.live()).toHaveLength(1); // still waiting: another look is due
    state = "described";
    await h.turn();
    expect(got[1]![0]).toMatchObject({ describeState: "described", name: "Gold tin with marigolds", tags: ["gold tin"] });
    expect(h.live()).toHaveLength(0); // settled: nothing scheduled
    expect(h.poller.isRunning).toBe(false);
    expect(h.poller.watchedCount).toBe(0);
  });

  it("stops asking about a file the answer no longer returns (trashed or moved), and about one that will never be described", async () => {
    const h = harness((ids) => ids.filter((i) => i !== "gone").map((id) => row(id, id === "never" ? "not_described" : "pending")));
    h.poller.watch("files", ["gone", "never", "wait"]);
    await h.turn();
    await h.turn();
    expect(h.asked[1]).toEqual(["wait"]);
  });

  it("stops the timer when the page stops watching", async () => {
    const h = harness((ids) => ids.map((id) => row(id, "pending")));
    h.poller.watch("files", ["a"]);
    expect(h.live()).toHaveLength(1);
    h.poller.unwatch("files");
    expect(h.live()).toHaveLength(0);
    expect(h.poller.watchedCount).toBe(0);
  });

  it("asks about the union of what the grid and the tray watch, each ask once", async () => {
    const h = harness((ids) => ids.map((id) => row(id, "pending")));
    h.poller.watch("files", ["a", "b"]);
    h.poller.watch("tray", ["b", "c"]);
    await h.turn();
    expect(h.asked[0]!.sort()).toEqual(["a", "b", "c"]);
    h.poller.unwatch("files");
    await h.turn();
    expect(h.asked[1]!.sort()).toEqual(["b", "c"]);
  });

  it("never asks about more than 100 files in one request", async () => {
    const h = harness((ids) => ids.map((id) => row(id, "pending")));
    h.poller.watch("files", Array.from({ length: 130 }, (_, i) => `id${i}`));
    await h.turn();
    expect(h.asked[0]).toHaveLength(MAX_IDS_PER_ASK);
  });

  it("keeps the tile shimmering and tries again when a request fails; it never throws into the page", async () => {
    let fail = true;
    const h = harness((ids) => (fail ? new Error("offline") : ids.map((id) => row(id, "described"))));
    h.poller.watch("files", ["a"]);
    await h.turn();
    expect(h.live()).toHaveLength(1);
    fail = false;
    await h.turn();
    expect(h.live()).toHaveLength(0);
  });

  it("does not ask while the tab is hidden, and asks again when it is shown", async () => {
    let hidden = true;
    const h = harness((ids) => ids.map((id) => row(id, "described")), { hidden: () => hidden });
    h.poller.watch("files", ["a"]);
    await h.turn();
    expect(h.asked).toHaveLength(0);
    hidden = false;
    await h.turn();
    expect(h.asked).toHaveLength(1);
  });

  it("waits longer between asks the longer a file has taken", () => {
    expect(defaultWaitMs(0)).toBeLessThan(defaultWaitMs(50));
  });
});
