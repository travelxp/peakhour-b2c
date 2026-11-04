import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newActionKey } from "@/lib/api";

/**
 * Owner, 2026-11-04: nothing is charged that the merchant did not ask for.
 *
 * The launch page used to start the LinkedIn suggested-drafts generation itself when discovery finished, which spent the
 * merchant's Peaks the moment onboarding ended. The drafts are now an explicit button in the panel.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the launch page spends nothing on its own", () => {
  it("does not call the generate-from-profile endpoint, directly or through the api client", () => {
    const page = strip(read("src/app/(site)/onboarding/launch/page.tsx"));
    expect(page).not.toMatch(/generateFromProfile/);
    expect(page).not.toMatch(/linkedInContentApi/);
    expect(page).not.toMatch(/generate-from-profile/);
  });

  it("the panel generates only when the merchant presses its button", () => {
    const panel = strip(read("src/app/(site)/dashboard/content/linkedin/_components/suggested-drafts-panel.tsx"));
    // one call site, inside a mutation that a click triggers
    expect(panel.match(/generateFromProfile\(/g)).toHaveLength(1);
    expect(panel).toMatch(/useMutation\(\{\s*mutationFn: \(\) => linkedInContentApi\.generateFromProfile\(\)/);
    expect(panel).toMatch(/onClick=\{\(\) => generate\.mutate\(\)\}/);
    // and it is never fired from an effect
    expect(panel).not.toMatch(/useEffect/);
  });

  it("a failure says what to do next", () => {
    const panel = read("src/app/(site)/dashboard/content/linkedin/_components/suggested-drafts-panel.tsx");
    expect(panel).toContain("We could not draft posts just now. Try again in a moment.");
  });
});

describe("a paid click carries a key of its own", () => {
  it("every click gets a fresh key, in the shape the api accepts (8 to 128 of letters, digits, dot, dash, colon, underscore)", () => {
    const a = newActionKey()["Idempotency-Key"]!;
    const b = newActionKey()["Idempotency-Key"]!;
    expect(a).not.toBe(b);
    for (const k of [a, b]) expect(k).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
  });

  it("the strategist, the draft and the page generator send it", () => {
    expect(read("src/hooks/use-web-pages.ts")).toMatch(/"\/v1\/content\/web-pages\/generate", body \?\? \{\}, newActionKey\(\)/);
    expect(read("src/app/(site)/dashboard/strategist/page.tsx")).toMatch(/streamPost\("\/v1\/content\/suggest", .*newActionKey\(\)\)/);
    const detail = read("src/app/(site)/dashboard/strategist/[id]/page.tsx");
    expect(detail).toMatch(/generate-brief`, undefined, newActionKey\(\)\)/);
    expect(detail).toMatch(/generate-content`, undefined, newActionKey\(\)\)/);
  });
});
