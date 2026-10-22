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
 * "these do not overlap". An `unavailable` basis is said as such. And the
 * figure is the platform's rounded estimate, so it reads "about".
 */
import type { AudienceSet } from "@/lib/api/audiences";
import { attributeLabel } from "@/lib/audience-library-rules";

/** The statuses whose audiences can still run: a discarded or superseded one is not a cost. */
const LIVE_STATUSES = new Set(["proposed", "applied"]);

export interface ExclusionsSummary {
  /** One per distinct suggestion, with the audiences it was suggested for. */
  suggested: Array<{ reason: string; label: string; values: string[]; audiences: string[] }>;
  /** One per PAIR (each set records the other, so every pair arrives twice). */
  overlaps: Array<{ a: string; b: string; approxMembers?: number; reason?: string }>;
  /** Audiences whose overlap the platform could not measure, by reason. */
  unmeasured: Array<{ reason: string; audiences: string[] }>;
  /** How many live audiences were read. */
  audiences: number;
}

/** The overlap figure as a merchant reads it: rounded, "about". */
export function formatMembers(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

/**
 * What the library's live audiences say about exclusions, deduplicated.
 *
 * ★A PAIR IS COUNTED ONCE, AND ONLY WHILE BOTH CAN RUN. Each set stores its
 * overlap with every sibling, so A→B and B→A are one fact; and an overlap with
 * an audience since discarded no longer costs anything. Where the two rows
 * disagree, a figure beats a reason — a measurement is the stronger statement.
 */
export function summarizeExclusions(sets: readonly AudienceSet[]): ExclusionsSummary {
  const live = sets.filter((s) => LIVE_STATUSES.has(s.status));
  const liveIds = new Set(live.map((s) => s.id));
  const nameOf = new Map(live.map((s) => [s.id, s.name]));

  const suggested = new Map<string, ExclusionsSummary["suggested"][number]>();
  const pairs = new Map<string, ExclusionsSummary["overlaps"][number]>();
  const unmeasured = new Map<string, string[]>();

  for (const set of live) {
    const ex = set.exclusions;
    if (!ex) continue;
    for (const s of ex.suggested ?? []) {
      const key = JSON.stringify([s.attribute, s.variant, [...s.values].sort(), s.reason]);
      const row = suggested.get(key) ?? { reason: s.reason, label: attributeLabel(s.attribute), values: [...s.values], audiences: [] };
      if (!row.audiences.includes(set.name)) row.audiences.push(set.name);
      suggested.set(key, row);
    }
    if (ex.overlapBasis === "unavailable") {
      const reason = ex.overlapUnavailableReason?.trim() || "The platform could not measure overlap.";
      // One entry per audience: each set is read once, and two audiences may share a name.
      unmeasured.set(reason, [...(unmeasured.get(reason) ?? []), set.name]);
      continue;
    }
    for (const o of ex.overlaps ?? []) {
      if (o.setId === set.id || !liveIds.has(o.setId)) continue;
      const [x, y] = [set.id, o.setId].sort();
      const key = `${x}|${y}`;
      const figure = typeof o.approxMembers === "number" && Number.isFinite(o.approxMembers) ? o.approxMembers : undefined;
      const prev = pairs.get(key);
      if (prev && (prev.approxMembers !== undefined || figure === undefined)) continue;
      pairs.set(key, {
        a: nameOf.get(x) ?? o.name,
        b: nameOf.get(y) ?? o.name,
        ...(figure !== undefined ? { approxMembers: figure } : o.reason ? { reason: o.reason } : {}),
      });
    }
  }

  const overlaps = [...pairs.values()].sort((p, q) => (q.approxMembers ?? -1) - (p.approxMembers ?? -1));
  return {
    suggested: [...suggested.values()],
    overlaps,
    unmeasured: [...unmeasured].map(([reason, audiences]) => ({ reason, audiences })),
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

/** Whether there is anything to show beyond "nothing yet". */
export function hasExclusions(s: ExclusionsSummary): boolean {
  return s.suggested.length > 0 || s.overlaps.length > 0 || s.unmeasured.length > 0;
}
