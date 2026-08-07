import { describe, it, expect } from "vitest";
import { evidenceChain, stateCopy, formatWhen, railLabel } from "@/lib/signal-copy";
import type { Signal, SignalRail } from "@/lib/api/signals";

/**
 * ★EVERY FAILURE THIS FILE GUARDS AGAINST LOOKS THE SAME FROM THE OUTSIDE: a
 * confident sentence about the customer's website that we have no evidence for.
 * None of them throw, none of them fail a typecheck, and none of them are
 * visible without reading the copy against what the data actually means.
 */

const base = (over: Partial<Signal> = {}): Signal => ({
  provider: "linkedin_insight",
  partnerId: "1234567",
  siteKey: "0123456789abcdef0123456789abcdef",
  delivery: { rail: "manual", chosenAt: "2026-08-01T00:00:00.000Z", lastServedAt: null },
  verification: null,
  evidence: "declared",
  state: "never_fired",
  freshWindowDays: 7,
  ...over,
});

const withRail = (rail: SignalRail, over: Partial<Signal> = {}) =>
  base({ delivery: { rail, chosenAt: "2026-08-01T00:00:00.000Z", lastServedAt: null }, ...over });

describe("the evidence chain keeps three levels apart", () => {
  it("★a `manual` rail's middle step is NOT APPLICABLE, never a failure", () => {
    // The step that cannot exist on this rail: there is no server of ours in the
    // path, so nothing could observe a serve. Rendering it unchecked would tell
    // every copy-paste customer something is wrong with an installation that is
    // fine.
    const [, sent] = evidenceChain(withRail("manual"));
    expect(sent.reached).toBeNull();
    expect(sent.detail).not.toMatch(/hasn't|not yet|can't deliver/i);
  });

  it("★a `wordpress` rail with no serve does NOT promise a sync that does not exist", () => {
    // THE ASSERTION THAT WOULD HAVE MADE THE ORIGINAL BUG UNSHIPPABLE. Nothing
    // writes `lastServedAt` — there is no plugin-facing snippet endpoint — so
    // copy saying "it asks for this when it next syncs" told the customer to
    // wait for something that can never happen. Writing this test forces the
    // question "what sets lastServedAt?", which is how the defect surfaces.
    const [, sent] = evidenceChain(withRail("wordpress"));
    expect(sent.reached).toBe(false);
    expect(sent.detail).not.toMatch(/sync/i);
    expect(sent.detail).toMatch(/by hand/i);

    // And the state copy must not tell them to wait either.
    const body = stateCopy(withRail("wordpress")).body;
    expect(body).not.toMatch(/that's normal until|wait/i);
  });

  it("a served wordpress signal reports the serve as a fact with a time", () => {
    const [, sent] = evidenceChain(
      withRail("wordpress", {
        delivery: {
          rail: "wordpress",
          chosenAt: "2026-08-01T00:00:00.000Z",
          lastServedAt: new Date(Date.now() - 3_600_000).toISOString(),
        },
      }),
    );
    expect(sent.reached).toBe(true);
    expect(sent.detail).toMatch(/picked it up/i);
  });
});

describe("state copy never says more than the data supports", () => {
  const fired = (over: Partial<Signal["verification"]> = {}) =>
    base({
      state: "firing",
      evidence: "fired",
      verification: {
        firstFiredAt: new Date().toISOString(),
        lastFiredAt: new Date().toISOString(),
        lastFiredHost: "www.example.com",
        seenOnceOnly: true,
        ...over,
      } as Signal["verification"],
    });

  it("★a single fire does NOT claim the tag is installed on their site", () => {
    // A beacon proves a browser SOMEWHERE ran the snippet — the site key is in
    // the page source of every page carrying it — and one fire is most often the
    // customer testing on staging or localhost. The host is what makes the claim
    // checkable, so it has to appear in the sentence that makes it.
    const body = stateCopy(fired()).body;
    expect(body).not.toMatch(/enough to know it's installed/i);
    expect(body).toContain("www.example.com");
  });

  it("an unreadable host leaves no empty phrase behind", () => {
    const body = stateCopy(fired({ lastFiredHost: null })).body;
    expect(body).not.toMatch(/ on \.|on $|on ,/);
    expect(body).toMatch(/load(ed)? once/i);
  });

  it("★`not_seen_recently` never says broken, and never guesses which it is", () => {
    const body = stateCopy(
      base({
        state: "not_seen_recently",
        evidence: "fired",
        verification: {
          firstFiredAt: "2026-01-01T00:00:00.000Z",
          lastFiredAt: "2026-06-01T00:00:00.000Z",
          lastFiredHost: null,
          seenOnceOnly: false,
        },
      }),
    ).body;
    expect(body).not.toMatch(/broken|not working|failed/i);
    expect(body).toMatch(/can't tell/i);
  });

  it("★telling them to check says HOW, because the obvious way silently does nothing", () => {
    // The snippet beacons once per browser SESSION and the server coalesces for
    // 15 minutes, so "just visit your site" produces no change on this screen
    // for a customer who already has it open — after being told that is the
    // quickest way to find out.
    //
    // ★AND ON THE `wordpress` BRANCH TOO. A first cut looped over `base({state})`
    // only, and `base()` hardcodes `rail: "manual"` — so the branch round 1
    // rewrote was uncovered by the test that names its rule, and restoring
    // "then visit your site to confirm it" there left 11/11 green.
    const cases: Array<[string, Signal]> = [
      ["manual/never_fired", base({ state: "never_fired" })],
      ["manual/not_seen_recently", base({ state: "not_seen_recently" })],
      ["wordpress/never_fired", withRail("wordpress", { state: "never_fired" })],
      ["wordpress/not_seen_recently", withRail("wordpress", { state: "not_seen_recently" })],
    ];
    for (const [name, signal] of cases) {
      const body = stateCopy(signal).body;
      expect(body, name).toMatch(/private window|new window/i);
      expect(body, name).toMatch(/once per browser session/i);
    }
  });

  it("★carries no number that could be read as traffic — on EVERY branch", () => {
    // ★THE FIRST CUT LOOPED OVER `fired()`, WHOSE FIXTURE HARDCODES
    // `seenOnceOnly: true` — so the ONE string in the file that interpolates a
    // figure was never rendered by any test, and injecting "1,284 real visits"
    // left 11/11 green. The rule this file names first, guarded by a loop that
    // could not reach it.
    const bodies = [
      stateCopy(fired()).body,
      stateCopy(fired({ seenOnceOnly: false })).body,
      stateCopy(base({ state: "never_fired" })).body,
      stateCopy(withRail("wordpress", { state: "never_fired" })).body,
      stateCopy(base({ state: "not_seen_recently" })).body,
    ];
    for (const body of bodies) {
      // ★NO DIGIT AT ALL once the api's own freshness window is removed, rather
      // than a list of unit words. A blocklist only catches the phrasings
      // whoever wrote it imagined; "1,284 loads", "seen 12×" and "3 sessions"
      // all slip past one.
      expect(body.replace(/\b7 days\b/g, ""), body).not.toMatch(/\d/);
    }
  });
});

describe("railLabel", () => {
  it("describes what the rail DOES, so a card can name it without a legend", () => {
    expect(railLabel("manual")).toMatch(/paste/i);
    expect(railLabel("wordpress")).toMatch(/wordpress/i);
  });
});

describe("formatWhen", () => {
  it("never renders a negative age when a clock is skewed", () => {
    expect(formatWhen(new Date(Date.now() + 60_000).toISOString())).toBe("just now");
  });

  it("says so rather than inventing a time", () => {
    expect(formatWhen(undefined)).toBe("at an unknown time");
    expect(formatWhen("not a date")).toBe("at an unknown time");
  });
});
