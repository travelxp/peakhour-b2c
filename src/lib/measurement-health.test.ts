import { describe, it, expect } from "vitest";
import {
  affectsMeasurementHealth,
  fixFor,
  hasSomethingToSay,
  orderedChecks,
  passedLine,
  periodLine,
  reconnectHref,
} from "./measurement-health";
import type { HealthCheck, MeasurementHealthResponse } from "@/lib/api/growth";

/**
 * ★★THE API DECIDED EVERY VERDICT; THIS FILE ONLY ADDS THE FIX. So most of what
 * follows is about the two ways a client can ruin a correct server answer:
 * offering a repair for something that is not broken, and quietly dropping a
 * finding it does not recognise.
 *
 * ★THE SECOND IS THE EXPENSIVE ONE. A `attention` this build has never heard of
 * is still a real fault in a merchant's measurement, and a client that hides it
 * because its `id` is not in a table produces a screen that says everything is
 * fine. Nobody goes looking for a check that was silently dropped.
 */

const check = (over: Partial<HealthCheck> = {}): HealthCheck => ({
  id: "key_event",
  state: "attention",
  headline: "Nothing is being counted as a result",
  detail: "Analytics has no key event.",
  ...over,
});

const health = (over: Partial<MeasurementHealthResponse> = {}): MeasurementHealthResponse => ({
  period: { days: 28, since: "2026-08-12T00:00:00.000Z", until: "2026-09-09T00:00:00.000Z" },
  summary: { checked: 5, attention: 1, unmeasurable: 0, headline: "1 thing needs your attention" },
  checks: [check()],
  ...over,
});

// ── The fix ─────────────────────────────────────────────────────────────────

