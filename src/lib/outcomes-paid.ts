import type { OutcomesResponse, PaidChannel } from "@/lib/api/growth";
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
  const channels = paid.byChannel ?? [];
  if (paid.spend !== null && paid.currency) {
    parts.push(`${paid.currency} ${NUM.format(Math.round(paid.spend))} spent`);
  } else {
    // ★ONE PARTITION, OVER THE CHANNELS THAT MOVED — the api's own rule
    // (\`totalPaid\`). A stale channel that neither served nor spent carries a
    // bookkept 0; listing it printed "Meta ads EUR 0", a zero nobody measured.
    // An unknown spend may not be zero, so it stays and is "the rest".
    const moving = channels.filter((ch) => ch.impressions > 0 || ch.spend === null || ch.spend > 0);
    const totalled: Array<PaidChannel & { spend: number; currency: string }> = [];
    let rest = false;
    for (const ch of moving) {
      // ★BOTH FIELDS, ON PURPOSE: the api pairs them, but the repos deploy
      // apart, and a currency beside no amount must never print as one.
      if (ch.spend !== null && ch.currency) totalled.push({ ...ch, spend: ch.spend, currency: ch.currency });
      else rest = true;
    }
    const per = totalled.map(
      (ch) => `${paidFigureLabel(ch.platform)} ${ch.currency} ${NUM.format(Math.round(ch.spend))}`,
    );
    parts.push(
      per.length > 0
        ? `spent ${per.join(", ")}${rest ? " (the rest couldn't be totalled)" : ""}`
        : "spend couldn't be totalled in one currency",
    );
  }
  if (channels.some((ch) => ch.stale)) {
    parts.push("some ad figures stopped updating");
  }
  return parts.join(" · ");
}
