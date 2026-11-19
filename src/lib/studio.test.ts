import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAvailability, STUDIO_CAPABILITIES, UNAVAILABLE, type PostIdea } from "@/lib/api/creative";
import { briefHref, capabilityState, goodUntil, hiddenUntilLine, ideasFeedStatus } from "@/lib/studio";
import { createDismissalQueue } from "@/lib/studio-dismissals";

const idea = (over: Partial<PostIdea> = {}): PostIdea => ({
  id: "low_stock:1",
  kind: "low_stock",
  reason: "Silk saree is nearly sold out, with only 2 left.",
  productIds: ["p1"],
  products: [{ id: "p1", title: "Silk saree" }],
  format: "story",
  facts: {},
  expiresAt: "2026-11-22T00:00:00.000Z",
  ...over,
});

describe("parseAvailability (read defensively)", () => {
  it("an answer that is not an object means nothing is available and Pro tools is off", () => {
    for (const raw of [undefined, null, "on", 7, [], true]) expect(parseAvailability(raw)).toEqual(UNAVAILABLE);
  });

  it("only the exact string 'on' turns a capability on", () => {
    const a = parseAvailability({ capabilities: { previews: "on", final: true, extend: "ON", video: "coming_soon", textAds: 1 } });
    expect(a.capabilities.previews).toBe("on");
    for (const c of STUDIO_CAPABILITIES.filter((c) => c !== "previews")) expect(a.capabilities[c], c).toBe("coming_soon");
    expect(a.known).toBe(true);
  });

  it("accepts the map at the top level as well as under 'capabilities'", () => {
    expect(parseAvailability({ previews: "on", proTools: true }).capabilities.previews).toBe("on");
  });

  it("Pro tools is on only for the boolean true", () => {
    for (const v of ["true", 1, "on", null, undefined]) expect(parseAvailability({ capabilities: {}, proTools: v }).proTools, String(v)).toBe(false);
    expect(parseAvailability({ capabilities: {}, proTools: true }).proTools).toBe(true);
  });

  it("the unavailable answer has every capability coming soon and Pro tools off", () => {
    for (const c of STUDIO_CAPABILITIES) expect(capabilityState(UNAVAILABLE, c)).toBe("coming_soon");
    expect(UNAVAILABLE.proTools).toBe(false);
    expect(UNAVAILABLE.known).toBe(false);
  });
});

describe("ideasFeedStatus", () => {
  const base = { data: undefined, errorUpdatedAt: 0, fetchStatus: "fetching" as const };
  it("loading until there is data or an error", () => expect(ideasFeedStatus(base)).toBe("loading"));
  it("an offline (paused) query with no data is offline, not an empty answer", () => {
    expect(ideasFeedStatus({ ...base, fetchStatus: "paused" })).toBe("offline");
  });
  it("an error stamp with no data is an error, and stays one while the refetch runs", () => {
    // v5 clears `error` at the start of each refetch of a query with no data; errorUpdatedAt is not cleared.
    expect(ideasFeedStatus({ ...base, errorUpdatedAt: 5 })).toBe("error");
  });
  it("held data wins over a later failed refetch", () => {
    expect(ideasFeedStatus({ data: { ideas: [] }, errorUpdatedAt: 9, fetchStatus: "idle" })).toBe("ready");
  });
});

describe("idea helpers", () => {
  it("'Make previews' goes to the brief with the idea id, encoded", () => {
    expect(briefHref("festival:IN:Diwali:2026")).toBe("/dashboard/studio/new?idea=festival%3AIN%3ADiwali%3A2026");
  });

  it("only a festival idea says 'Good until'", () => {
    expect(goodUntil(idea(), "en-GB")).toBeNull();
    expect(goodUntil(idea({ kind: "festival" }), "en-GB")).toMatch(/^Good until \d{1,2} \w+ 2026$/);
    expect(goodUntil(idea({ kind: "festival", expiresAt: "nonsense" }), "en-GB")).toBeNull();
  });

  it("an ordinary idea is hidden for the cooling days; a festival until after it", () => {
    const now = new Date("2026-11-19T00:00:00.000Z");
    expect(hiddenUntilLine(idea(), 14, now, "en-GB")).toBe("Okay, we won't suggest this again until 3 Dec 2026.");
    expect(hiddenUntilLine(idea({ kind: "festival", facts: { festival: "Diwali" } }), 14, now, "en-GB")).toBe(
      "Okay, we won't suggest this again until after Diwali.",
    );
    // A festival idea whose name is missing falls back to the cooling days rather than saying "after undefined".
    expect(hiddenUntilLine(idea({ kind: "festival", facts: {} }), 14, now, "en-GB")).toContain("3 Dec 2026");
  });
});

describe("the undo window", () => {
  afterEach(() => vi.useRealTimers());
  const mk = () => {
    vi.useFakeTimers();
    const send = vi.fn<(i: { id: string }) => Promise<void>>(async () => undefined);
    return { send, q: createDismissalQueue<{ id: string }>({ windowMs: 6000, send }) };
  };

  it("sends nothing inside the window and sends once when it closes", () => {
    const { q, send } = mk();
    q.hide({ id: "a" });
    vi.advanceTimersByTime(5999);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ id: "a" });
    expect(q.pendingIds()).toEqual([]);
  });

  it("undo inside the window means the api never hears of it", () => {
    const { q, send } = mk();
    q.hide({ id: "a" });
    expect(q.undo("a")).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(send).not.toHaveBeenCalled();
  });

  it("undo after the window closed is a no-op that says so", () => {
    const { q } = mk();
    q.hide({ id: "a" });
    vi.advanceTimersByTime(6000);
    expect(q.undo("a")).toBe(false);
  });

  it("flush (the page was left) sends every pending one now, once each", () => {
    const { q, send } = mk();
    q.hide({ id: "a" });
    q.hide({ id: "b" });
    q.flush();
    expect(send.mock.calls.map((c) => c[0].id).sort()).toEqual(["a", "b"]);
    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("hiding the same idea twice restarts its window and still sends once", () => {
    const { q, send } = mk();
    q.hide({ id: "a" });
    vi.advanceTimersByTime(4000);
    q.hide({ id: "a" });
    vi.advanceTimersByTime(4000);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
