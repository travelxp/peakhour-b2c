import type { AudienceSet, AudienceSkillLearning } from "@/lib/api/audiences";
import { attributeLabel } from "@/lib/audience-library-rules";

/**
 * The decisions the learning surfaces make (H1), extracted so they can be
 * tested — this repo is vitest node-only by design.
 *
 * ★AND WHAT THEY DECIDE IS, AGAIN, WHICH KIND OF NOTHING. "We have learned
 * nothing" is four different sentences depending on why, and only one of them
 * is about the engine failing.
 */

export interface LearningState {
  kind: "learned" | "watching" | "too_few" | "not_set_up";
  text: string;
}

/**
 * What to say about one skill's learnings.
 *
 * ★"NEVER SET UP" IS NOT "LEARNED NOTHING". A business whose skills have never
 * been cloned has not disappointed anybody, and telling them the engine has
 * learned nothing about them would be an accusation aimed the wrong way.
 *
 * ★AND "TOO FEW OBSERVATIONS" IS NOT "NOTHING TO SAY". The extractor refuses to
 * publish below the api's floor on purpose — a pattern from four edits is a
 * hunch — so a young business is early, not disappointing. The floor comes from
 * the api precisely so this sentence can say how far off it is.
 */
export function learningState(skill: AudienceSkillLearning, minimum: number): LearningState {
  if (skill.learnings) {
    const n = skill.learnings.sampleSize;
    return {
      kind: "learned",
      text:
        typeof n === "number"
          ? `from ${n} time${n === 1 ? "" : "s"} you told us`
          : "from your corrections",
    };
  }
  if (!skill.configured) return { kind: "not_set_up", text: "not set up for you yet" };
  const decided = decidedCount(skill);
  if (minimum > 0 && decided < minimum) {
    // ★A COUNT, NOT "SOON". "1 of 8" is something a customer can act on —
    // correct one more audience — and "soon" is a promise nobody made.
    return { kind: "too_few", text: `watching — ${decided} of ${minimum} so far` };
  }
  return { kind: "watching", text: "watching, nothing to report yet" };
}

/** How many decided observations this skill has. `totalUses` counts every run;
 *  only accepted / edited / rejected are DECISIONS, which is what the extractor
 *  counts. */
function decidedCount(skill: AudienceSkillLearning): number {
  const e = skill.effectiveness;
  if (!e) return 0;
  return (e.accepted ?? 0) + (e.edited ?? 0) + (e.rejected ?? 0);
}

/** One hand-correction, as a sentence a person reads. */
export interface EditLine {
  attribute: string;
  /** What we proposed. Empty when we proposed nothing for this attribute — the
   *  customer ADDED it, which is the more interesting direction. */
  from: string[];
  /** What they chose instead. Empty when they removed the attribute outright,
   *  which is itself the lesson. */
  to: string[];
  text: string;
}

/**
 * What we proposed and what the customer changed it to.
 *
 * ★AN ABSENT `to` IS NOT AN EMPTY CHOICE. The api omits it when the attribute
 * was removed outright — "changed to nothing in particular" is what an empty
 * list would read as, and the removal is the lesson. An absent `from` is the
 * mirror: they added something we never suggested.
 */
export function editLines(set: Pick<AudienceSet, "userEdits">): EditLine[] {
  return (set.userEdits ?? []).map((edit) => {
    const attribute = edit.attribute ?? "targeting";
    const label = attributeLabel(attribute);
    const from = edit.from ?? [];
    const to = edit.to ?? [];
    const text =
      to.length === 0
        ? `You removed ${label.toLowerCase()}${from.length > 0 ? ` (${from.join(", ")})` : ""}`
        : from.length === 0
          ? `You added ${label.toLowerCase()}: ${to.join(", ")}`
          : `You changed ${label.toLowerCase()} from ${from.join(", ")} to ${to.join(", ")}`;
    return { attribute, from, to, text };
  });
}
