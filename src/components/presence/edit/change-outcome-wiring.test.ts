import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * PE-13 wiring, as STRING CHECKS on the source. A static render cannot run a hook or follow a prop from a list to its card, so this reads the
 * three files that carry the line and fails if one is unplugged. It proves the words are present, not that the screen works: a browser does.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), "src", "components", "presence", "edit", rel), "utf8");

describe("what followed a change is wired", () => {
  it("each card that lists changes makes the one request and hands each card its slot", () => {
    for (const file of ["edit-listing-card.tsx", "photos-card.tsx"]) {
      const src = read(file);
      expect(src, file).toContain("useChangeOutcomes(listing?.id, changes.data?.items, caps.data)");
      expect(src, file).toContain("outcome={outcomes.slotFor(c)}");
    }
  });

  it("the change card draws the answer it is given and asks for nothing itself", () => {
    const src = read("change-card.tsx");
    expect(src).toContain("<ChangeOutcome slot={outcome} />");
    expect(src).not.toContain("useChangeOutcomes");
    expect(read("change-outcome.tsx")).not.toMatch(/from "@\/hooks|@tanstack|fetch\(/);
  });

  it("no mutation invalidates the outcomes: the key follows the changes, so every path refreshes", () => {
    const hook = readFileSync(join(process.cwd(), "src", "hooks", "use-presence-edit.ts"), "utf8");
    expect(hook).not.toContain("outcomesAll");
    expect(hook).toContain("outcomeSignature(changes, caps)");
    expect(hook).toContain("placeholderData: keepPreviousData");
    expect(hook).toContain("refetchInterval: (query) => outcomesRefetchMs(query.state.data)");
  });
});
