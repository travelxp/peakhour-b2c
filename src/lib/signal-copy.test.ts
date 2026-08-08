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

  it("★★a `wordpress` rail NEVER tells the customer to paste the snippet", () => {
    // ★THE RULE CHANGED WITH THE FEATURE, AND THIS IS THE STRONGER VERSION.
    // While no rail could deliver, the honest copy was "add it by hand"; now
    // that the plugin prints the tag, that same sentence installs it TWICE —
    // two Insight Tags, two beacons. The api refuses to serve a `manual` row
    // over this rail for exactly that reason, and copy is the other half of it.
    //
    // Asserted across every state a wordpress-rail signal can be in, because
    // the instruction is wrong in all of them and the previous test covered one.
    const states = ["never_fired", "not_seen_recently", "firing"] as const;
    for (const state of states) {
      for (const served of [null, "2026-08-08T10:00:00.000Z"]) {
       for (const onceOnly of [true, false]) {
        for (const railOffered of [true, false]) {
        const signal = withRail("wordpress", {
          state,
          delivery: { rail: "wordpress", chosenAt: "2026-08-01T00:00:00.000Z", lastServedAt: served },
          verification:
            state === "never_fired"
              ? null
              : {
                  // ★`seenOnceOnly` IS DERIVED FROM THE TWO TIMESTAMPS BEING
                  // EQUAL (the api derives it exactly so), and a first cut set
                  // equal timestamps with `seenOnceOnly: false` — a combination
                  // the api cannot produce, which quietly meant the loop never
                  // rendered the single-fire branch at all.
                  firstFiredAt: "2026-08-01T00:00:00.000Z",
                  lastFiredAt: onceOnly ? "2026-08-01T00:00:00.000Z" : "2026-08-02T00:00:00.000Z",
                  lastFiredHost: "www.example.com",
                  seenOnceOnly: onceOnly,
                },
        });
        const where = `${state}/${served ? "served" : "unserved"}/once=${onceOnly}/offered=${railOffered}`;
        const [, sent] = evidenceChain(signal, railOffered);
        const body = stateCopy(signal, railOffered).body;
        // ★NEVER "add it by hand" — that is the double-install. "switch … to
        // pasting" IS allowed and is the honest remedy when the rail is gone,
        // because switching REPLACES the delivery rather than adding to it.
        expect(sent.detail, where).not.toMatch(/by hand|paste the snippet in|add the snippet/i);
        expect(body, where).not.toMatch(/by hand|add the snippet/i);
        // ★AND THE CHECK HINT ONLY WHERE A CHECK CAN CHANGE ANYTHING — i.e. once
        // the plugin has actually fetched. A first cut applied this to
        // `never_fired` and not `not_seen_recently`, and the mutation survived.
        if (!served) expect(body, where).not.toMatch(/private window/i);
       }
      }
      }
    }

    // And it still must not promise a sync in words that read as a deadline, or
    // tell them to wait for something that has already happened.
    const unserved = evidenceChain(withRail("wordpress"))[1];
    expect(unserved.reached).toBe(false);
    expect(unserved.detail).toMatch(/hourly/i);
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
    // ★THE HINT BELONGS WHERE A CHECK IS ACTIONABLE, AND NOWHERE ELSE. A
    // wordpress-rail signal the plugin has not fetched yet is waiting on US,
    // not on the customer — telling them to open a private window there is
    // busywork that cannot change the state, which is its own kind of false
    // advice. So the served/unserved distinction is part of the rule, not an
    // exception to it.
    const served = (over: Partial<Signal> = {}) =>
      withRail("wordpress", {
        delivery: {
          rail: "wordpress",
          chosenAt: "2026-08-01T00:00:00.000Z",
          lastServedAt: "2026-08-08T10:00:00.000Z",
        },
        ...over,
      });
    const cases: Array<[string, Signal]> = [
      ["manual/never_fired", base({ state: "never_fired" })],
      ["manual/not_seen_recently", base({ state: "not_seen_recently" })],
      ["wordpress/served/never_fired", served({ state: "never_fired" })],
      // ★SERVED, because on this rail the hint is only shown once the plugin
      // HAS the snippet — before that, opening a private window cannot change
      // anything, and the companion test above asserts the hint is absent there.
      ["wordpress/served/not_seen_recently", served({ state: "not_seen_recently" })],
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
