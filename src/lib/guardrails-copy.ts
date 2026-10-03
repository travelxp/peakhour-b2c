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
import type { Guardrails, GuardrailsPatch } from "@/lib/api/growth";
import { isClock, isTimeZone } from "@/lib/control-plane";

/** The channels a merchant can turn off, in the order the card lists them. */
export const GUARDRAIL_CHANNELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "meta", label: "Meta (Facebook & Instagram)" },
  { key: "x", label: "X" },
  { key: "google_ads", label: "Google Ads" },
];

/** mig 372's blackout cap, refused here in the api's terms. */
export const MAX_BLACKOUTS = 50;
/** The api's RAW term cap (its request schema), before normalising (R2). */
export const MAX_RAW_TERM_LENGTH = 200;

export interface GuardrailsDraft {
  deniedChannels: string[];
  /** The textarea, as typed: ONE TERM PER LINE. */
  termsText: string;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  blackouts: Array<{ from: string; to: string; label: string }>;
  /** The zone the windows are read in. Empty = the business's own (the api
   *  derives it). Seeded from the stored zone, whatever it is (R2). */
  timeZone: string;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** HH:MM, 24-hour — control-plane's `isClock`, the one definition (R2). */
export const isHourMinute = isClock;

/** "YYYY-MM-DD" that names a real day (no 2026-02-30). */
export function isCalendarDay(s: string): boolean {
  if (!YMD.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d!));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m! - 1;
}

/** Whether this browser can read `zone` — control-plane's `isTimeZone` (R2). */
export function isReadableZone(zone: string | undefined): zone is string {
  return !!zone && isTimeZone(zone);
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

/**
 * The form, seeded from what is stored (or empty). ★Blackouts that have
 * ENDED are left out (review R3): they bind nothing, the summary does not
 * show them, and carried into every save they counted toward the 50 cap
 * where the merchant could not see them. Saving drops them.
 */
export function draftFromStored(g: Guardrails | undefined, today: string = todayIn(g?.timeZone)): GuardrailsDraft {
  return {
    deniedChannels: [...(g?.deniedChannels ?? [])],
    termsText: (g?.blockedTerms ?? []).join("\n"),
    quietEnabled: !!g?.quietHours,
    quietStart: g?.quietHours?.start ?? "22:00",
    quietEnd: g?.quietHours?.end ?? "07:00",
    blackouts: activeBlackouts(g, today).map((b) => ({ from: b.from, to: b.to, label: b.label ?? "" })),
    // ★THE STORED ZONE, WHATEVER IT IS (review R2). A browser's zone list can
    //  lag the server's (an older ICU lacks newer ids), so dropping one this
    //  browser cannot read would quietly move every window to a re-derived
    //  zone on save. It is sent back as stored; if the SERVER cannot read it,
    //  its 400 names it and the zone picker is right there to change it.
    timeZone: g?.timeZone ?? "",
  };
}


/**
 * The PATCH body for the draft, or the first thing wrong with it in words the
 * merchant can act on. ★WRITTEN WHOLE: every rule the card shows is sent, so
 * an emptied list clears that rule. The draft's zone is sent when a window or
 * blackout reads one, so saving never moves a window to a re-derived zone;
 * empty lets the api use the business's own.
 */
export function buildGuardrailsPatch(
  draft: GuardrailsDraft,
): { ok: true; patch: Required<Omit<GuardrailsPatch, "timeZone">> & Pick<GuardrailsPatch, "timeZone"> } | { ok: false; error: string } {
  // ★The api's RAW cap, before it normalises (R2): a longer line is refused by
  //  its request schema as "Invalid body", which names nothing.
  const terms = parseTerms(draft.termsText);
  const tooLong = terms.find((t) => t.length > MAX_RAW_TERM_LENGTH);
  if (tooLong) {
    return { ok: false, error: `"${tooLong.slice(0, 40)}…" is longer than ${MAX_RAW_TERM_LENGTH} characters.` };
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
  const blackouts: Array<{ from: string; to: string; label?: string }> = [];
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
  // ⏸Not judged here (review R3): the picker offers only zones this browser
  //  reads, the stored one, or "the business's own" — and the stored one is
  //  the server's to judge, whose 400 names it.
  const zone = draft.timeZone.trim();
  const usesZone = draft.quietEnabled || blackouts.length > 0;
  return {
    ok: true,
    patch: {
      deniedChannels: [...new Set(draft.deniedChannels)],
      blockedTerms: terms,
      quietHours: draft.quietEnabled ? { start: draft.quietStart, end: draft.quietEnd } : null,
      blackoutDates: blackouts,
      ...(usesZone && zone ? { timeZone: zone } : {}),
    },
  };
}

/**
 * Legacy zone ids some engines list INSTEAD of today's names (V8's
 * supportedValuesOf has Asia/Calcutta and no Asia/Kolkata). Both read the
 * same; the merchant should see — and store — the name they know.
 */
const MODERN_ZONE: Readonly<Record<string, string>> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
};

/**
 * The zones the picker offers (review R3): the engine's list with legacy ids
 * written as today's names — kept only where this browser can read the
 * modern one — plus UTC, which V8 does not list. Sorted, each once.
 */
export function timeZoneOptions(supported: readonly string[]): string[] {
  const out = new Set<string>(["UTC"]);
  for (const z of supported) {
    const modern = MODERN_ZONE[z];
    out.add(modern && isReadableZone(modern) ? modern : z);
  }
  return [...out].sort();
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

/** Whether a blackout covers `today` — spend is being refused right now. */
export function blackoutToday(g: Guardrails | undefined, today: string): boolean {
  return (g?.blackoutDates ?? []).some((b) => b.from <= today && today <= b.to);
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
  const active = activeBlackouts(g, today).length;
  if (active) {
    // ★"Upcoming" was false for one in force today (R2) — the merchant whose
    //  spend is refused right now read that it was still ahead.
    const now = blackoutToday(g, today) ? ", including today" : "";
    out.push(`Starts no spend on ${active} blackout period${active === 1 ? "" : "s"}${now}${zone}.`);
  }
  return out;
}

/**
 * The api's own sentence only where it is written for merchants — a
 * VALIDATION_ERROR naming what to fix (review R1). Everything else (a proxy's
 * non-JSON, a zod "Invalid body", a config error) gets a generic sentence that
 * does not promise a retry fixes it.
 */
export function guardrailsSaveError(err: { code?: string; message?: string; status?: number } | null | undefined): string {
  const generic = "We couldn't save your guardrails. Check them and try again — if it keeps happening, contact support.";
  // ★What the merchant can DO depends on what failed (review R3): checking
  //  their rules cannot fix a lapsed session, a missing permission or no
  //  network.
  if (!err) return "We couldn't reach Peakhour. Check your connection, then save again.";
  if (err.status === 401) return "Your session has ended. Sign in again, then save your guardrails.";
  if (err.status === 403) return "You don't have access to change this business's guardrails. Ask an owner or admin.";
  if (err.code !== "VALIDATION_ERROR" || !err.message) return generic;
  // ★The api's request-shape refusals are not merchant sentences (R2).
  if (err.message === "Invalid body" || err.message === "Invalid JSON body") return generic;
  // ★Nor is "Send timeZone." — say what to DO in this form instead (R2).
  if (/Send timeZone\.?$/.test(err.message)) {
    return "Quiet hours and blackout dates need a time zone, and we couldn't work out your business's. Choose one in the Time zone field.";
  }
  return err.message;
}
