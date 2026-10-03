/**
 * D-05 — the merchant's guardrails card: the form, as pure functions.
 *
 * ★THE API DECIDES; THIS FILE ONLY SHAPES AND PRE-CHECKS. Terms are normalised
 * server-side (accents, punctuation, the "&" twin), the time zone is resolved
 * there when none is sent, and every rule is re-validated there. The checks
 * here exist so the merchant hears about a typo before a round trip, in the
 * same words — never as a second source of truth for what is allowed.
 */
import type { Guardrails } from "@/lib/api/growth";

/** The channels a merchant can turn off, in the order the card lists them. */
export const GUARDRAIL_CHANNELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "meta", label: "Meta (Facebook & Instagram)" },
  { key: "x", label: "X" },
  { key: "google_ads", label: "Google Ads" },
];

/** mig 372's caps, so a list past them is refused here in the api's terms. */
export const MAX_BLOCKED_TERMS = 100;
export const MAX_BLACKOUTS = 50;
export const MAX_TERM_LENGTH = 80;

export interface GuardrailsDraft {
  deniedChannels: string[];
  /** The textarea, as typed: one term per line or comma-separated. */
  termsText: string;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  blackouts: Array<{ from: string; to: string; label: string }>;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isHourMinute(s: string): boolean {
  return HHMM.test(s);
}

/** "YYYY-MM-DD" that names a real day (no 2026-02-30). */
export function isCalendarDay(s: string): boolean {
  if (!YMD.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d!));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m! - 1;
}

/** Terms from the textarea: split on newlines and commas, trimmed, each once
 *  (case-insensitively), in the order typed. */
export function parseTerms(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[\n,]/)) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** The form, seeded from what is stored (or empty). */
export function draftFromStored(g: Guardrails | undefined): GuardrailsDraft {
  return {
    deniedChannels: [...(g?.deniedChannels ?? [])],
    termsText: (g?.blockedTerms ?? []).join("\n"),
    quietEnabled: !!g?.quietHours,
    quietStart: g?.quietHours?.start ?? "22:00",
    quietEnd: g?.quietHours?.end ?? "07:00",
    blackouts: (g?.blackoutDates ?? []).map((b) => ({ from: b.from, to: b.to, label: b.label ?? "" })),
  };
}

export type GuardrailsPatch = {
  deniedChannels: string[];
  blockedTerms: string[];
  quietHours: { start: string; end: string } | null;
  blackoutDates: Array<{ from: string; to: string; label?: string }>;
  timeZone?: string;
};

/**
 * The PATCH body for the draft, or the first thing wrong with it in words the
 * merchant can act on. ★WRITTEN WHOLE: every rule the card shows is sent, so
 * an emptied list clears that rule. The stored zone is sent back unchanged
 * when there is one, so saving never moves a window to a re-derived zone.
 */
export function buildGuardrailsPatch(
  draft: GuardrailsDraft,
  storedTimeZone?: string,
): { ok: true; patch: GuardrailsPatch } | { ok: false; error: string } {
  const terms = parseTerms(draft.termsText);
  if (terms.length > MAX_BLOCKED_TERMS) {
    return { ok: false, error: `You can block up to ${MAX_BLOCKED_TERMS} terms; this list has ${terms.length}.` };
  }
  const tooLong = terms.find((t) => t.length > MAX_TERM_LENGTH);
  if (tooLong) {
    return { ok: false, error: `"${tooLong.slice(0, 40)}…" is longer than ${MAX_TERM_LENGTH} characters.` };
  }
  if (draft.quietEnabled) {
    if (!isHourMinute(draft.quietStart) || !isHourMinute(draft.quietEnd)) {
      return { ok: false, error: "Quiet hours need a start and an end time, like 22:00 and 07:00." };
    }
    if (draft.quietStart === draft.quietEnd) {
      return { ok: false, error: "Quiet hours need different start and end times." };
    }
  }
  if (draft.blackouts.length > MAX_BLACKOUTS) {
    return { ok: false, error: `You can set up to ${MAX_BLACKOUTS} blackout periods.` };
  }
  const blackouts: GuardrailsPatch["blackoutDates"] = [];
  for (const b of draft.blackouts) {
    if (!isCalendarDay(b.from) || !isCalendarDay(b.to)) {
      return { ok: false, error: "Each blackout needs a start and an end date." };
    }
    if (b.from > b.to) {
      return { ok: false, error: `A blackout from ${b.from} to ${b.to} ends before it starts.` };
    }
    const label = b.label.trim();
    if (label.length > 80) return { ok: false, error: "A blackout's label can be at most 80 characters." };
    blackouts.push({ from: b.from, to: b.to, ...(label ? { label } : {}) });
  }
  const usesZone = draft.quietEnabled || blackouts.length > 0;
  return {
    ok: true,
    patch: {
      deniedChannels: [...new Set(draft.deniedChannels)],
      blockedTerms: terms,
      quietHours: draft.quietEnabled ? { start: draft.quietStart, end: draft.quietEnd } : null,
      blackoutDates: blackouts,
      ...(usesZone && storedTimeZone ? { timeZone: storedTimeZone } : {}),
    },
  };
}

/** Whether anything is set — the card's summary and its Clear button read it. */
export function hasGuardrails(g: Guardrails | undefined): boolean {
  return (
    !!g &&
    ((g.deniedChannels?.length ?? 0) > 0 ||
      (g.blockedTerms?.length ?? 0) > 0 ||
      !!g.quietHours ||
      (g.blackoutDates?.length ?? 0) > 0)
  );
}

/** One line per rule in force, for the card's read-only view. */
export function describeGuardrails(g: Guardrails | undefined): string[] {
  if (!g) return [];
  const out: string[] = [];
  const label = (k: string) => GUARDRAIL_CHANNELS.find((c) => c.key === k)?.label ?? k;
  if (g.deniedChannels?.length) {
    out.push(`Never advertises on ${g.deniedChannels.map(label).join(", ")}.`);
  }
  if (g.blockedTerms?.length) {
    const n = g.blockedTerms.length;
    out.push(`Blocks ${n} term${n === 1 ? "" : "s"} from every ad: ${g.blockedTerms.slice(0, 5).join(", ")}${n > 5 ? ", …" : ""}.`);
  }
  const zone = g.timeZone ? ` (${g.timeZone})` : "";
  if (g.quietHours) {
    out.push(`Starts no spend between ${g.quietHours.start} and ${g.quietHours.end}${zone}.`);
  }
  if (g.blackoutDates?.length) {
    const n = g.blackoutDates.length;
    out.push(`Starts no spend on ${n} blackout period${n === 1 ? "" : "s"}${zone}.`);
  }
  return out;
}
