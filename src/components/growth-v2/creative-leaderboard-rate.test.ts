import { describe, expect, it } from "vitest";
import { formatRate } from "./creative-leaderboard";

describe("formatRate", () => {
  it("never shows a real but small rate as 0", () => {
    expect(formatRate(0.04)).toBe("under 0.1");
    expect(formatRate(0.099)).toBe("under 0.1");
    expect(formatRate(0.1)).toBe("0.1");
    expect(formatRate(0)).toBe("0");
  });
  it("otherwise reads like every other count, to one decimal", () => {
    expect(formatRate(0.44)).toBe("0.4");
    expect(formatRate(12.4)).toBe("12.4");
  });
});
