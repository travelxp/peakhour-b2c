/**
 * The editor dialog builds the event it saves from its own form fields. PE-08
 * gave a seasonal event four fields the dialog has no control for (type,
 * region, closureLikely, source): they come from the platform pack, and
 * nothing merchant-facing was added in that row. A dialog that rebuilds the
 * event from name, month, relevance, dates and status alone would therefore
 * erase them the first time an owner changes, say, a relevance note, with no
 * error and nothing to see.
 *
 * So the editor starts from the event it was opened on and carries these four
 * through untouched. (An event added from scratch has none.)
 */

export type SeasonalEventType = "public_holiday" | "festival" | "commercial";

export interface HolidayFields {
  /** What kind of day this is. Absent === not classified. */
  type?: SeasonalEventType;
  /** ISO 3166-2 code ("GB-SCT"); absent === the whole country. */
  region?: string;
  /** Businesses commonly close. Absent === not asserted; false is a statement. */
  closureLikely?: boolean;
  /** A URL that supports the row. */
  source?: string;
}

/** The fields this dialog has a control for; it rebuilds exactly these from the form. */
const FORM_FIELDS = new Set(["name", "month", "relevance", "dates", "status"]);

/**
 * Carry through every field of the opened event that the form does not control,
 * not just the four PE-08 named: a field added to the pack later is kept too,
 * instead of being erased by a dialog that predates it.
 */
export function withHolidayFields<T extends object>(wire: T, initial: HolidayFields | null): T & HolidayFields {
  const out: Record<string, unknown> = { ...(wire as object) };
  for (const [k, v] of Object.entries(initial ?? {})) {
    if (!FORM_FIELDS.has(k) && v !== undefined) out[k] = v;
  }
  return out as T & HolidayFields;
}
