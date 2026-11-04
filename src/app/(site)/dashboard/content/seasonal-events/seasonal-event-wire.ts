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

export function withHolidayFields<T extends object>(wire: T, initial: HolidayFields | null): T & HolidayFields {
  const out: T & HolidayFields = { ...wire };
  if (initial?.type !== undefined) out.type = initial.type;
  if (initial?.region !== undefined) out.region = initial.region;
  if (initial?.closureLikely !== undefined) out.closureLikely = initial.closureLikely;
  if (initial?.source !== undefined) out.source = initial.source;
  return out;
}
