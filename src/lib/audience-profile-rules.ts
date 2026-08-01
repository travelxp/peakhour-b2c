import type { CorrectableFieldSpec, EvidenceTier, ProfileSource } from "@/lib/api/audiences";

/**
 * The decisions the profile panel makes, extracted so they can be tested.
 *
 * This repo has no DOM test environment on purpose (`vitest.config.ts`:
 * node-only until a primitive genuinely needs jsdom), so rendering is not what
 * gets asserted here. What CAN be got wrong without a DOM — and what would be
 * invisible in review — is the judgement: which evidence tier a claim rests on,
 * whether a correction is safe to send, and whether the client's idea of "the
 * same entry" matches the server's. Those live here.
 */

/**
 * The tier a claim RESTS ON: the highest present, not the first.
 *
 * A persona the business declared AND that we then measured carries both
 * `stated` and `observed`; it is a stated fact with corroboration, and showing
 * it as "we measured" would understate what we actually know. The ordering is
 * §5.1's, and the whole panel is an argument that the difference matters.
 */
export function highestTier(sources?: ProfileSource[]): EvidenceTier | undefined {
  return topSource(sources)?.tier;
}

/**
 * The winning tier's OWN source, so a detail can never be attributed to a tier
 * that did not produce it.
 *
 * ★THE BUG THIS EXISTS TO PREVENT is live in the server's own data. A segment
 * the business declared AND that we then tagged carries two sources: a STATED
 * one naming `org_businesses.taxonomy.audienceSegments` with no detail, and an
 * OBSERVED one carrying "tagged on 12 pieces". Taking "the first source with a
 * detail" renders "You told us — tagged on 12 pieces": a measurement presented
 * as the provenance of a stated fact, on a panel whose entire thesis is that
 * the difference matters.
 */
export function topSource(sources?: ProfileSource[]): ProfileSource | undefined {
  if (!sources?.length) return undefined;
  for (const tier of ["stated", "observed", "inferred"] as const) {
    const withDetail = sources.find((s) => s.tier === tier && s.detail);
    if (withDetail) return withDetail;
    const any = sources.find((s) => s.tier === tier);
    if (any) return any;
  }
  return undefined;
}

/** One claim's worth of evidence assembled from SEVERAL entries — the geography
 *  line is one sentence built from many claims, and badging it with the first
 *  entry's tier would call the whole list stated because one country was. */
export function mergeSources(lists: Array<ProfileSource[] | undefined>): ProfileSource[] {
  return lists.flatMap((l) => l ?? []);
}

/**
 * Did this correction actually change anything?
 *
 * ★SAVING A NO-OP IS NOT HARMLESS, and the server cannot detect it. Every entry
 * a list correction names is rewritten as `stated / user_correction` — so
 * opening the ICP editor, changing nothing and pressing Save turns four
 * inferred ICPs into four "You told us" claims the user never made, and appends
 * a null delta to the log that §12.4 calls the best learning signal this engine
 * will ever get. The panel is the only place this can be caught.
 */
export function correctionIsNoop(
  spec: CorrectableFieldSpec,
  original: { value: string; list: string[] },
  draft: { value: string; list: string[] },
): boolean {
  if (spec.shape === "list") {
    const a = dedupeLabels(original.list);
    const b = dedupeLabels(draft.list);
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return original.value.trim() === draft.value.trim();
}

/**
 * Collapse a list the way the SERVER collapses it — trim, drop blanks, and
 * remove case-colliding duplicates, first occurrence winning.
 *
 * Matching the server exactly is the point. `applyCorrections` dedupes
 * case-insensitively, so a client that sent both "ICP A" and "icp a" would
 * have the log record two entries and the profile hold one — a log that
 * disagrees with the field it produced, teaching the learning loop about an
 * entry that never existed.
 */
export function dedupeLabels(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (v.length === 0) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** Why a correction cannot be sent, or undefined when it can. The message is
 *  user-facing: the point of checking here is that the user never learns a
 *  limit by being refused. */
export function correctionBlockedReason(
  spec: CorrectableFieldSpec,
  draft: { value: string; list: string[] },
): string | undefined {
  if (spec.shape === "list") {
    const clean = dedupeLabels(draft.list);
    if (spec.maxItems !== undefined && clean.length > spec.maxItems) {
      return `That's more than the maximum of ${spec.maxItems}.`;
    }
    const tooLong = clean.find((v) => v.length > spec.maxLength);
    if (tooLong) return `Keep each one under ${spec.maxLength} characters.`;
    // ★AN EMPTY LIST IS NOT BLOCKED. "None of these apply" is a real
    // correction and clearing the list is the only way to say it — the server
    // treats an explicitly-empty list as a statement, and a client that
    // refused to send one would make that unreachable.
    return undefined;
  }
  const value = draft.value.trim();
  if (!value) return "Give us something to go on.";
  if (value.length > spec.maxLength) return `Keep it under ${spec.maxLength} characters.`;
  if (spec.values && !spec.values.includes(value)) return "Choose one of the options.";
  if (spec.csv === "iso2") {
    const parts = value
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
    const bad = parts.find((x) => !/^[A-Za-z]{2}$/.test(x));
    if (parts.length === 0 || bad) {
      return bad
        ? `"${bad}" isn't a two-letter country code.`
        : "Give us at least one two-letter country code.";
    }
    if (spec.maxCount !== undefined && parts.length > spec.maxCount) {
      return `That's more than ${spec.maxCount} countries.`;
    }
  }
  return undefined;
}
