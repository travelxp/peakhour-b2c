/**
 * The one thing the Audience blocks must never do: report "not measured"
 * as "nothing happened".
 *
 * These numbers begin the day the hourly rollup first ran, and there is
 * no backfill — LinkedIn does not serve this history and the raw rows are
 * gone at 48 hours. So a 90-day view holding four days of data is a young
 * rollup, not a dead community, and the difference is invisible unless
 * something says so.
 */

import { describe, it, expect } from "vitest";
import { formatDuration } from "./audience-blocks";

describe("★how long someone has been waiting", () => {
  it("rounds DOWN to the leading unit", () => {
    // "3h" for 3h59m understates the wait. This number exists to prompt
    // action, and an overstatement that turned out to be rounding costs
    // more trust than the precision is worth.
    expect(formatDuration(3 * 3_600_000 + 59 * 60_000)).toBe("3h");
    expect(formatDuration(47 * 3_600_000)).toBe("1d");
  });

  it("does not render a sub-minute wait as 0m", () => {
    // "0m waiting" reads as a bug, or as nobody waiting at all.
    expect(formatDuration(20_000)).toBe("under a minute");
  });

  it("uses minutes below an hour and hours below a day", () => {
    expect(formatDuration(45 * 60_000)).toBe("45m");
    expect(formatDuration(5 * 3_600_000)).toBe("5h");
  });

  it("handles zero without producing a negative or empty string", () => {
    expect(formatDuration(0)).toBe("under a minute");
  });
});
