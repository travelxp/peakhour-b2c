import type { OutcomesResponse } from "@/lib/api/growth";
import { paidFigureLabel } from "@/lib/visibility-funnel";

const NUM = new Intl.NumberFormat("en-US");

/**
 * The note under "Saw your ads", decided once.
 *
 * ★★A NULL SPEND IS A REFUSAL, AND ITS SENTENCE MUST NOT GUESS WHY. The api
 * (D-01) refuses a total when the channels disagree on a currency AND when a
 * campaign carries none at all — so "spend is in more than one currency" was
 * false for a single legacy campaign with no currency. What IS known is shown
 * instead: every channel that could total its own spend, in its own currency.
 *
 * ★AND A CHANNEL THAT STOPPED UPDATING IS SAID, beside the figure it shrinks.
 * The funnel refuses to total a stage over a stale channel; this figure is
 * still a real number, but a smaller sample than the window it sits under, and
 * the site figure beside it already says the same thing about itself.
 */
export function paidNote(paid: NonNullable<OutcomesResponse["reach"]["paid"]>): string {
  const parts = [`${paid.campaigns} campaign${paid.campaigns === 1 ? "" : "s"}`];
  if (paid.spend !== null && paid.currency) {
    parts.push(`${paid.currency} ${NUM.format(Math.round(paid.spend))} spent`);
  } else {
    const per = (paid.byChannel ?? [])
      .filter((ch) => ch.spend !== null && ch.currency)
      .map((ch) => `${paidFigureLabel(ch.platform)} ${ch.currency} ${NUM.format(Math.round(ch.spend!))}`);
    // ★A PARTIAL LIST SAYS IT IS PARTIAL — naming two channels' spend and
    // omitting a third reads as the whole of it.
    const rest = (paid.byChannel ?? []).some((ch) => ch.spend === null || !ch.currency);
    parts.push(
      per.length > 0
        ? `spent ${per.join(", ")}${rest ? " (the rest couldn't be totalled)" : ""}`
        : "spend couldn't be totalled in one currency",
    );
  }
  if ((paid.byChannel ?? []).some((ch) => ch.stale)) {
    parts.push("some ad figures stopped updating");
  }
  return parts.join(" · ");
}
