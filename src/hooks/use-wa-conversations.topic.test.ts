import { describe, it, expect } from "vitest";
import { listParams } from "./use-wa-conversations";

describe("the conversation list asks for one insight topic", () => {
  it("sends topic when set, alongside the other filters", () => {
    expect(listParams({ topic: "delivery-times", tag: "t1", status: "open" }, undefined)).toEqual({ tag: "t1", topic: "delivery-times", status: "open" });
  });
  it("sends nothing for no topic", () => {
    expect(listParams({ topic: null }, undefined)).toEqual({});
    expect(listParams({}, "cur")).toEqual({ cursor: "cur" });
  });
});
