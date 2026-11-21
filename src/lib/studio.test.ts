import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { creativeApi, parseAvailability, STUDIO_CAPABILITIES, UNAVAILABLE, type PostIdea } from "@/lib/api/creative";
import { briefHref, capabilityState, goodUntil, hiddenUntilLine, ideasFeedStatus } from "@/lib/studio";
import { createDismissals } from "@/lib/studio-dismissals";
import { readFileSync } from "node:fs";

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

describe("creativeApi.availability", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a 404 (endpoint not deployed yet) is the answer 'not available yet'", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new ApiError("NOT_FOUND", "no", 404));
    expect(await creativeApi.availability()).toEqual(UNAVAILABLE);
  });

  it("any other failure throws, so it is never cached as the api saying 'coming soon, Pro tools off'", async () => {
    for (const err of [new ApiError("X", "boom", 500), new ApiError("AUTH", "no", 401), new TypeError("network")]) {
      vi.spyOn(api, "get").mockRejectedValue(err);
      await expect(creativeApi.availability()).rejects.toBe(err);
    }
  });

  it("a real answer is parsed, and read from the right path", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ capabilities: { previews: "on" }, proTools: true });
    const a = await creativeApi.availability();
    expect(get).toHaveBeenCalledWith("/v1/creative/studio/availability");
    expect(a.capabilities.previews).toBe("on");
    expect(a.proTools).toBe(true);
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
    // The festival's calendar date wins over the instant, and no time zone moves it.
    const f = idea({ kind: "festival", facts: { date: "2026-11-12" }, expiresAt: "2026-11-12T23:59:59.000-08:00" });
    expect(goodUntil(f, "en-GB")).toBe("Good until 12 Nov 2026");
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

describe("Not now and Undo", () => {
  const mk = (over: { dismiss?: () => Promise<unknown>; undismiss?: () => Promise<unknown> } = {}) => {
    const dismiss = vi.fn<(i: { id: string }) => Promise<unknown>>(over.dismiss ?? (async () => undefined));
    const undismiss = vi.fn<(i: { id: string }) => Promise<unknown>>(over.undismiss ?? (async () => undefined));
    const isGone = (e: unknown) => e instanceof ApiError && e.status === 404;
    return { dismiss, undismiss, d: createDismissals<{ id: string }>({ dismiss, undismiss, isGone }) };
  };

  it("sends the dismissal at once, with no waiting window", async () => {
    const { d, dismiss, undismiss } = mk();
    expect(await d.hide({ id: "a" })).toBe("hidden");
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledWith({ id: "a" });
    expect(undismiss).not.toHaveBeenCalled();
  });

  it("Undo calls the api's undismiss for that idea, once", async () => {
    const { d, undismiss } = mk();
    await d.hide({ id: "a" });
    expect(await d.undo({ id: "a" })).toBe("restored");
    expect(undismiss).toHaveBeenCalledTimes(1);
    expect(undismiss).toHaveBeenCalledWith({ id: "a" });
    // a second press has nothing left to take back
    expect(await d.undo({ id: "a" })).toBe("nothing");
    expect(undismiss).toHaveBeenCalledTimes(1);
  });

  it("Undo pressed while the dismissal is still on its way waits, so undismiss reaches the api after dismiss", async () => {
    const order: string[] = [];
    let release!: () => void;
    const { d } = mk({
      dismiss: () => new Promise<void>((r) => (release = () => (order.push("dismiss"), r()))),
      undismiss: async () => void order.push("undismiss"),
    });
    const hidden = d.hide({ id: "a" });
    const undone = d.undo({ id: "a" });
    await Promise.resolve();
    expect(order).toEqual([]);
    release();
    expect(await hidden).toBe("hidden");
    expect(await undone).toBe("restored");
    expect(order).toEqual(["dismiss", "undismiss"]);
  });

  it("a dismissal that failed or found the idea gone leaves nothing to undo", async () => {
    const failing = mk({ dismiss: async () => { throw new ApiError("X", "boom", 500); } });
    expect(await failing.d.hide({ id: "a" })).toBe("failed");
    expect(await failing.d.undo({ id: "a" })).toBe("nothing");
    expect(failing.undismiss).not.toHaveBeenCalled();
    const gone = mk({ dismiss: async () => { throw new ApiError("NOT_FOUND", "gone", 404); } });
    expect(await gone.d.hide({ id: "a" })).toBe("gone");
    expect(await gone.d.undo({ id: "a" })).toBe("nothing");
    expect(gone.undismiss).not.toHaveBeenCalled();
  });

  it("an undismiss that fails says so and the idea stays dismissed", async () => {
    const { d } = mk({ undismiss: async () => { throw new ApiError("X", "boom", 500); } });
    await d.hide({ id: "a" });
    expect(await d.undo({ id: "a" })).toBe("failed");
  });

  it("an Undo for an idea this page never hid does nothing", async () => {
    const { d, undismiss } = mk();
    expect(await d.undo({ id: "zzz" })).toBe("nothing");
    expect(undismiss).not.toHaveBeenCalled();
  });

  it("ideas are independent: undoing one never touches another", async () => {
    const { d, undismiss } = mk();
    await d.hide({ id: "a" });
    await d.hide({ id: "b" });
    await d.undo({ id: "b" });
    expect(undismiss.mock.calls.map((c) => c[0].id)).toEqual(["b"]);
  });

  it("the api client posts the id to /undismiss", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ id: "a", restored: true });
    await creativeApi.undismissPostIdea("a");
    expect(post).toHaveBeenCalledWith("/v1/creative/post-ideas/undismiss", { id: "a" });
    post.mockRestore();
  });

  it("the feed wires both calls and holds nothing back in the page (no delayed send, no pagehide flush)", () => {
    const src = readFileSync(new URL("../components/studio/ideas-feed.tsx", import.meta.url), "utf8");
    expect(src).toContain("creativeApi.dismissPostIdea(");
    expect(src).toContain("creativeApi.undismissPostIdea(");
    expect(src).not.toMatch(/pagehide|setTimeout|flush[(]/);
  });
});
