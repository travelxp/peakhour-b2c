import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CRON_METADATA, getCronMetadata, summarizeCronBody } from "./cron-metadata";

/**
 * Cron metadata vs the crons the api will actually let us fire.
 *
 * WHY: this file's own header says its keys "MUST match peakhour-api's
 * DEV_TRIGGERABLE_CRONS", and that was enforced by nothing. It had drifted to
 * 35 entries against 56 scheduled crons — so /cms/crons rendered a row of
 * buttons labelled "Run einvoice-register" with "(undocumented schedule)",
 * on a tenant that has real stores on it.
 *
 * The api is the source of truth and lives in a sibling repo, so this reads
 * `peakhour-api/vercel.json` directly. That coupling is deliberate and cheap:
 * the alternative is a third hand-maintained list, which is what caused the
 * problem. If the sibling checkout isn't present the test SKIPS rather than
 * fails — a b2c-only clone should still have a green suite.
 */

const VERCEL_JSON = fileURLToPath(
  new URL("../../../../peakhour-api/vercel.json", import.meta.url),
);

/**
 * Read the sibling api's schedule, or null when that checkout simply isn't
 * there (a b2c-only clone should still have a green suite).
 *
 * ONLY the read is allowed to produce a skip. A first draft threw its sanity
 * checks inside the same try, so the local catch swallowed them and an emptied
 * or renamed `crons` key silently disabled both coverage assertions — the exact
 * invisible no-op this file exists to prevent, reproduced one level up. The
 * checks now live outside, where they fail loudly.
 */
