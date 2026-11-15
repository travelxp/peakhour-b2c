import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPABILITIES } from "./capabilities";
import { statusSatisfies } from "./publish";
import snapshot from "./catalog-snapshot.json";

const REPOS = ["peakhour-api", "peakhour-shopify", "peakhour-b2c", "peakhour-wordpress"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const snap = snapshot.entries as Record<string, { status: string; source: string }>;

describe("SEO-3: capability evidence", () => {
  it("has unique ids and at least one implementation each, one per surface", () => {
    expect(new Set(CAPABILITIES.map((c) => c.id)).size).toBe(CAPABILITIES.length);
    for (const c of CAPABILITIES) {
      expect(c.implementations.length, c.id).toBeGreaterThan(0);
      const surfaces = c.implementations.map((i) => i.surface);
      expect(new Set(surfaces).size, `${c.id} has two implementations on one surface`).toBe(surfaces.length);
    }
  });

  it("every implementation has repo-qualified evidence and a verifiedAt date", () => {
    for (const c of CAPABILITIES) {
      for (const i of c.implementations) {
        expect(i.evidence.length, `${c.id} [${i.surface}]`).toBeGreaterThan(0);
        for (const e of i.evidence) {
          const [repo, path] = e.split(":");
          expect(REPOS, `${c.id}: ${e}`).toContain(repo);
          expect(path?.length, `${c.id}: ${e}`).toBeGreaterThan(0);
        }
        expect(i.verifiedAt, c.id).toMatch(ISO_DATE);
      }
    }
  });

  it("every claim's requires is satisfiable by at least one implementation, and is approved by the owner", () => {
    for (const c of CAPABILITIES) {
      for (const claim of c.approvedClaims) {
        expect(claim.id.startsWith(`${c.id}.`), claim.id).toBe(true);
        expect(claim.text.trim().length, claim.id).toBeGreaterThan(0);
        expect(claim.approvedBy, claim.id).toBe("owner");
        expect(claim.approvedAt, claim.id).toMatch(ISO_DATE);
        expect(
          c.implementations.some((i) => statusSatisfies(i.status, claim.requires)),
          `${claim.id} requires ${claim.requires} but no implementation reaches it`,
        ).toBe(true);
      }
    }
  });

  it("every catalog key is in the snapshot, and no live or beta implementation sits on a key that is not active, live or beta", () => {
    for (const c of CAPABILITIES) {
      for (const i of c.implementations) {
        for (const key of i.catalogKeys ?? []) {
          const row = snap[key];
          expect(row, `${c.id} [${i.surface}] names "${key}", which is not in the snapshot`).toBeDefined();
          if (i.status !== "live" && i.status !== "beta") continue;
          expect(["live", "active", "beta"], `${c.id} [${i.surface}] is ${i.status} but "${key}" is ${row.status}`).toContain(row.status);
        }
      }
    }
  });

  // Evidence paths are checked against the sibling checkouts when they are present (b2c CI has only this repo).
  const SIBLINGS = resolve(process.cwd(), "..");
  const haveSiblings = REPOS.filter((r) => r !== "peakhour-b2c").every((r) => existsSync(resolve(SIBLINGS, r)));
  it.skipIf(!haveSiblings)("every evidence path exists in its repo's checkout", () => {
    for (const c of CAPABILITIES) {
      for (const i of c.implementations) {
        for (const e of i.evidence) {
          const [repo, path] = e.split(":");
          // This worktree stands in for peakhour-b2c, so a b2c path is read from the cwd.
          const root = repo === "peakhour-b2c" ? process.cwd() : resolve(SIBLINGS, repo);
          expect(existsSync(resolve(root, path)), `${c.id}: ${e}`).toBe(true);
        }
      }
    }
  });

  it("the snapshot is dated and carries the production integrations", () => {
    expect(snapshot.readAt).toMatch(ISO_DATE);
    expect(snap.google_ads).toEqual({ status: "coming_soon", source: "prod-public-api" });
    expect(snap.whatsapp.status).toBe("live");
  });

  it("settled drifts: support and Google Ads are built but not live", () => {
    const get = (id: string) => CAPABILITIES.find((c) => c.id === id)!;
    for (const id of ["support.channel_inbox", "support.ai_replies", "support.whatsapp_support", "growth.google_ads"]) {
      expect(get(id).implementations.every((i) => i.status === "development"), id).toBe(true);
      expect(get(id).approvedClaims, id).toHaveLength(0);
    }
  });
});
