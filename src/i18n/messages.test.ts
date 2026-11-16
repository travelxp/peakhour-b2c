import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LOCALES, PUBLISHED_LOCALES } from "@/lib/seo/types";

const DIR = resolve(__dirname, "../../messages");
const read = (file: string): unknown => JSON.parse(readFileSync(join(DIR, file), "utf8"));

/** Every leaf key as "A.b.c". */
function keys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}
function leaves(obj: unknown, prefix = ""): [string, unknown][] {
  if (obj === null || typeof obj !== "object") return [[prefix, obj]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const enKeys = keys(read("en.json")).sort();

describe("messages/", () => {
  it("has en.json, and every file is named for a declared locale", () => {
    expect(files).toContain("en.json");
    for (const f of files) expect(LOCALES as readonly string[]).toContain(f.replace(/\.json$/, ""));
  });

  it("en.json has no empty string (the skeleton generator uses empty strings for a locale not yet translated)", () => {
    for (const [k, v] of leaves(read("en.json"))) expect(typeof v === "string" && v.length > 0, k).toBe(true);
  });

  // Key parity (Bible 10): a locale file with a missing or extra key ships a page with a hole or a dead string.
  for (const f of files.filter((x) => x !== "en.json")) {
    it(`${f} has exactly en.json's keys`, () => {
      expect(keys(read(f)).sort()).toEqual(enKeys);
    });
  }

  it("every published locale has its message file, complete (no empty value)", () => {
    for (const l of PUBLISHED_LOCALES) {
      expect(existsSync(join(DIR, `${l}.json`)), `${l}.json`).toBe(true);
      for (const [k, v] of leaves(read(`${l}.json`))) expect(typeof v === "string" && v.length > 0, `${l}: ${k}`).toBe(true);
    }
  });

  it("commits no non-English message file until a language is approved (owner, 2026-11-15)", () => {
    expect(files.filter((f) => f !== "en.json")).toEqual([]);
  });
});
