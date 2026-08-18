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
  // ★TRIMMED IN THE PREDICATE, NOT ONLY IN THE RENDER. A first cut trimmed
  // where the string is printed and tested raw truthiness here, so a
  // whitespace-only reason counted as evidence of a failure and then rendered
  // as an empty clause — the exact hole the trim was added to close, left open
  // on the other side of it.
  if (alarm?.reason?.trim()) return "stop_failed";
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
  // ★CALENDAR DAYS IN UTC, MATCHING THE DATE PRINTED BESIDE IT. Flooring
  // elapsed hours while the date is a calendar day makes the two disagree:
  // ended 2026-08-04T23:00Z read at 2026-08-07T00:30Z is 49 hours — "2 days" —
  // next to "4 Aug 2026", which is three calendar days ago. Two numbers about
  // one fact, contradicting each other, in an alert.
  const utcDay = (ms: number) => Math.floor(ms / 86_400_000);
  const days = utcDay(now) - utcDay(t);
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
      // ★NO LEAD-IN OF OUR OWN. The api composes this string as "the platform
      // stop failed: <cause>", so prefixing it with "We could not stop it:"
      // produced two colons and said the same thing twice. The api owns the
      // sentence; this side owns the date.
      const reason = alarm.reason!.trim();
      const cap = reason.charAt(0).toUpperCase() + reason.slice(1);
      return `${ended}. ${cap}${cap.endsWith(".") ? "" : "."}`;
    }
    case "not_checked":
      // ★NO CLAIM ABOUT WHETHER IT IS SPENDING. Nothing has looked at it since
      // it ended, so whether LinkedIn is still serving it is exactly what we do
      // not know — and "we cannot tell" is its own answer, not a softer way of
      // saying we failed.
      return `${ended}. We have not checked it since, so we cannot tell whether it is still running.`;
    case "no_failure_recorded":
      // ★AND NO REASSURANCE EITHER. "It may already be stopped" is reachable
      // when it is false: `recordUnstoppableExpiry`'s own write has a catch, and
      // a legacy row that fails the collection's validator produces a campaign
      // that could NOT be stopped and has no entry saying so. Telling that
      // customer it is probably fine is round 1's defect inverted — a claim
      // stronger than the evidence, pointing the other way.
      return `${ended}. We have no record of stopping it, and none of failing to — check Campaign Manager.`;
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
  /**
   * Can the reader actually use the per-row Pause button? False above the
   * connection gate, where the banner is mounted and the campaigns table is
   * not — and a revoked connection is the state most likely to PRODUCE these
   * rows, so the disconnected reader is the likeliest one to be told to press
   * a button that is not on their screen.
   */
  canUseRowControls = true,
): {
  headline: string;
  body: string;
  rows: FlightEndRow[];
} | null {
  const pastEnd = rows.filter((r) => r.flightEndAlarm?.pastEnd === true);
  if (pastEnd.length === 0) return null;
  const one = pastEnd.length === 1;
  const it = one ? "it" : "them";
  const states = pastEnd.map((r) => flightEndState(r.flightEndAlarm));
  const allFailed = states.every((st) => st === "stop_failed");
  const anyFailed = states.some((st) => st === "stop_failed");

  const headline = allFailed
    ? one
      ? "A campaign passed its end date and we could not stop it"
      : `${pastEnd.length} campaigns passed their end date and we could not stop them`
    : one
      ? "A campaign passed its end date and our record still shows it running"
      : `${pastEnd.length} campaigns passed their end date and our records still show them running`;

  // ★THE REMEDY IS SCOPED TO WHAT IS TRUE OF EVERY ROW LISTED, WHICH IS WHY
  // "any" AND "all" ARE BOTH NEEDED.
  //
  // The hedge — "the controls here use the same connection, so if that is what
  // failed they will fail again" — is earned only where a stop actually failed.
  // A first cut applied it to all rows (round 1); its fix dropped it unless ALL
  // rows failed, which sent a reader with nine connection-refused campaigns and
  // one merely unchecked campaign to a Pause button guaranteed to fail on nine
  // of them. Anything failed => Campaign Manager, because that is the advice
  // that is safe for every row in the list.
  const noEnd =
    `LinkedIn is never given an end date for these campaigns, so our own stop is the only one ` +
    `there is.`;
  let body: string;
  if (anyFailed) {
    body =
      `${noEnd} Stop ${it} in LinkedIn Campaign Manager — the controls here use the same ` +
      `connection, so if that is what failed they will fail again.`;
  } else if (canUseRowControls) {
    body = `${noEnd} Use Pause on the row below, or stop ${it} in LinkedIn Campaign Manager.`;
  } else {
    body = `${noEnd} Stop ${it} in LinkedIn Campaign Manager.`;
  }

  // The rows come back rather than being re-filtered by the caller: two
  // independent filters that must agree by convention is how a count and a list
  // drift apart.
  return { headline, body, rows: pastEnd };
}
