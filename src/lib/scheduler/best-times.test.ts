import { describe, it, expect } from "vitest";
import { bestTimeLine, type BestTimeView } from "./best-times";

const view = (over: Partial<BestTimeView> = {}): BestTimeView => ({ channel: "linkedin", source: "own", timezone: "Asia/Kolkata", label: "Tue 7 pm", scoredPosts: 31, ...over });

/** The words under a channel's time in the composer: the business's own best time and how many posts it comes from, or the typical one, said as typical. */
describe("bestTimeLine", () => {
  it("own: names the day and hour and the number of posts it comes from", () => {
    expect(bestTimeLine(view())).toBe("Your best time on LinkedIn: Tue 7 pm (from your last 31 posts)");
  });

  it("one post reads as one post", () => {
    expect(bestTimeLine(view({ scoredPosts: 1 }))).toBe("Your best time on LinkedIn: Tue 7 pm (from your last post)");
  });

  it("typical: says typical and gives no count", () => {
    expect(bestTimeLine(view({ source: "typical", label: "8 am", scoredPosts: 3 }))).toBe("Typical best time on LinkedIn: 8 am");
  });

  it("nothing to say is no line, never a made-up time", () => {
    expect(bestTimeLine(undefined)).toBeNull();
    expect(bestTimeLine(view({ label: null, source: "typical" }))).toBeNull();
  });

  it("names a channel as it is written", () => {
    expect(bestTimeLine(view({ channel: "x", label: "Fri 9 am", scoredPosts: 6 }))).toMatch(/^Your best time on X: Fri 9 am/);
  });

  it("says whose clock it is when the composer shows another zone", () => {
    expect(bestTimeLine(view(), "America/New_York")).toBe("Your best time on LinkedIn: Tue 7 pm (from your last 31 posts, Asia/Kolkata time)");
    expect(bestTimeLine(view(), "Asia/Kolkata")).toBe("Your best time on LinkedIn: Tue 7 pm (from your last 31 posts)");
  });

  it("never says 'from your last 0 posts'", () => {
    expect(bestTimeLine(view({ scoredPosts: 0 }))).toBe("Your best time on LinkedIn: Tue 7 pm");
  });
});
