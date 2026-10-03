/**
 * D-05 — the merchant's guardrails card: the form, as pure functions.
 *
 * ★THE API DECIDES; THIS FILE ONLY SHAPES AND PRE-CHECKS. Terms are normalised
 * server-side (accents, punctuation, the "&" twin) and their length and count
 * are checked there, on the normalised form — so they are NOT pre-checked here
 * (review R1: a raw count or length disagreed with the api's). The checks kept
 * here are the ones a merchant can fix in the form before a round trip: a
 * time, a day, a range, the blackout cap.
 */
import type { Guardrails } from "@/lib/api/growth";

/** The channels a merchant can turn off, in the order the card lists them. */
export const GUARDRAIL_CHANNELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "meta", label: "Meta (Facebook & Instagram)" },
  { key: "x", label: "X" },
  { key: "google_ads", label: "Google Ads" },
];

/** mig 372's blackout cap, refused here in the api's terms. */
export const MAX_BLACKOUTS = 50;

export interface GuardrailsDraft {
  deniedChannels: string[];
  /** The textarea, as typed: ONE TERM PER LINE. */
  termsText: string;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  blackouts: Array<{ from: string; to: string; label: string }>;
  /** The zone the windows are read in. Empty = the business's own (the api
   *  derives it). Seeded from the stored zone when that is readable. */
  timeZone: string;
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

/** Whether this runtime can read `zone` — the same question the api asks. */
export function isReadableZone(zone: string | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Terms from the textarea: ONE PER LINE, trimmed, each once
 * (case-insensitively), in the order typed. ★Not split on commas (review R1):
 * "Acme, Inc." is one name, and splitting it blocked the word "Inc" everywhere.
 */
export function parseTerms(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split("\n")) {
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
    // ★An unreadable stored zone is NOT seeded (review R1): sending it back
    //  would 400 on every save, and the api's refusal tells the merchant to
    //  save again — which could then never work.
    timeZone: isReadableZone(g?.timeZone) ? g!.timeZone! : "",
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
 * an emptied list clears that rule. The draft's zone is sent when a window or
 * blackout reads one, so saving never moves a window to a re-derived zone;
 * empty lets the api use the business's own.
 */
export function buildGuardrailsPatch(
  draft: GuardrailsDraft,
): { ok: true; patch: GuardrailsPatch } | { ok: false; error: string } {
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
  const zone = draft.timeZone.trim();
  const usesZone = draft.quietEnabled || blackouts.length > 0;
  if (usesZone && zone && !isReadableZone(zone)) {
    return { ok: false, error: `"${zone}" isn't a time zone we recognise — try one like Europe/London or Asia/Kolkata.` };
  }
  return {
    ok: true,
    patch: {
      deniedChannels: [...new Set(draft.deniedChannels)],
      blockedTerms: parseTerms(draft.termsText),
      quietHours: draft.quietEnabled ? { start: draft.quietStart, end: draft.quietEnd } : null,
      blackoutDates: blackouts,
      ...(usesZone && zone ? { timeZone: zone } : {}),
    },
  };
}

/** Today, "YYYY-MM-DD", on `zone`'s calendar (else the browser's). */
export function todayIn(zone: string | undefined, now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: isReadableZone(zone) ? zone : undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}

/** Blackouts that have not yet ended (review R1: a past one is no rule in force). */
export function activeBlackouts(g: Guardrails | undefined, today: string) {
  return (g?.blackoutDates ?? []).filter((b) => b.to >= today);
}

/** Whether anything is set — the card's Clear button reads it. */
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
export function describeGuardrails(g: Guardrails | undefined, today: string = todayIn(g?.timeZone)): string[] {
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
  const upcoming = activeBlackouts(g, today).length;
  if (upcoming) {
    out.push(`Starts no spend on ${upcoming} upcoming blackout period${upcoming === 1 ? "" : "s"}${zone}.`);
  }
  return out;
}

/**
 * The api's own sentence only where it is written for merchants — a
 * VALIDATION_ERROR naming what to fix (review R1). Everything else (a proxy's
 * non-JSON, a zod "Invalid body", a config error) gets a generic sentence that
 * does not promise a retry fixes it.
 */
export function guardrailsSaveError(err: { code?: string; message?: string } | null | undefined): string {
  if (err?.code === "VALIDATION_ERROR" && err.message && err.message !== "Invalid body") return err.message;
  return "We couldn't save your guardrails. Check them and try again — if it keeps happening, contact support.";
}
