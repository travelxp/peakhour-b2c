import { describe, it, expect } from "vitest";
import { queryViewState } from "./query-view-state";

const q = (o: Partial<Parameters<typeof queryViewState>[0]>) => ({
  isPending: false,
  isError: false,
  data: undefined as unknown,
  fetchStatus: "idle" as const,
  ...o,
});

describe("queryViewState", () => {
  it("is loading while the first fetch runs", () => {
    expect(queryViewState(q({ isPending: true, fetchStatus: "fetching" }))).toBe("loading");
  });
  it("is offline, not loading and not empty, for a paused pending query", () => {
    expect(queryViewState(q({ isPending: true, fetchStatus: "paused" }))).toBe("offline");
  });
  it("is error when the request failed with nothing to show", () => {
    expect(queryViewState(q({ isError: true }))).toBe("error");
  });
  it("keeps stale data on screen when only a background refetch failed", () => {
    expect(queryViewState(q({ isError: true, data: [] }))).toBe("ready");
  });
  it("a retry with no data goes back to loading, not error", () => {
    expect(queryViewState(q({ isPending: true, isError: false, fetchStatus: "fetching" }))).toBe("loading");
  });
  it("an empty array is ready (the caller draws the zero state)", () => {
    expect(queryViewState(q({ data: [] }))).toBe("ready");
  });
});
