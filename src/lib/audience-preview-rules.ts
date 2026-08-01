/**
 * Parsing the one input the audience preview asks for.
 *
 * ★AN EMPTY RESULT IS A STATEMENT, NOT A MISSING ANSWER. The api distinguishes
 * an ABSENT `geo` ("use what the profile says") from an EMPTY one ("none of
 * these"), and treating a cleared box as absent would hand the user back the
 * guess they had just rejected — the same explicitly-empty rule the proposer
 * applies server-side. So this always returns an array.
 */
/** What both `/propose` and `/boost` accept. The proposer may use FEWER — its
 *  own cap comes from the capability registry and is editable at runtime — so
 *  it reports the overflow rather than this pretending to know. */
export const MAX_COUNTRIES = 25;

export function parseCountryCodes(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,\s]+/)) {
    const code = raw.trim().toUpperCase();
    // Two letters or nothing. The api rejects anything else, and refusing here
    // means the user does not learn that from a 400.
    if (!/^[A-Z]{2}$/.test(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  // Truncation here is a LAST RESORT, not the user-facing rule: the editor
  // blocks and says so before it can happen, because silently dropping the
  // 26th country is the same quiet narrowing this whole screen exists to
  // prevent.
  return out.slice(0, MAX_COUNTRIES);
}

/** What the user typed that we could not use — so the box can say so rather
 *  than silently dropping half of it. */
export function unusableCountryTokens(input: string): string[] {
  return input
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !/^[A-Za-z]{2}$/.test(t));
}
