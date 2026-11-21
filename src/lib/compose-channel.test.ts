import { describe, expect, it } from "vitest";
import { composeHref, isComposeChannel, parseComposeParam } from "./compose-channel";

describe("the ?compose= contract", () => {
  it("1 opens the sheet and asks which channel", () => {
    expect(parseComposeParam("1")).toEqual({ open: true, channel: null });
  });
  it.each(["linkedin", "x", "facebook", "instagram", "threads"])("%s opens the sheet on that channel", (c) => {
    expect(parseComposeParam(c)).toEqual({ open: true, channel: c });
  });
  it.each([null, undefined, "", "0", "tiktok", "LinkedIn", "newsletter"])("%s opens nothing", (v) => {
    expect(parseComposeParam(v)).toEqual({ open: false });
  });
  it("composeHref round-trips through parseComposeParam", () => {
    expect(composeHref()).toBe("/dashboard/calendar?compose=1");
    expect(composeHref("threads")).toBe("/dashboard/calendar?compose=threads");
    const raw = new URL(composeHref("x"), "https://x.test").searchParams.get("compose");
    expect(parseComposeParam(raw)).toEqual({ open: true, channel: "x" });
  });
  it("knows its channels", () => {
    expect(isComposeChannel("x")).toBe(true);
    expect(isComposeChannel("tiktok")).toBe(false);
  });
});
