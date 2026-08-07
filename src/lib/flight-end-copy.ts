/**
 * What the "should have stopped, and has not" banner is allowed to say.
 *
 * WHY THIS FILE EXISTS: the first cut of that banner put ONE sentence above the
 * list — "We could not stop them on LinkedIn, so they may still be spending" —
 * and the api's flag does not support it. `flightEndAlarm` is derived from two
 * facts, `status === "active"` and `endsAt` in the past. That is ALSO what a
 * campaign looks like when:
 *
 *   - the hourly sweep simply has not reached it yet (its grace period covers
 *     the ordinary gap, but a truncated sweep runs behind it), and forever on
 *     dev, where crons do not run at all;
 *   - the platform stop SUCCEEDED and only our local row write failed. The api
 *     logs that case verbatim as "Spend has stopped; our record of it has not."
 *     Telling that customer their campaign is still spending, and sending them
 *     to Campaign Manager to stop an already-stopped campaign, is a false
 *     statement about money on the surface built to stop us making them.
 *
 * ★SO THE HEADLINE MAKES THE WEAKEST CLAIM THAT COVERS EVERY ROW IN IT, and the
 * per-row detail carries the specific one. The only sentence permitted to say
 * "we could not stop it" is one about a campaign where a stop was attempted and
 * failed — which is exactly when the api sends `reason`.
 *
 * Pure so it can be tested without rendering, which is this repo's convention
 * for anything whose wording matters (see `ads-copy.ts`).
 */

/** The shape this module needs off a campaign row. */
export interface FlightEndRow {
  _id: string;
  name?: string;
  flightEndAlarm?: {
    pastEnd: true;
    endsAt: string;
    checkedSinceEnd: boolean;
    reason?: string;
  };
}

/**
 * Which of the three states a row is in.
 *
 * ★THE THREE STAY DISTINCT. "We asked and could not stop it", "nobody has
 * asked yet" and "we asked and found nothing wrong" are three different things
 * with three different remedies, and collapsing any two of them is how a
 * customer is told to go and fix something that is not broken.
 */
export type FlightEndState = "stop_failed" | "not_checked" | "no_failure_recorded";

export function flightEndState(alarm: FlightEndRow["flightEndAlarm"]): FlightEndState {
  if (alarm?.reason) return "stop_failed";
  return alarm?.checkedSinceEnd ? "no_failure_recorded" : "not_checked";
}

/** "4 days", "6 hours", or null when it is neither yet or unreadable. */
export function elapsedSince(iso: string | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  // A future end date floors to a negative hour count, so the `< 1` guard below
  // already covers it — no separate sign check, which would be a line no test
  // could ever fail.
  const hours = Math.floor((now - t) / 3_600_000);
  if (hours < 1) return null;
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * One row's sentence.
 *
 * `reason` is an api-authored sentence and may already end in a full stop, so
 * it is joined without adding a second one — ".." in an alert reads as a bug in
 * the alert.
 */
export function flightEndDetail(
  alarm: NonNullable<FlightEndRow["flightEndAlarm"]>,
  formattedDate: string,
  now = Date.now(),
): string {
  const ago = elapsedSince(alarm.endsAt, now);
  const ended = formattedDate
    ? `ended ${formattedDate}${ago ? ` (${ago} ago)` : ""}`
    : "past its end date";
  switch (flightEndState(alarm)) {
    case "stop_failed": {
      const reason = alarm.reason!.trim();
      return `${ended}. We could not stop it: ${reason}${reason.endsWith(".") ? "" : "."}`;
    }
    case "not_checked":
      // ★NO CLAIM ABOUT WHETHER IT IS SPENDING. Nothing has looked at it since
      // it ended, so whether LinkedIn is still serving it is exactly what we do
      // not know — and "we cannot tell" is its own answer, not a softer way of
      // saying we failed.
      return `${ended}. We have not checked it since, so we cannot tell whether it is still running.`;
    case "no_failure_recorded":
      return `${ended}. We have not recorded stopping it, and no failure either — it may already be stopped on LinkedIn.`;
  }
}

/**
 * The banner as a whole, or null when there is nothing to say.
 *
 * The headline is chosen by what is true of EVERY row listed: only when every
 * one of them carries a recorded stop failure may it say we could not stop
 * them. Otherwise it says what all of them have in common — past their end
 * date, and our record still shows them running — and lets the rows explain
 * themselves.
 */
export function flightEndBanner(
  rows: FlightEndRow[],
  now = Date.now(),
): { headline: string; body: string; hedgeApplies: boolean; count: number } | null {
  const pastEnd = rows.filter((r) => r.flightEndAlarm?.pastEnd);
  if (pastEnd.length === 0) return null;
  const one = pastEnd.length === 1;
  const allFailed = pastEnd.every((r) => flightEndState(r.flightEndAlarm) === "stop_failed");

  const headline = allFailed
    ? one
      ? "A campaign passed its end date and we could not stop it"
      : `${pastEnd.length} campaigns passed their end date and we could not stop them`
    : one
      ? "A campaign passed its end date and our record still shows it running"
      : `${pastEnd.length} campaigns passed their end date and our records still show them running`;

  // ★THE HEDGE IS EARNED, NOT INHERITED. The spend banner says "the controls
  // here use the same connection, so if that is what failed they will fail
  // again" — which is true there, because that alarm implies a stop was
  // attempted and failed. Here it usually was not, and in that case the row's
  // own Pause button works in one click. Telling the customer it will not is
  // steering them away from the fix.
  const body = allFailed
    ? `LinkedIn was not given an end date, so nothing else will stop ${one ? "it" : "them"}. ` +
      `Stop ${one ? "it" : "them"} in LinkedIn Campaign Manager — the controls here use the same ` +
      `connection, so if that is what failed they will fail again.`
    : `LinkedIn is never given an end date for these campaigns, so our own stop is the only one ` +
      `there is. Use Pause on the row below, or stop ${one ? "it" : "them"} in LinkedIn Campaign ` +
      `Manager.`;

  return { headline, body, hedgeApplies: allFailed, count: pastEnd.length };
}
