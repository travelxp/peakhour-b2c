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

function readScheduledCrons(): string[] | null {
  const path = fileURLToPath(new URL("../../../../peakhour-api/vercel.json", import.meta.url));
  try {
    const config = JSON.parse(readFileSync(path, "utf8")) as {
      crons?: Array<{ path: string }>;
    };
    const names = (config.crons ?? []).map((c) => c.path.replace(/^\/v1\/cron\//, ""));
    if (names.length === 0) {
      // Distinct from "sibling absent": the file parsed and had no crons, which
      // means the key was renamed or emptied — a real problem, not a skip.
      throw new Error("vercel.json parsed but listed no crons");
    }
    // A path that stopped matching the prefix would survive whole and turn into
    // a baffling orphan; catch it here where the cause is obvious.
    const malformed = names.filter((n) => n.includes("/"));
    if (malformed.length > 0) {
      throw new Error(`cron paths did not match /v1/cron/: ${malformed.join(", ")}`);
    }
    return names;
  } catch (err) {
    // Skipping is right for a b2c-only clone, but a SILENT skip turns the two
    // assertions that matter into invisible no-ops — which is the failure this
    // whole file exists to prevent, one level up.
    console.warn(
      `[cron-metadata.test] Skipping api coverage — could not read ${path}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }
}

const scheduled = readScheduledCrons();

describe("cron metadata coverage", () => {
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

  it("returns null for a cron with no summarizer", () => {
    expect(summarizeCronBody("billing-dunning", JSON.stringify({ ok: true }))).toBeNull();
  });
});
