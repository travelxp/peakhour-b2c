/**
 * D-06 — the audience exclusions the engine already works out, as one summary
 * a merchant can read beside their guardrails.
 *
 * ★THE API HAS COMPUTED THESE SINCE B4 AND NOTHING HAS EVER SHOWN THEM.
 * Planning a portfolio runs `services/ads/audience-exclusions.ts`: it suggests
 * exclusions a merchant should never have to think of ("your own employees")
 * and MEASURES the overlap between every pair of audiences in the portfolio —
 * two audiences that overlap bid against each other, which costs more and
 * corrupts the comparison the portfolio exists to make. Each set stores the
 * result (`biz_audience_sets.exclusions`) and `GET /v1/audiences/sets` returns
 * it; this file is its first reader.
 *
 * ★WHAT IS NEVER SAID. A pair with a reason and no figure ("fewer than 300",
 * "the platform would not answer") is not a zero, so it is never rendered as
 * "these do not overlap" — and a stored 0 is not a measurement either (review
 * R1: the library's own `reachReading` treats a 0 count as no count). An
 * `unavailable` basis is said as such. And the figure is the platform's rounded
 * estimate, so it reads "about".
 */
import type { AudienceSet } from "@/lib/api/audiences";
import { attributeLabel } from "@/lib/audience-library-rules";

/** The statuses whose audiences can still run: a discarded or superseded one is not a cost. */
export const LIVE_STATUSES = ["proposed", "applied"] as const;
const LIVE = new Set<string>(LIVE_STATUSES);

export interface ExclusionsSummary {
  /** One per distinct suggestion, with the audiences it was suggested for. */
  suggested: Array<{ key: string; reason: string; label: string; variant: string; values: string[]; audiences: string[] }>;
  /** One per PAIR (each set records the other, so every pair arrives twice). */
  overlaps: Array<{ key: string; a: string; b: string; approxMembers?: number; reason?: string }>;
  /** Audiences whose overlap the platform could not measure, by reason. */
  unmeasured: Array<{ reason: string; audiences: string[] }>;
  /** How many live audiences were read. */
  audiences: number;
}

/** One formatter, fixed locale, like the library's reach figures (review R1). */
const MEMBERS = new Intl.NumberFormat("en-US");

/** The overlap figure as a merchant reads it: rounded, "about". */
export function formatMembers(n: number): string {
  return MEMBERS.format(Math.round(n));
}

/** Said when a pair's stored count is 0, which is no measurement (see header). */
const NO_COUNT = "the platform reported no count for the two together";

/**
 * What the library's live audiences say about exclusions, deduplicated.
 *
 * ★A PAIR IS COUNTED ONCE, AND ONLY WHILE BOTH CAN RUN. Each set stores its
 * overlap with every sibling, so A→B and B→A are one fact; and an overlap with
 * an audience since discarded no longer costs anything. Where the two rows
 * disagree, a figure beats a reason — a measurement is the stronger statement.
 *
 * ★`complete` SAYS WHETHER EVERY LIVE AUDIENCE WAS READ (review R1). Only then
 * is a sibling missing from `sets` known not to be live; on a partial read it
 * is merely off the page, and its pair is kept under the name the row stored.
 */
export function summarizeExclusions(sets: readonly AudienceSet[], opts: { complete?: boolean } = {}): ExclusionsSummary {
  const complete = opts.complete ?? true;
  const live = sets.filter((s) => LIVE.has(s.status));
  const nameOf = new Map(live.map((s) => [s.id, s.name]));

  const suggested = new Map<string, ExclusionsSummary["suggested"][number]>();
  const suggestedIds = new Map<string, Set<string>>();
  const pairs = new Map<string, ExclusionsSummary["overlaps"][number]>();
  const unmeasured = new Map<string, string[]>();

  for (const set of live) {
    const ex = set.exclusions;
    if (!ex) continue;
    for (const s of ex.suggested ?? []) {
      const key = JSON.stringify([s.attribute, s.variant, [...s.values].sort(), s.reason]);
      const row = suggested.get(key) ?? {
        key,
        reason: s.reason,
        label: attributeLabel(s.attribute),
        variant: s.variant,
        values: [...s.values],
        audiences: [],
      };
      const ids = suggestedIds.get(key) ?? new Set<string>();
      suggestedIds.set(key, ids);
      // ★BY ID, NOT NAME (review R1): two audiences may share a name, and
      //  "suggested for Founders" would then undercount them.
      if (!ids.has(set.id)) {
        ids.add(set.id);
        row.audiences.push(set.name);
      }
      suggested.set(key, row);
    }
    if (ex.overlapBasis === "unavailable") {
      const reason = ex.overlapUnavailableReason?.trim() || "The platform could not measure overlap.";
      // One entry per audience: each set is read once, and two audiences may share a name.
      unmeasured.set(reason, [...(unmeasured.get(reason) ?? []), set.name]);
      continue;
    }
    for (const o of ex.overlaps ?? []) {
      if (o.setId === set.id) continue;
      const siblingName = nameOf.get(o.setId);
      if (siblingName === undefined && complete) continue;
      // ★EACH SIDE NAMED FOR ITSELF (review R1): this set by its own name, the
      //  sibling by its live name or, off the page, the name its row stored.
      const mine = { id: set.id, name: set.name };
      const theirs = { id: o.setId, name: siblingName ?? o.name };
      const [first, second] = mine.id < theirs.id ? [mine, theirs] : [theirs, mine];
      const key = `${first.id}|${second.id}`;
      const figure =
        typeof o.approxMembers === "number" && Number.isFinite(o.approxMembers) && o.approxMembers > 0 ? o.approxMembers : undefined;
      const prev = pairs.get(key);
      if (prev && (prev.approxMembers !== undefined || figure === undefined)) continue;
      const reason = o.reason ?? (o.approxMembers === 0 ? NO_COUNT : undefined);
      pairs.set(key, {
        key,
        a: first.name,
        b: second.name,
        ...(figure !== undefined ? { approxMembers: figure } : reason ? { reason } : {}),
      });
    }
  }

  const overlaps = [...pairs.values()].sort((p, q) => (q.approxMembers ?? -1) - (p.approxMembers ?? -1));
  return {
    suggested: [...suggested.values()],
    overlaps,
    // ★OVERLAP NEEDS TWO (review R1): one audience on a platform that cannot
    //  count has nothing to compare, and "can't measure how much these
    //  overlap" about it is a caveat with no subject.
    unmeasured: live.length >= 2 ? [...unmeasured].map(([reason, audiences]) => ({ reason, audiences })) : [],
    audiences: live.length,
  };
}

/** One overlap, in a sentence that never turns an absence into a zero. */
export function overlapLine(o: ExclusionsSummary["overlaps"][number]): string {
  if (o.approxMembers !== undefined) {
    return `${o.a} and ${o.b} share about ${formatMembers(o.approxMembers)} people — running both makes them bid against each other.`;
  }
  return `${o.a} and ${o.b}: not measured — ${o.reason ?? "the platform did not give a figure"}.`;
}

/** A suggestion's variant in words, where it is not the obvious one. */
export function variantNote(variant: string): string {
  return variant === "past" ? " — people who used to work there" : variant === "any" ? " — current or past" : "";
}

/** Whether there is anything to show beyond "nothing yet". */
export function hasExclusions(s: ExclusionsSummary): boolean {
  return s.suggested.length > 0 || s.overlaps.length > 0 || s.unmeasured.length > 0;
}
