import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import en from "../../messages/en.json";
import { countStrings, skeleton } from "./new-locale";

describe("the new-locale skeleton", () => {
  it("has en.json's exact shape with every value empty", () => {
    const sk = skeleton(en);
    expect(Object.keys(sk)).toEqual(Object.keys(en));
    const walk = (a: unknown, b: unknown) => {
      if (typeof a === "string") return expect(b).toBe("");
      expect(Object.keys(b as object)).toEqual(Object.keys(a as object));
      for (const k of Object.keys(a as object)) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]);
    };
    walk(en, sk);
    expect(countStrings(sk)).toBeGreaterThan(40);
  });

  it("the CLI writes messages/<locale>.json, refuses an overwrite, an unknown locale and en", () => {
    const messages = resolve(__dirname, "../../messages");
    const target = join(messages, "pt-BR.json");
    const run = (arg: string) =>
      execFileSync(process.execPath, ["--import", "tsx", resolve(__dirname, "new-locale.ts"), arg], { encoding: "utf8", stdio: "pipe", cwd: resolve(__dirname, "../..") });
    expect(existsSync(target)).toBe(false);
    try {
      expect(run("pt-BR")).toContain("empty strings");
      expect(JSON.parse(readFileSync(target, "utf8"))).toEqual(skeleton(en));
      expect(() => run("pt-BR")).toThrow(/never overwrites/);
    } finally {
      rmSync(target, { force: true });
    }
    expect(() => run("xx")).toThrow(/not in LOCALES/);
    expect(() => run("en")).toThrow(/source of truth/);
  });
});
