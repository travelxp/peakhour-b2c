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
import { REACH_FORMAT, attributeLabel } from "@/lib/audience-library-rules";

/** The statuses whose audiences can still run: a discarded or superseded one is not a cost. */
export const LIVE_STATUSES = ["proposed", "applied"] as const satisfies readonly [string, string];
const LIVE = new Set<string>(LIVE_STATUSES);

export interface ExclusionsSummary {
  /** One per distinct suggestion, with the audiences it was suggested for. */
  suggested: Array<{ key: string; reason: string; attribute: string; label: string; variant: string; values: string[]; audiences: string[] }>;
  /** One per PAIR (each set records the other, so every pair arrives twice). */
  overlaps: Array<{ key: string; a: string; b: string; approxMembers?: number; reason?: string }>;
  /** Audiences whose overlap the platform could not measure, by reason. */
  unmeasured: Array<{ reason: string; audiences: string[] }>;
  /** How many live audiences were read. */
  audiences: number;
  /** How many of them the engine has examined (carry `exclusions`) — review R2:
   *  "nothing to exclude across your 7 audiences" about seven it never checked
   *  is a claim made from no reading. */
  checked: number;
}

/** The overlap figure as a merchant reads it: rounded, "about" — the library's
 *  own fixed-locale formatter, so reach and overlap figures cannot drift (R2). */
export function formatMembers(n: number): string {
  return REACH_FORMAT.format(Math.round(n));
}

/** Said when a pair's stored count is 0 (see header). ★The platform DID answer
 *  zero (review R2) — and gives zero below its reporting minimum too. */
const ZERO_COUNT = "the platform's count came back as zero, which it also gives below its reporting minimum";

/** How many audience names a suggestion lists before "and N more" (review R2). */
export const NAMES_SHOWN = 3;

/** "A, B, C and 4 more" — a suggestion made for every audience must not list a hundred. */
export function namesLine(names: readonly string[], shown: number = NAMES_SHOWN): string {
  if (names.length <= shown) return names.join(", ");
  return `${names.slice(0, shown).join(", ")} and ${names.length - shown} more`;
}

/**
 * What the library's live audiences say about exclusions, deduplicated.
 *
 * ★A PAIR IS COUNTED ONCE, AND ONLY WHILE BOTH CAN RUN. Each set stores its
 * overlap with every sibling, so A→B and B→A are one fact; and an overlap with
 * an audience since discarded no longer costs anything. Where the two rows
 * disagree, a figure beats a reason — a measurement is the stronger statement.
 *
 * ★A SIBLING NOT READ IS DROPPED, AND THE CARD SAYS SO (review R2, after R1
 * kept it): one missing from `sets` may be off the page OR discarded, and the
 * row cannot tell which — keeping it claimed "these two bid against each
 * other" about an audience that can no longer run. The card discloses that
 * overlaps with unread audiences are not shown.
 */
export function summarizeExclusions(sets: readonly AudienceSet[]): ExclusionsSummary {
  const live = sets.filter((s) => LIVE.has(s.status));
  const nameOf = new Map(live.map((s) => [s.id, s.name]));

  const suggested = new Map<string, ExclusionsSummary["suggested"][number]>();
  const suggestedIds = new Map<string, Set<string>>();
  const pairs = new Map<string, ExclusionsSummary["overlaps"][number]>();
  const ranks = new Map<string, number>();
  /** By plan AND reason (review R3): the api decides `unavailable` per plan. */
  const unmeasured = new Map<string, { reason: string; audiences: string[] }>();

  for (const set of live) {
    const ex = set.exclusions;
    if (!ex) continue;
    for (const s of ex.suggested ?? []) {
      const key = JSON.stringify([s.attribute, s.variant, [...s.values].sort(), s.reason]);
      const row = suggested.get(key) ?? {
        key,
        reason: s.reason,
        attribute: s.attribute,
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
      // A set with no plan was compared with nothing, so it is its own group.
      const group = `${set.planId ?? `set:${set.id}`}|${reason}`;
      const row = unmeasured.get(group) ?? { reason, audiences: [] };
      row.audiences.push(set.name);
      unmeasured.set(group, row);
      continue;
    }
    for (const o of ex.overlaps ?? []) {
      if (o.setId === set.id) continue;
      const siblingName = nameOf.get(o.setId);
      if (siblingName === undefined) continue;
      // ★EACH SIDE NAMED FOR ITSELF (review R1), by its current name.
      const mine = { id: set.id, name: set.name };
      const theirs = { id: o.setId, name: siblingName };
      const [first, second] = mine.id < theirs.id ? [mine, theirs] : [theirs, mine];
      const key = `${first.id}|${second.id}`;
      const figure =
        typeof o.approxMembers === "number" && Number.isFinite(o.approxMembers) && o.approxMembers > 0 ? o.approxMembers : undefined;
      const reason = o.reason ?? (o.approxMembers === 0 ? ZERO_COUNT : undefined);
      // ★THE STRONGER ROW WINS, WHICHEVER ARRIVES FIRST (review R3): a figure,
      //  then the api's own reason, then our zero sentence, then nothing — so
      //  the same pair reads the same in any page order.
      const rank = figure !== undefined ? 3 : o.reason ? 2 : reason ? 1 : 0;
      if ((ranks.get(key) ?? -1) >= rank) continue;
      ranks.set(key, rank);
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
    // ★OVERLAP NEEDS TWO, IN THE SAME GROUP (reviews R1, R2): the api decides
    //  `unavailable` per plan and platform, and the reason names the platform —
    //  so a lone audience under a reason has nothing it was not compared with,
    //  whatever else the library holds.
    unmeasured: [...unmeasured.values()].filter((u) => u.audiences.length >= 2),
    audiences: live.length,
    checked: live.filter((s) => s.exclusions !== undefined).length,
  };
}

/** One overlap, in a sentence that never turns an absence into a zero. */
export function overlapLine(o: ExclusionsSummary["overlaps"][number]): string {
  if (o.approxMembers !== undefined) {
    return `${o.a} and ${o.b} share about ${formatMembers(o.approxMembers)} people — running both makes them bid against each other.`;
  }
  return `${o.a} and ${o.b}: not measured — ${o.reason ?? "the platform did not give a figure"}.`;
}

/**
 * A suggestion's variant in words, where it is not the obvious one. ★Employer
 * wording only for the employer attribute (review R3); any other reads plainly.
 */
export function variantNote(variant: string, attribute: string): string {
  if (variant === "current") return "";
  if (attribute === "company_name") return variant === "past" ? " — people who used to work there" : " — current or past employees";
  return variant === "past" ? " (past)" : variant === "any" ? " (current or past)" : "";
}

/** Whether there is anything to show beyond "nothing yet". */
export function hasExclusions(s: ExclusionsSummary): boolean {
  return s.suggested.length > 0 || s.overlaps.length > 0 || s.unmeasured.length > 0;
}
