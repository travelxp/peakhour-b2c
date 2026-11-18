import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCAL_BRAND_LOGOS, resolveBrandLogo } from "./brand-logos";

describe("local brand logos", () => {
  it("every local logo points at a file that is checked in", () => {
    for (const [key, url] of Object.entries(LOCAL_BRAND_LOGOS)) {
      expect(existsSync(join(process.cwd(), "public", url)), key).toBe(true);
    }
  });

  it("Threads has its own mark, so its tiles never fall back to a letter", () => {
    expect(resolveBrandLogo("threads")).toBe("/brands/threads.svg");
    const svg = readFileSync(join(process.cwd(), "public/brands/threads.svg"), "utf8");
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 24 24"/);
    expect(svg).toMatch(/<path fill="#000000" d="M18\.263 11\.097/);
  });

  it("a catalog icon still wins over the local mark", () => {
    expect(resolveBrandLogo("threads", "https://cdn.example/t.png")).toBe("https://cdn.example/t.png");
  });
});
