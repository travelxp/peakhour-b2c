import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * PE-13 wiring, as STRING CHECKS on the source. A static render cannot run a hook or follow a prop from a list to its card, so this reads the
 * three files that carry the line and fails if one is unplugged. It proves the words are present, not that the screen works: a browser does.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), "src", "components", "presence", "edit", rel), "utf8");

describe("what followed a change is wired", () => {
  it("the requests list's owner makes the one request and hands each row its slot", () => {
    const status = readFileSync(join(process.cwd(), "src", "components", "presence", "publishing-status.tsx"), "utf8");
    expect(status).toContain("useChangeOutcomes(listing?.id, changes.data?.items, caps.data)");
    expect(status).toContain("outcomeFor={outcomes.slotFor}");
    // the panels no longer list changes, so they make no outcomes request
    for (const file of ["edit-listing-card.tsx", "photos-card.tsx", "extra-panel.tsx"]) expect(read(file), file).not.toContain("useChangeOutcomes");
  });

  it("the request row draws the answer it is given and asks for nothing itself", () => {
    const src = readFileSync(join(process.cwd(), "src", "components", "presence", "requests-list.tsx"), "utf8");
    expect(src).toContain("<ChangeOutcome slot={outcome} />");
    expect(src).not.toContain("useChangeOutcomes(");
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
