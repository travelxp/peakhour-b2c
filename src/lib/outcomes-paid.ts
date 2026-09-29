import type { OutcomesResponse } from "@/lib/api/growth";
import { paidFigureLabel } from "@/lib/visibility-funnel";

const NUM = new Intl.NumberFormat("en-US");

type Paid = NonNullable<OutcomesResponse["reach"]["paid"]>;

/**
 * The note under "Saw your ads", decided once.
 *
 * ★★A NULL SPEND IS A REFUSAL, AND ITS SENTENCE MUST NOT GUESS WHY. The api
 * (D-01) refuses a total when the channels disagree on a currency AND when a
 * campaign carries none at all — so "spend is in more than one currency" was
 * false for a single legacy campaign with no currency. What IS known is shown
 * instead: every channel that could total its own spend, in its own currency.
 *
 * ★★AND ONLY \`null\` IS A REFUSAL. This build merges before the api that sends
 * \`null\`: the api it meets first sends a NUMBER with no currency, which it did
 * total — and reading that as a refusal told a merchant their spend "couldn't
 * be totalled". That shape says nothing about spend, as it always did.
 *
 * ★WHICH CHANNELS COUNT IS THE api'S DECISION (\`PaidChannel.moved\`), not this
 * file's: a copy of the rule here would drift from the total it explains.
 */
export function paidNote(paid: Paid): string {
  const parts = [`${paid.campaigns} campaign${paid.campaigns === 1 ? "" : "s"}`];
  const channels = paid.byChannel ?? [];
  if (paid.spend !== null && paid.currency) {
    parts.push(`${paid.currency} ${NUM.format(Math.round(paid.spend))} spent`);
  } else if (paid.spend === null) {
    const per: string[] = [];
    let rest = false;
    for (const ch of channels) {
      // An api predating \`moved\` sends none; every channel then counts.
      if (ch.moved === false) continue;
      // ★BOTH FIELDS, ON PURPOSE: the api pairs them, but the repos deploy
      // apart, and a currency beside no amount must never print as one.
      if (ch.spend !== null && ch.currency) {
        per.push(`${paidFigureLabel(ch.platform)} ${ch.currency} ${NUM.format(Math.round(ch.spend))}`);
      } else {
        rest = true;
      }
    }
    parts.push(
      per.length > 0
        ? `spent ${per.join(", ")}${rest ? " (the rest couldn't be totalled)" : ""}`
        : "spend couldn't be totalled",
    );
  }
  const stale = paidStaleNote(paid);
  if (stale) parts.push(stale);
  return parts.join(" · ");
}

/**
 * The stale suffix, for BOTH paid figures. Clicks come from the same channels
 * as impressions and shrink the same way; flagging one and not the other made
 * them read as different kinds of measurement.
 */
export function paidStaleNote(paid: Paid | null): string | null {
  return (paid?.byChannel ?? []).some((ch) => ch.stale) ? "some ad figures stopped updating" : null;
}
