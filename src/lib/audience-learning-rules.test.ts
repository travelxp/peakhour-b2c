import { describe, it, expect } from "vitest";
import type { AudienceSkillLearning } from "@/lib/api/audiences";
import { editLines, learningState } from "./audience-learning-rules";

/**
 * H1's judgement, which is — again — almost entirely about which KIND of
 * nothing. "We have learned nothing" is four different sentences depending on
 * why, and only one of them is about the engine failing.
 */

const skill = (over: Partial<AudienceSkillLearning> = {}): AudienceSkillLearning => ({
  skillId: "generate_audience_hypotheses",
  label: "Suggesting audiences",
  configured: true,
  ...over,
});

describe("learningState", () => {
  it("★never says 'learned nothing' about a skill nobody has set up", () => {
    // A business whose skills have never been cloned has not disappointed
    // anybody, and saying otherwise is an accusation aimed the wrong way.
    const out = learningState(skill({ configured: false }), 8);
    expect(out.kind).toBe("not_set_up");
    expect(out.text).toContain("not set up");
  });

  it("★counts toward the floor rather than promising 'soon'", () => {
    // The extractor refuses below the api's floor on purpose — a pattern from
    // four edits is a hunch — so a young business is EARLY, not failing. "1 of
    // 8" is something a customer can act on; "soon" is a promise nobody made.
    const out = learningState(
      skill({ effectiveness: { totalUses: 9, accepted: 1, edited: 0, rejected: 0 } }),
      8,
    );
    expect(out.kind).toBe("too_few");
    expect(out.text).toBe("watching — 1 of 8 so far");
  });

  it("★counts DECISIONS, not runs", () => {
    // `totalUses` counts every invocation; only accepted / edited / rejected
    // are decisions, and those are what the extractor waits for. Counting runs
    // would tell a customer they were nearly there when nobody had judged
    // anything.
    const out = learningState(
      skill({ effectiveness: { totalUses: 40, accepted: 2, edited: 1, rejected: 1 } }),
      8,
    );
    expect(out.text).toBe("watching — 4 of 8 so far");
  });

  it("carries the sample a finding came from", () => {
    // A pattern from 4 observations and one from 400 read differently, and this
    // is the only thing that says which.
    const out = learningState(
      skill({ learnings: { whatWorks: ["x"], whatDoesntWork: [], sampleSize: 24 } }),
      8,
    );
    expect(out.kind).toBe("learned");
    expect(out.text).toBe("from 24 times you told us");
  });

  it("does not invent a sample it was not given", () => {
    const out = learningState(skill({ learnings: { whatWorks: ["x"], whatDoesntWork: [] } }), 8);
    expect(out.kind).toBe("learned");
    expect(out.text).not.toMatch(/\d/);
  });
});

describe("editLines", () => {
  it("★reads an absent `to` as a REMOVAL, not as an empty choice", () => {
    // The api omits `to` when the attribute was removed outright — "changed to
    // nothing in particular" is what an empty list would read as, and the
    // removal is the lesson.
    const [line] = editLines({
      userEdits: [{ at: "x", attribute: "seniority", from: ["Director", "VP"] }],
    });
    expect(line!.text).toBe("You removed seniority (Director, VP)");
  });

  it("★reads an absent `from` as an ADDITION, which is the other direction", () => {
    // They chose something we never suggested — the strongest correction there
    // is, and indistinguishable from a change if both halves are flattened.
    const [line] = editLines({
      userEdits: [{ at: "x", attribute: "job_title", to: ["Head of Corporate Travel"] }],
    });
    expect(line!.text).toBe("You added job title: Head of Corporate Travel");
  });

  it("names both halves of a change", () => {
    const [line] = editLines({
      userEdits: [{ at: "x", attribute: "geo", from: ["India"], to: ["India", "UAE"] }],
    });
    expect(line!.text).toBe("You changed location from India to India, UAE");
  });

  it("falls back to a word rather than rendering a blank for an unattributed edit", () => {
    // `attribute` is optional on the row. An edit with no attribute is still an
    // edit, and dropping it would make a corrected audience look untouched.
    const [line] = editLines({ userEdits: [{ at: "x", to: ["something"] }] });
    expect(line!.text).toContain("targeting");
  });

  it("says nothing about an audience nobody corrected", () => {
    expect(editLines({})).toEqual([]);
  });
});
