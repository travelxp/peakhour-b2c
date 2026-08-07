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

  it("★leads with campaigns it could not stop, not with the count", () => {
    const s = summarize({ ticked: 40, refreshed: 40, flightEndBlocked: 2, unmonitorable: 1 });
    expect(s).toMatchObject({ level: "warning" });
    expect((s as { message: string }).message).toMatch(/could NOT be stopped/);
  });

  it("★surfaces campaigns it could not check at all, on its own", () => {
    // Asserted WITHOUT flightEndBlocked beside it: with both set the
    // higher-priority branch answers, and deleting this one entirely would
    // still pass. That is how a counter stops being surfaced silently.
    const s = summarize({ ticked: 40, refreshed: 40, unmonitorable: 3 });
    expect(s).toMatchObject({ level: "warning" });
    expect((s as { message: string }).message).toMatch(/could not be checked at all/);
  });

  it("★warns on a tick that visited campaigns but refreshed none", () => {
    // `ticked` counts rows visited; a tick that returned early on a draft or a
    // dead connection evaluated no budget at all. "40 checked" beside 0
    // refreshed is the reassuring silence the cron exists to end.
    const s = summarize({ ticked: 40, refreshed: 0 });
    expect(s).toMatchObject({ level: "warning" });
    expect((s as { message: string }).message).toMatch(/none had live figures/);
  });

  it("reports a healthy tick with the number that means something", () => {
    expect(summarize({ ticked: 12, refreshed: 9, autoPaused: 1, ended: 2 })).toBe(
      "9 campaigns checked, 1 paused at its budget cap, 2 finished.",
    );
  });

  it("says a capped tick is not finished", () => {
    expect(summarize({ ticked: 40, refreshed: 40, truncated: true })).toMatchObject({
      level: "warning",
    });
  });

  it("singularises, and defers to the generic toast on a shape it does not recognise", () => {
    expect(summarize({ ticked: 1, refreshed: 1 })).toBe("1 campaign checked.");
    expect(summarize({})).toBeNull();
    expect(summarize(null)).toBeNull();
    expect(summarize("nonsense")).toBeNull();
  });
});