function readVercelJson(): string[] | null {
  try {
    const config = JSON.parse(readFileSync(VERCEL_JSON, "utf8")) as {
      crons?: Array<{ path: string }>;
    };
    return (config.crons ?? []).map((c) => c.path.replace(/^\/v1\/cron\//, ""));
  } catch (err) {
    // A silent skip is indistinguishable from a pass, so say it out loud.
    console.warn(
      `[cron-metadata.test] Skipping api coverage — could not read ${VERCEL_JSON}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }
}

const scheduled = readVercelJson();

describe("cron metadata coverage", () => {
  // Outside the reader's try/catch on purpose — these FAIL, they do not skip.
  // "vercel.json exists but lists nothing" means the key was renamed or
  // emptied, which would otherwise turn both assertions below into no-ops that
  // report green.
  it.runIf(scheduled)("read a usable schedule from the api", () => {
    expect(scheduled!.length, "vercel.json parsed but listed no crons").toBeGreaterThan(20);
    const malformed = scheduled!.filter((n) => n.includes("/"));
    expect(malformed, `cron paths did not match /v1/cron/: ${malformed.join(", ")}`).toEqual([]);
  });

  it.runIf(scheduled)("documents every cron the api schedules", () => {
    const undocumented = scheduled!.filter((c) => !(c in CRON_METADATA));
    expect(undocumented, `No friendly label for: ${undocumented.join(", ")}`).toEqual([]);
  });

  it.runIf(scheduled)("documents nothing that no longer exists", () => {
    // A stale entry is a label for a button that can never appear — harmless,
    // but it is the same drift in the other direction and hides real removals.
    const orphans = Object.keys(CRON_METADATA).filter((c) => !scheduled!.includes(c));
    expect(orphans, `Documented but not scheduled: ${orphans.join(", ")}`).toEqual([]);
  });

  it("gives every entry a label, frequency and description", () => {
    for (const [name, meta] of Object.entries(CRON_METADATA)) {
      expect(meta.label, name).toBeTruthy();
      expect(meta.frequency, name).toBeTruthy();
      expect(meta.description, name).toBeTruthy();
      // The description is the only thing standing between an operator and a
      // button whose effects they don't know. A bare restatement of the key
      // would satisfy `toBeTruthy` while telling them nothing.
      expect(meta.description.length, name).toBeGreaterThan(40);
    }
  });

  it("does not hardcode which crons are dangerous", () => {
    // The warning marker is rendered from the api's `requiresConfirmation`, not
    // baked into a label here. Keeping a second list would recreate exactly the
    // drift this file exists to kill — the api adds a sixth dangerous cron and
    // b2c renders it unmarked, with nothing failing.
    for (const [name, meta] of Object.entries(CRON_METADATA)) {
      expect(meta.label, `${name} hardcodes a warning marker`).not.toContain("⚠️");
    }
  });

  it("falls back gracefully for a cron it has never heard of", () => {
    // Deploys are independent, so the api can list a cron this build predates.
    const meta = getCronMetadata("some-brand-new-cron");
    expect(meta.label).toContain("some-brand-new-cron");
    expect(meta.frequency).toContain("undocumented");
  });
});

describe("summarizeCronBody", () => {
  // The api has TWO cron response conventions, and reading only `.data` made
  // every summarizer for the flat ones dead code — five of them, including
  // ai-credits-rollup, where it turned "charged nothing" into a green success.
  it("reads a WRAPPED {ok,data} body", () => {
    const body = JSON.stringify({ ok: true, data: { purged: 3 } });
    expect(summarizeCronBody("media-hard-delete", body)?.message).toContain("3");
  });

  it("reads a FLAT body", () => {
    const body = JSON.stringify({ success: true, processed: 12, topUpDebited: 0, failed: 0 });
    const summary = summarizeCronBody("ai-credits-rollup", body);
    expect(summary?.message).toContain("12");
    expect(summary?.level).toBe("success");
  });

  it("warns rather than congratulating when the rollup charged nothing", () => {
    const body = JSON.stringify({ success: true, processed: 0, failed: 0, skipped: 0 });
    const summary = summarizeCronBody("ai-credits-rollup", body);
    expect(summary?.level).toBe("warning");
    expect(summary?.message).toMatch(/no new/i);
  });

  it("defers to the generic toast on a malformed or truncated body", () => {
    expect(summarizeCronBody("ai-credits-rollup", "{not json")).toBeNull();
    expect(summarizeCronBody("ai-credits-rollup", "")).toBeNull();
  });

  it("warns when a purge did nothing because storage isn't configured", () => {
    // The handler early-returns `{success, skipped, purged:0}`. Now that flat
    // bodies reach summarizers, "0 purged" would otherwise read as healthy.
    const body = JSON.stringify({ success: true, skipped: "storage_not_configured", purged: 0 });
    const summary = summarizeCronBody("media-hard-delete", body);
    expect(summary?.level).toBe("warning");
  });

  it("returns null for a cron with no summarizer", () => {
    // Picked by SEARCHING for one rather than naming a cron, so adding a
    // summarizer to any particular entry can't break an unrelated test.
    const withoutSummarizer = Object.keys(CRON_METADATA).find((k) => !CRON_METADATA[k].summarize);
    expect(withoutSummarizer, "every cron now has a summarizer — pick another case").toBeDefined();
    expect(summarizeCronBody(withoutSummarizer!, JSON.stringify({ ok: true }))).toBeNull();
  });
});

/**
 * ★THE AD MONITOR'S SUMMARY IS THE ONE THAT CAN SAY SOMETHING FALSE ABOUT
 * SOMEBODY'S MONEY.
 *
 * Its payload carries two counters whose whole purpose is that a broken tick
 * must not read like a healthy one — `flightEndBlocked` (campaigns past their
 * end date that could not be stopped, and LinkedIn carries no `runSchedule.end`
 * so nothing else will stop them) and `unmonitorable`. Both otherwise hide
 * inside a green "40 campaigns checked."
 */
describe("ad-campaign-monitor summary", () => {
  const summarize = CRON_METADATA["ad-campaign-monitor"].summarize!;
  const msg = (d: unknown) => {
    const r = summarize(d);
    return typeof r === "string" ? r : r?.message;
  };

  it("\u2605says EVERY problem, not just the worst one", () => {
    // A first cut returned on the first branch that matched, so thirty-five
    // errored rows went unmentioned beside one blocked flight end. Ordered
    // worst-first; all of them said.
    expect(summarize({ ticked: 5, refreshed: 5, failed: 35, flightEndBlocked: 1 })).toEqual({
      message:
        "1 passed the end date and could NOT be stopped \u2014 check Campaign Manager; 35 errored.",
      level: "warning",
    });
  });

  it("\u2605leads with campaigns it could not stop", () => {
    expect(summarize({ ticked: 40, refreshed: 40, flightEndBlocked: 2, unmonitorable: 1 })).toEqual({
      message:
        "2 passed the end date and could NOT be stopped \u2014 check Campaign Manager; 1 could not be checked at all.",
      level: "warning",
    });
  });

  it("\u2605surfaces a tick where every row THREW, which read as a green success", () => {
    // The handler increments neither `ticked` nor `unmonitorable` in its per-row
    // catch, so forty errored rows returned {ticked: 0, failed: 40} and the
    // first cut rendered "0 campaigns checked." as a success toast.
    expect(summarize({ ticked: 0, refreshed: 0, failed: 40 })).toEqual({
      message: "40 errored.",
      level: "warning",
    });
  });

  it("\u2605surfaces each remaining counter on its own, so none can be dropped unseen", () => {
    // Asserted one at a time: with two set, the higher-priority branch answers
    // and deleting the lower one entirely would still pass.
    expect(msg({ ticked: 40, refreshed: 40, unmonitorable: 3 })).toBe("3 could not be checked at all.");
    expect(msg({ ticked: 3, refreshed: 3, rowNotUpdated: 2 })).toBe(
      "2 stopped on the platform but not updated here.",
    );
    expect(msg({ ticked: 5, refreshed: 5, unswept: 2 })).toBe("2 in a status nothing monitors.");
    expect(msg({ ticked: 5, refreshed: 5, notFound: 1 })).toBe("1 could not be read.");
    expect(msg({ ticked: 5, refreshed: 5, skippedUnreadable: 2 })).toBe("2 could not be read.");
    expect(msg({ ticked: 5, refreshed: 5, notFound: 1, skippedUnreadable: 2 })).toBe(
      "3 could not be read.",
    );
  });

  it("\u2605keeps `More remain` on a capped tick that ALSO had problems", () => {
    // `truncated` used to be reachable only when no warning fired, so a capped
    // tick with blocked flight ends lost "run again" entirely — and the tail of
    // that queue is exactly what was not enforced.
    expect(msg({ ticked: 40, refreshed: 40, flightEndBlocked: 1, truncated: true })).toContain(
      "More remain \u2014 run again.",
    );
  });

  it("\u2605does NOT warn just because nothing refreshed — that is the normal first state", () => {
    // `/boost` creates campaigns as drafts, a draft has nothing to refresh, and
    // the sweep visits it anyway. Warning there trains the user to ignore the
    // warning.
    expect(summarize({ ticked: 40, refreshed: 0 })).toBe("0 campaigns checked.");
  });

  it("\u2605never says `0 campaigns checked, 12 finished` — a sentence that contradicts itself", () => {
    // Reachable: a row the platform has never heard of ends WITHOUT ever
    // refreshing (the monitor returns `ended` with no `refreshed`).
    expect(summarize({ ticked: 12, refreshed: 0, ended: 12 })).toBe("12 finished.");
    expect(summarize({ ticked: 12, refreshed: 0, autoPaused: 2, ended: 10 })).toBe(
      "2 paused at their budget caps, 10 finished.",
    );
  });

  it("reports a healthy tick with the number that means something", () => {
    expect(summarize({ ticked: 12, refreshed: 9, autoPaused: 1, ended: 2 })).toBe(
      "9 campaigns checked, 1 paused at its budget cap, 2 finished.",
    );
  });

  it("says a capped tick is not finished", () => {
    expect(summarize({ ticked: 40, refreshed: 40, truncated: true })).toEqual({
      message: "40 campaigns checked. More remain \u2014 run again.",
      level: "warning",
    });
  });

  it("\u2605counts an all-X batch as work, not as an empty one", () => {
    // `skippedOtherWriter` is one of the six mutually-exclusive per-row
    // outcomes. Omitting it from the batch total made a tick of forty X
    // campaigns report "No campaigns needed checking." — and swallowed
    // `truncated` with it, because the empty answer returns first.
    expect(summarize({ ticked: 0, refreshed: 0, skippedOtherWriter: 40, truncated: true })).toEqual({
      message: "0 campaigns checked. More remain \u2014 run again.",
      level: "warning",
    });
  });

  it("distinguishes an empty batch from a batch that did nothing", () => {
    expect(summarize({ ticked: 0, refreshed: 0 })).toBe("No campaigns needed checking.");
  });

  it("singularises everywhere, including the plural that read `3 paused at its budget cap`", () => {
    expect(summarize({ ticked: 1, refreshed: 1 })).toBe("1 campaign checked.");
    expect(summarize({ ticked: 3, refreshed: 3, autoPaused: 3 })).toBe(
      "3 campaigns checked, 3 paused at their budget caps.",
    );
    expect(summarize({ ticked: 1, refreshed: 1, autoPaused: 1 })).toBe(
      "1 campaign checked, 1 paused at its budget cap.",
    );
  });

  it("defers to the generic toast on a shape it does not recognise", () => {
    expect(summarize({})).toBeNull();
    expect(summarize(null)).toBeNull();
    expect(summarize("nonsense")).toBeNull();
  });
});

describe("linkedin-subscription-reconcile summary", () => {
  const summarize = (data: unknown) =>
    CRON_METADATA["linkedin-subscription-reconcile"].summarize?.(data) ?? null;

  const msg = (data: unknown) => {
    const r = summarize(data);
    return typeof r === "string" ? r : r?.message;
  };
  const level = (data: unknown) => {
    const r = summarize(data);
    return typeof r === "string" ? "success" : r?.level;
  };

  // ★The reported bug. A customer with LinkedIn connected and a Page enabled
  // clicked this and was told to go connect LinkedIn. Creating a subscription
  // stamps `lastReconciledAt`, so it sits outside the sweep's staleness window
  // and `checked` is 0 on the very next run — the healthiest state produced
  // the scariest message.
  it("does NOT say 'connect LinkedIn' when connections exist and are current", () => {
    const healthy = {
      checked: 0,
      resubscribed: 0,
      seed: { scanned: 2, missing: 0, processed: 0, subscribed: 0, failed: 0 },
    };
    expect(msg(healthy)).toBe("LinkedIn alerts checked — nothing was due for renewal.");
    expect(level(healthy)).toBe("success");
  });

  // ★And it must not claim health it cannot see. `markStatus` stamps
  // `lastReconciledAt`, so a row that just went revoked/forbidden is skipped
  // for 20h and comes back as `checked: 0` — with the seeder counting it as
  // known, not missing. Clicking twice used to turn "1 lost admin rights"
  // into "everything is current".
  it("does not assert that every Page is healthy from an idle tick", () => {
    const idle = {
      checked: 0,
      resubscribed: 0,
      seed: { scanned: 2, missing: 0, processed: 0, subscribed: 0, failed: 0 },
    };
    expect(msg(idle)).not.toContain("current.");
    expect(msg(idle)).not.toContain("subscribed and");
  });

  it("still warns — with accurate copy — when nothing is connected at all", () => {
    const empty = {
      checked: 0,
      resubscribed: 0,
      seed: { scanned: 0, missing: 0, processed: 0, subscribed: 0, failed: 0 },
    };
    expect(msg(empty)).toContain("No LinkedIn account connected yet");
    expect(level(empty)).toBe("warning");
  });

  it("warns when the run tried to arm connections and armed none, and singularises", () => {
    const one = {
      checked: 0,
      resubscribed: 0,
      seed: { scanned: 3, missing: 1, processed: 1, subscribed: 0, failed: 1 },
    };
    expect(msg(one)).toContain("Tried 1 LinkedIn connection and subscribed none");
    expect(level(one)).toBe("warning");

    const two = {
      checked: 0,
      resubscribed: 0,
      seed: { scanned: 3, missing: 2, processed: 2, subscribed: 0, failed: 2 },
    };
    expect(msg(two)).toContain("Tried 2 LinkedIn connections and subscribed none");
  });

  // ★An unconfigured subscription env makes the sweep return all zeros and
  // the seeder skip every connection without failing one, which is otherwise
  // indistinguishable from a quiet, healthy tick.
  it("warns when nothing could be attempted rather than reading as quiet", () => {
    const unconfigured = {
      checked: 0,
      resubscribed: 0,
      seed: { scanned: 2, missing: 2, processed: 2, subscribed: 0, failed: 0 },
    };
    expect(level(unconfigured)).toBe("warning");
  });

  // ★`seed.missing` is documented as permanently non-zero for a connection
  // with every Page disabled, and the counters are app-wide — so warning on
  // it would show an orange toast to a healthy customer over somebody else's
  // disabled Page. Exactly the bug this entry is fixing, one field along.
  it("does not warn on `missing` alone when nothing was attempted", () => {
    const capped = {
      checked: 0,
      resubscribed: 0,
      // 12 missing, but the seeder's per-run cap meant none was processed.
      seed: { scanned: 12, missing: 12, processed: 0, subscribed: 0, failed: 0 },
    };
    expect(level(capped)).toBe("success");
    expect(msg(capped)).toBe("LinkedIn alerts checked — nothing was due for renewal.");
  });

  // ★1 armed out of 5 attempted read as a clean "1 Page newly subscribed".
  it("surfaces the seeder's failures alongside what it managed to arm", () => {
    expect(
      msg({
        checked: 0,
        resubscribed: 0,
        seed: { scanned: 5, missing: 5, processed: 5, subscribed: 1, failed: 4 },
      }),
    ).toBe("LinkedIn alerts: 1 Page newly subscribed, 4 could not be subscribed.");
  });

  it("reports real work when the run actually did some", () => {
    const good = {
      checked: 4,
      resubscribed: 1,
      revoked: 0,
      forbidden: 0,
      interactionsWritten: 7,
      seed: { scanned: 2, missing: 1, processed: 1, subscribed: 1, failed: 0 },
    };
    expect(msg(good)).toBe(
      "LinkedIn alerts: 1 Page newly subscribed, 1 renewed, 7 missed events replayed.",
    );
    expect(level(good)).toBe("success");
  });

  // ★A tick that examined 5 subscriptions and failed on all 5 came out as
  // "everything already up to date", in green.
  it("surfaces the sweep's own failures instead of calling the tick up to date", () => {
    const allFailed = { checked: 5, resubscribed: 0, failed: 5 };
    expect(msg(allFailed)).toContain("5 failed to renew");
    expect(level(allFailed)).toBe("warning");
  });

  it("never lists a broken Page inside a green toast", () => {
    const revoked = { checked: 3, resubscribed: 1, revoked: 2 };
    expect(msg(revoked)).toContain("2 need a reconnect");
    expect(level(revoked)).toBe("warning");

    const forbidden = { checked: 3, resubscribed: 0, forbidden: 1 };
    expect(level(forbidden)).toBe("warning");

    const backfillFailed = { checked: 3, resubscribed: 0, backfillFailed: 1 };
    expect(msg(backfillFailed)).toContain("could not be back-filled");
    expect(level(backfillFailed)).toBe("warning");
  });

  // A capped backfill resumes next run — worth stating, not worth alarming.
  it("mentions an unfinished backfill without turning the tick orange", () => {
    const capped = { checked: 3, resubscribed: 1, backfillIncomplete: 2 };
    expect(msg(capped)).toContain("2 still to back-fill");
    expect(level(capped)).toBe("success");
  });

  it("defers to the generic toast on a shape it does not recognise", () => {
    expect(summarize(null)).toBe("LinkedIn alerts reconnected.");
  });
});

describe("performance-sync summary", () => {
  const summarize = (data: unknown) =>
    CRON_METADATA["performance-sync"].summarize?.(data) ?? null;

  // ★The description used to say "every connected publishing platform", so
  // this was the obvious button for LinkedIn engagement. The api's provider
  // list is the three Google sources and nothing else — a run that touches
  // no LinkedIn connection must not imply that it did.
  it("names the three sources it actually covers, and disclaims LinkedIn", () => {
    const { description } = CRON_METADATA["performance-sync"];
    expect(description).toContain("Search Console");
    expect(description).toContain("Google Analytics");
    expect(description).toContain("Sync LinkedIn posts");
    expect(description).not.toContain("every connected publishing platform");
    // ★Business Profile is in the api's provider list but `coming_soon`
    // with no connection form, so it is named as pending — never as
    // something the reader could go and connect.
    expect(description).toContain("Google Business Profile joins them once it opens");
  });

  it("says WHICH connection is missing when there are none, and none that cannot be made", () => {
    const r = summarize({ overall: { connectionsTotal: 0, connectionsRun: 0, errors: 0 } });
    const message = typeof r === "string" ? r : r?.message;
    expect(message).toContain("Search Console");
    expect(message).not.toContain("no connected platforms yet");
    expect(message).not.toContain("Business Profile");
  });
});

/**
 * ★The LinkedIn sync toast, which used to congratulate the user on a run
 * that had done nothing.
 *
 * LinkedIn's Community Management quota is app-wide (~500 requests/day
 * across every customer). When it runs out the posts LISTING has usually
 * already succeeded — so the payload carries a healthy `postsUpserted`
 * while engagement, comments, commenter names and every Community Feed row
 * were skipped entirely. Observed on dev 2026-08-21: "51 posts synced
 * successfully", and not one dashboard number moved.
 */
describe("linkedin-post-sync summary", () => {
  const body = (over: Record<string, unknown> = {}, result: Record<string, unknown> = {}) =>
    JSON.stringify({
      ok: true,
      data: {
        scanned: 1,
        synced: 1,
        skipped: 0,
        failed: 0,
        ...over,
        results: [
          {
            businessId: "b1",
            status: "synced",
            postsFetched: 51,
            postsUpserted: 51,
            commentsFetched: 0,
            actorProfilesCached: 0,
            interactionsUpserted: 0,
            postsTombstoned: 0,
            ...result,
          },
        ],
      },
    });

  it("★warns, and does not claim success, when LinkedIn rate-limited us", () => {
    const s = summarizeCronBody("linkedin-post-sync", body({ rateLimited: true }));
    expect(s?.level).toBe("warning");
    expect(s?.message).toMatch(/rate-limit/i);
    // The number that made this look fine must not be the headline.
    expect(s?.message).not.toMatch(/51 posts synced/);
    // And it must steer away from the reflex that makes it worse — while
    // naming the reason (a shared quota) rather than asserting a reset
    // window we have not actually measured.
    expect(s?.message).toMatch(/again/i);
    expect(s?.message).toMatch(/shared across the whole app/i);
  });

  it("★reports what the LinkedIn tabs actually render, not just posts", () => {
    // Posts sync fine even when the whole comment pipeline is dead, so
    // "51 posts synced" was compatible with Top Engagers, the Feed and
    // Community Pulse all staying empty.
    const s = summarizeCronBody(
      "linkedin-post-sync",
      body({}, {
        commentsFetched: 3,
        actorProfilesCached: 4,
        interactionsUpserted: 5,
        postsTombstoned: 1,
      }),
    );
    expect(s?.message).toMatch(/3 comment threads read/);
    expect(s?.message).toMatch(/4 names cached/);
    expect(s?.message).toMatch(/5 Feed items/);
    expect(s?.message).toMatch(/1 deleted post marked/);
  });

  it("idle is not empty — a quiet Page reports no extras rather than a problem", () => {
    const s = summarizeCronBody("linkedin-post-sync", body());
    expect(s?.level ?? "success").toBe("success");
    expect(s?.message).toMatch(/51 posts synced/);
    // No parenthetical claiming zero of everything.
    expect(s?.message).not.toMatch(/0 /);
  });

  it("still surfaces an account that needs reconnecting", () => {
    const s = summarizeCronBody("linkedin-post-sync", body({ failed: 1 }));
    expect(s?.message).toMatch(/reconnect/i);
  });
});
