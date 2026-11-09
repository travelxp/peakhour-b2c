import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The share link's token is in the URL of /share/<token>. Two things keep it from third parties: the response header (checked here
 * against next.config.ts) and the absence of any analytics or third-party script in the layout that page renders in.
 */
const { nextConfig } = await import("../next.config");

describe("/share/<token>", () => {
  it("is served with Referrer-Policy: no-referrer", async () => {
    const rules = await nextConfig.headers!();
    const rule = rules.find((r) => r.source.startsWith("/share/"));
    expect(rule).toBeTruthy();
    expect(rule!.headers).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
    // and a source that matches a real token path
    const re = new RegExp("^" + rule!.source.replace(":path*", ".*") + "$");
    expect(re.test("/share/" + "t".repeat(43))).toBe(true);
    expect(re.test("/dashboard/drive")).toBe(false);
  });

  it("renders in a layout with no analytics or third-party script", () => {
    const raw = readFileSync(join(__dirname, "app", "(site)", "layout.tsx"), "utf8");
    const layout = raw.split(String.fromCharCode(10)).filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join(" ");
    expect(layout).not.toMatch(/next\/script|<Script|<script|vercel\/analytics|speed-insights|googletagmanager|gtag\(|fbq\(|posthog|clarity/i);
  });
});
