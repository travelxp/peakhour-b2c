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
    const [, sent] = evidenceChain(withRail("manual"), true);
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
    const unserved = evidenceChain(withRail("wordpress"), true)[1];
    expect(unserved.reached).toBe(false);
    expect(unserved.detail).toMatch(/about once an hour/i);
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
      true,
    );
    expect(sent.reached).toBe(true);
    // ★"FETCHED", NEVER "PUT IT ON YOUR SITE". `lastServedAt` records that the
    // plugin ASKED US for the snippet; it is not evidence that any page printed
    // it. The plugin's own header states the rule — printing is not evidence —
    // and a first cut of this copy asserted delivery from this field.
    expect(sent.detail).toMatch(/fetched it/i);
    expect(sent.detail).not.toMatch(/putting it on your site|is being delivered/i);
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
    const body = stateCopy(fired(), true).body;
    expect(body).not.toMatch(/enough to know it's installed/i);
    expect(body).toContain("www.example.com");
  });

  it("an unreadable host leaves no empty phrase behind", () => {
    const body = stateCopy(fired({ lastFiredHost: null }), true).body;
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
      true,
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
      const body = stateCopy(signal, true).body;
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
      stateCopy(fired(), true).body,
      stateCopy(fired({ seenOnceOnly: false }), true).body,
      stateCopy(base({ state: "never_fired" }), true).body,
      stateCopy(withRail("wordpress", { state: "never_fired" }), true).body,
      stateCopy(base({ state: "not_seen_recently" }), true).body,
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

describe("★the railOffered mechanism itself — asserted positively, not by absence", () => {
  // ★ROUND 1 ADDED `railOffered` AND NOTHING CHECKED IT. Neutering it entirely —
  // treating every wordpress signal as offered — left the whole suite green,
  // because every assertion around it was a NEGATIVE ("does not say paste",
  // "does not say private window") that holds identically either way. A
  // mechanism guarded only by negatives is a mechanism that can be deleted.
  const wp = (over: Partial<Signal> = {}) =>
    withRail("wordpress", {
      delivery: { rail: "wordpress", chosenAt: "2026-08-01T00:00:00.000Z", lastServedAt: null },
      ...over,
    });

  it("★a withdrawn rail says we have LOST TRACK — never that nothing is delivering", () => {
    // The plugin CACHES the snippet and prints from cache; its own docblock is
    // "a failed fetch keeps the previous answer". So a site that stopped
    // checking in may well still be printing the tag, and a first cut said
    // "nothing is putting the tag on your site" — directly above a green
    // "last fetched it" tick.
    for (const state of ["never_fired", "not_seen_recently"] as const) {
      const signal = wp({
        state,
        delivery: {
          rail: "wordpress",
          chosenAt: "2026-08-01T00:00:00.000Z",
          lastServedAt: "2026-08-07T00:00:00.000Z",
        },
        verification:
          state === "never_fired"
            ? null
            : {
                firstFiredAt: "2026-06-01T00:00:00.000Z",
                lastFiredAt: "2026-06-01T00:00:00.000Z",
                lastFiredHost: null,
                seenOnceOnly: true,
              },
      });
      const body = stateCopy(signal, false).body;
      expect(body, state).toMatch(/lost track/i);
      expect(body, state).not.toMatch(/nothing is putting|stopped putting/i);
      // And it differs from the offered wording, which is what a neutered
      // `railOffered` would collapse.
      expect(body, state).not.toBe(stateCopy(signal, true).body);
      expect(evidenceChain(signal, false)[1].detail).not.toBe(
        evidenceChain(signal, true)[1].detail,
      );
    }
  });

  it("★a withdrawn rail names all three causes, not just a dead plugin", () => {
    // The api withdraws it when the connection is inactive, when the site is
    // bound to another business, OR when it has not asked in 14 days.
    // "Reactivate the plugin" is the wrong instruction for the first two.
    const body = stateCopy(wp({ state: "never_fired" }), false).body;
    expect(body).toMatch(/connected/i);
    expect(body).toMatch(/integrations/i);
    expect(body).toMatch(/past(e|ing)/i);
  });

  it("★★'nothing to do' expires on its own, because railOffered does not bound it", () => {
    // The api stamps the ask BEFORE its own early returns — including the one
    // its comment calls "the state a customer cannot get out of by themselves"
    // — so a signal can sit offered-and-unfetched forever. After a day, an
    // unfetched signal is evidence AGAINST the promise.
    const fresh = wp({
      state: "never_fired",
      delivery: {
        rail: "wordpress",
        chosenAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        lastServedAt: null,
      },
    });
    const old = wp({
      state: "never_fired",
      delivery: {
        rail: "wordpress",
        chosenAt: new Date(Date.now() - 72 * 3_600_000).toISOString(),
        lastServedAt: null,
      },
    });
    expect(stateCopy(fresh, true).body).toMatch(/nothing to do/i);
    expect(stateCopy(old, true).body).not.toMatch(/nothing to do/i);
    expect(stateCopy(old, true).body).toMatch(/something is in the way/i);
  });

  it("★a fetch is never reported as a delivery", () => {
    // `lastServedAt` records that the plugin ASKED US. It is not evidence that
    // any page printed anything — deactivate the plugin and printing stops while
    // the fetch stamp stays fresh for a fortnight.
    const served = wp({
      state: "not_seen_recently",
      delivery: {
        rail: "wordpress",
        chosenAt: "2026-08-01T00:00:00.000Z",
        lastServedAt: "2026-08-08T10:00:00.000Z",
      },
      verification: {
        firstFiredAt: "2026-06-01T00:00:00.000Z",
        lastFiredAt: "2026-06-01T00:00:00.000Z",
        lastFiredHost: null,
        seenOnceOnly: true,
      },
    });
    const body = stateCopy(served, true).body;
    expect(body).not.toMatch(/is being delivered|putting it on your site/i);
    // ★AND IT KEEPS "WE CAN'T TELL", which a first cut deleted here — the
    // narrower unknown is still an unknown.
    expect(body).toMatch(/can't tell/i);
  });

  it("★no branch claims a cadence the plugin cannot keep", () => {
    // WP-Cron is traffic-driven: "checks in hourly" is not sourceable on a site
    // nobody is visiting, which is exactly the site that has never fired.
    const all = [
      stateCopy(wp({ state: "never_fired" }), true).body,
      stateCopy(wp({ state: "never_fired" }), false).body,
      evidenceChain(wp({ state: "never_fired" }), true)[1].detail,
      evidenceChain(wp({ state: "never_fired" }), false)[1].detail,
    ];
    for (const body of all) {
      expect(body).not.toMatch(/checks in hourly|every hour\b|within the hour\b/i);
    }
  });
});