describe("fixFor", () => {
  it("offers a repair for something that is broken", () => {
    const fix = fixFor(check({ id: "self_referral" }));
    expect(fix).not.toBeNull();
    expect(fix?.steps.length).toBeGreaterThan(0);
    expect(fix?.link.href).toMatch(/^https:\/\//);
  });

  it("★★★offers nothing for a check that PASSED", () => {
    // Steps under a green row are noise, and noise beside a verdict is how a
    // merchant learns to stop reading the verdicts.
    expect(fixFor(check({ state: "ok" }))).toBeNull();
  });

  it("★★★offers nothing for a check we could not RUN", () => {
    // "We couldn't read your analytics" has no repair in Google's admin — the
    // thing to fix is a connection rather than a setting, which is what
    // `reconnectHref` below is for.
    expect(fixFor(check({ state: "unmeasurable" }))).toBeNull();
  });

  it("★★★shows a finding it has never heard of, with no fix beside it", () => {
    // The api's check set grows independently of this deploy. Returning a fix
    // for the wrong check would be worse than none, and HIDING the finding —
    // which a lookup that threw or a filter would do — is worst of all: the
    // screen then says everything is fine.
    const unknown = check({ id: "internal_traffic_filter", headline: "Something new" });
    expect(fixFor(unknown)).toBeNull();
    expect(orderedChecks([unknown])).toHaveLength(1);
  });

  it("★★★survives a check id that names something on Object.prototype", () => {
    // An object literal keyed by a string off the wire answers `constructor`
    // and `toString` from its prototype, so `FIXES[id] ?? null` never reaches
    // its miss branch and hands back a FUNCTION as a fix — after which
    // `fix.steps.map` throws and takes the whole panel down. That defeats the
    // "never crashed on an unknown check" contract by the shape of the
    // container rather than by the logic, which is why these are Maps.
    for (const id of ["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"]) {
      expect(fixFor(check({ id })), id).toBeNull();
    }
  });

  it("★every fix names where it happens and links somewhere real", () => {
    for (const id of [
      "unassigned_traffic",
      "self_referral",
      "hostname_agreement",
      "key_event",
      "listing_completeness",
    ]) {
      const fix = fixFor(check({ id }));
      expect(fix, id).not.toBeNull();
      expect(fix?.where, id).toBeTruthy();
      expect(fix?.steps.length, id).toBeGreaterThanOrEqual(2);
      expect(fix?.link.href, id).toMatch(/^https:\/\/[a-z0-9.-]+\//);
    }
  });
});

// ── The order they are read in ──────────────────────────────────────────────

describe("orderedChecks", () => {
  it("★★★puts what we could not check ABOVE what passed", () => {
    // The three-state contract made visible. A check we could not run is closer
    // to a problem than to a pass, and sorting it under the green rows buries
    // the one state nobody goes looking for.
    const out = orderedChecks([
      check({ id: "a", state: "ok" }),
      check({ id: "b", state: "unmeasurable" }),
      check({ id: "c", state: "attention" }),
    ]);
    expect(out.map((c) => c.state)).toEqual(["attention", "unmeasurable", "ok"]);
  });

  it("★★★does not reorder the response object it was handed", () => {
    // The array is react-query's cached response. Sorting it in place reorders
    // the cache under every other reader of the same query.
    const input = [check({ id: "a", state: "ok" }), check({ id: "b", state: "attention" })];
    orderedChecks(input);
    expect(input.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("★★★ranks a state named after Object.prototype as uncertain, not as a pass", () => {
    const out = orderedChecks([
      check({ id: "a", state: "ok" }),
      check({ id: "b", state: "constructor" }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("★★sorts a state it has never heard of as uncertain, not as a pass", () => {
    // The honest default for a verdict we cannot interpret is the one that
    // keeps it visible.
    const out = orderedChecks([
      check({ id: "a", state: "ok" }),
      check({ id: "b", state: "something_new" }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

// ── Whether to speak at all ─────────────────────────────────────────────────

describe("hasSomethingToSay", () => {
  it("★★★stays quiet for a business with nothing connected", () => {
    // Every check comes back `unmeasurable`, and "we couldn't check your
    // measurement setup" directly above cards that already say "not connected"
    // is an alarm about the state the page exists to fix.
    expect(
      hasSomethingToSay(
        health({
          summary: {
            checked: 0,
            attention: 0,
            unmeasurable: 5,
            headline: "We couldn't check your measurement setup",
          },
        }),
      ),
    ).toBe(false);
  });

  it("speaks as soon as one check could be run", () => {
    expect(
      hasSomethingToSay(
        health({
          summary: { checked: 1, attention: 0, unmeasurable: 4, headline: "h" },
        }),
      ),
    ).toBe(true);
  });

  it("★★keys on what we CHECKED, not on how many rows came back", () => {
    // Every check is present in every response; what varies is how many of them
    // we could answer. A `checks.length` test would speak for every business
    // on the platform.
    const nothingReadable = health({
      summary: { checked: 0, attention: 0, unmeasurable: 5, headline: "h" },
      checks: [check({ state: "unmeasurable" }), check({ id: "b", state: "unmeasurable" })],
    });
    expect(nothingReadable.checks.length).toBeGreaterThan(0);
    expect(hasSomethingToSay(nothingReadable)).toBe(false);
  });
});

// ── The counts ──────────────────────────────────────────────────────────────

/**
 * ⚠️THESE FIXTURES NOW AGREE WITH THEMSELVES, AND THEY DID NOT BEFORE. Each
 * declared a summary ("5 checked, 1 needing attention") beside a `checks` array
 * holding a single attention row — so the two halves of the response described
 * different businesses. A fixture that self-contradicts cannot catch a function
 * reading the wrong half of it, which is precisely the bug below.
 */
const ok = (id: string) => check({ id, state: "ok", headline: "Fine", detail: "Fine." });
const unmeasurable = (id: string) =>
  check({ id, state: "unmeasurable", headline: "Couldn't check", detail: "No connection." });

describe("passedLine", () => {
  it("★★★counts out of what we could CHECK, not out of what exists", () => {
    // "4 of 5 passed" over a business whose Business Profile we could not read
    // claims we looked at five things.
    const line = passedLine(
      health({
        summary: { checked: 3, attention: 1, unmeasurable: 2, headline: "h" },
        checks: [ok("a"), ok("b"), check(), unmeasurable("d"), unmeasurable("e")],
      }),
    );
    expect(line).toContain("2 of 3 checks passed");
    expect(line).toContain("2 more couldn't be checked");
    expect(line).not.toContain("of 5");
  });

  it("says nothing about what it could not check when it checked everything", () => {
    const line = passedLine(
      health({
        summary: { checked: 5, attention: 1, unmeasurable: 0, headline: "h" },
        checks: [ok("a"), ok("b"), ok("c"), ok("d"), check()],
      }),
    );
    expect(line).toBe("4 of 5 checks passed.");
  });

  it("counts one check in the singular", () => {
    expect(
      passedLine(
        health({
          summary: { checked: 1, attention: 0, unmeasurable: 4, headline: "h" },
          checks: [ok("a"), unmeasurable("b"), unmeasurable("c"), unmeasurable("d"), unmeasurable("e")],
        }),
      ),
    ).toContain("1 of 1 check passed");
  });

  it("★★★never reports a state it has never heard of as a pass", () => {
    // ⚠️`checked - attention` COUNTS EVERYTHING THAT IS NOT A FAILURE AS A
    // PASS. `HealthState` is typed as the union we know PLUS a string because
    // "the api's sets grow independently of this deploy" — so the day a fourth
    // state ships, every check in it was being reported to the merchant as
    // having passed. `orderedChecks` already had an `UNKNOWN_RANK` for exactly
    // this; one file, two places, and only one of them was ready.
    const line = passedLine(
      health({
        summary: { checked: 5, attention: 1, unmeasurable: 0, headline: "h" },
        checks: [
          ok("a"),
          ok("b"),
          ok("c"),
          check(),
          check({ id: "e", state: "degraded", headline: "Half working", detail: "Partly." }),
        ],
      }),
    );
    expect(line).toBe("3 of 5 checks passed.");
    expect(line).not.toContain("4 of 5");
  });

  it("★★a pass is counted, not inferred from the absence of a failure", () => {
    // Every check we could run is in an unrecognised state: nothing is known
    // to have passed, and the honest numerator is zero rather than five.
    const line = passedLine(
      health({
        summary: { checked: 5, attention: 0, unmeasurable: 0, headline: "h" },
        checks: [1, 2, 3, 4, 5].map((n) => check({ id: `c${n}`, state: "degraded" })),
      }),
    );
    expect(line).toBe("0 of 5 checks passed.");
  });

  it("★offers no ratio when nothing could be checked", () => {
    // "0 of 0 passed" is a sentence about nothing.
    // ⚠️AND THIS FIXTURE AGREES WITH ITSELF TOO. It kept the default single
    // ATTENTION check beside a summary saying nothing could be checked —
    // harmless only because the guard returns first, which is exactly the kind
    // of "harmless today" that stops being true when the guard moves.
    expect(
      passedLine(
        health({
          summary: { checked: 0, attention: 0, unmeasurable: 5, headline: "h" },
          checks: [1, 2, 3, 4, 5].map((n) => unmeasurable(`c${n}`)),
        }),
      ),
    ).toBeNull();
  });
});

// ── When the panel has to be refetched ──────────────────────────────────────

describe("affectsMeasurementHealth", () => {
  it("★★★names every provider the check actually reads", () => {
    // The panel caches for half an hour. A merchant who disconnects Google
    // Analytics and is not refetched keeps reading green analytics verdicts
    // directly above the card that now says "not connected" — the panel
    // contradicting the page it is printed on.
    expect(affectsMeasurementHealth("google_analytics")).toBe(true);
    expect(affectsMeasurementHealth("google_search_console")).toBe(true);
    expect(affectsMeasurementHealth("google_business_profile")).toBe(true);
  });

  it("★★spends no round trip on a provider the check never reads", () => {
    // Three live Google calls sit behind a refetch; disconnecting Klaviyo has
    // no bearing on any of them.
    expect(affectsMeasurementHealth("klaviyo")).toBe(false);
    expect(affectsMeasurementHealth("shopify")).toBe(false);
    expect(affectsMeasurementHealth("linkedin_ads")).toBe(false);
  });

  it("★is not fooled by a provider named after Object.prototype", () => {
    expect(affectsMeasurementHealth("constructor")).toBe(false);
  });
});

describe("reconnectHref", () => {
  it("★★★gives a check we could not run somewhere to go", () => {
    // `fixFor` withholds a fix for `unmeasurable` because the repair is a
    // connection, not a setting in Google's admin. On a page with no connection
    // cards on it that left a finding, an instruction, and nowhere to carry it
    // out.
    expect(reconnectHref(check({ state: "unmeasurable" }), "/dashboard/integrations")).toBe(
      "/dashboard/integrations",
    );
  });

  it("★★★sends nobody away from the page the connections are already on", () => {
    // The integrations page passes no href: its own cards are the answer, and a
    // link back to the page you are standing on is a dead end of a different
    // kind.
    expect(reconnectHref(check({ state: "unmeasurable" }), null)).toBeNull();
  });

  it("★★offers the link ONLY for a check we could not run", () => {
    // "Check your connections" under a green row, or under a finding whose fix
    // is three steps in Google's admin, points away from what would help.
    expect(reconnectHref(check({ state: "ok" }), "/dashboard/integrations")).toBeNull();
    expect(reconnectHref(check({ state: "attention" }), "/dashboard/integrations")).toBeNull();
    expect(reconnectHref(check({ state: "something_new" }), "/dashboard/integrations")).toBeNull();
  });
});

describe("periodLine", () => {
  it("names the window the checks were judged over", () => {
    expect(periodLine(health())).toBe("Checked over the last 28 days.");
  });

  it("counts one day in the singular", () => {
    expect(
      periodLine(
        health({ period: { days: 1, since: "x", until: "y" } }),
      ),
    ).toBe("Checked over the last 1 day.");
  });
});
