import type { RateCardUseCase } from "@/hooks/use-credits";
import { formatPeaks } from "@/lib/pricing";

/**
 * The charge-by-charge record on the Peaks page: the words and shapes, kept out
 * of the component so they can be tested without a DOM. The rules (what counts
 * as a charge, how a refund shows) live in the api, `services/peaks/charge-ledger.ts`.
 */

export interface ChargeLine {
  /** The reference a refund and support quote. A refund line's is `refund:<the charge's>`. */
  id: string;
  /** ISO 8601, UTC. A refund line's is when it was given back. */
  at: string;
  task: string;
  /** Positive for a charge, NEGATIVE for credits given back (the ledger's own sign). */
  credits: number;
  /** A charge, or a separate line for the credits given back against one. */
  kind: "charge" | "refund";
  /** `refunded` marks the original charge, which stays in the record; a refund line is `refund`. */
  status: "charged" | "refunded" | "refund";
  refund?: { at: string; reason: string; automatic: boolean };
  /** On a refund line: the charge it is for (`at` is that charge's time, when known). */
  refundOf?: { id: string; at: string | null };
  reason?: string;
  automatic?: boolean;
}

export interface ChargePage {
  charges: ChargeLine[];
  next: string | null;
}

/** "4 Nov 2026, 15:32". The locale is pinned: a host locale would print the same charge two ways on two screens. */
export function chargeWhen(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // UTC unless a zone is named, and said so: the downloaded file is UTC, and one charge must read the same on screen and in it.
  const text = d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timeZone ?? "UTC" });
  return timeZone ? text : `${text} UTC`;
}

/**
 * What the Status column says. A refunded charge says why, in the words it was given back with; a refund line
 * says which charge it is for, when that is known, and why.
 */
export function chargeStatusText(line: Pick<ChargeLine, "status" | "refund" | "refundOf" | "reason" | "automatic">, timeZone?: string): string {
  if (line.status === "refund") {
    const forWhat = line.refundOf?.at ? ` for the charge of ${chargeWhen(line.refundOf.at, timeZone)}` : " for an earlier charge";
    const why = line.reason ? `: ${line.reason}` : "";
    return `Given back${line.automatic ? " automatically" : ""}${forWhat}${why}`;
  }
  if (line.status !== "refunded") return "Charged";
  const why = line.refund?.reason ? `: ${line.refund.reason}` : "";
  return `${line.refund?.automatic ? "Refunded automatically" : "Refunded"}${why}`;
}

/** The amount column: a charge as a number, credits given back with a minus sign (grouping pinned, like every Peaks figure). */
export function chargeAmount(credits: number): string {
  if (typeof credits !== "number" || !Number.isFinite(credits)) return "";
  return credits < 0 ? `-${formatPeaks(-credits)}` : formatPeaks(credits);
}

/** "1 charge" / "25 charges", and "and 2 refunds" when there are any, for the count under the table. */
export function chargeCount(charges: number, refunds = 0): string {
  const c = `${charges.toLocaleString("en-GB")} ${charges === 1 ? "charge" : "charges"}`;
  return refunds > 0 ? `${c} and ${refunds.toLocaleString("en-GB")} ${refunds === 1 ? "refund" : "refunds"}` : c;
}

/** The file the browser saves. */
export const CHARGES_CSV_PATH = "/v1/dashboard/credits/charges.csv";

/**
 * What a reply to a shopper costs, for the paragraph that explains charges nobody pressed a button for.
 *
 * Read off the rate card (`commerce.assistant`, the one storefront reply rate); `null` when the card has no such row,
 * and then the paragraph does not state a number it does not have.
 */
export function shopperReplyPeaks(rows: readonly Pick<RateCardUseCase, "useCase" | "free" | "creditMultiplier">[] | undefined): number | null {
  const row = rows?.find((r) => r.useCase === "commerce.assistant");
  if (!row || row.free || !(row.creditMultiplier > 0)) return null;
  return row.creditMultiplier;
}

export function shopperChargesCopy(peaks: number | null): { heading: string; body: string; control: string } {
  return {
    heading: "Charges from shoppers",
    body:
      peaks === null
        ? "When a shopper chats with your assistant, each reply it sends uses Peaks. This happens when the shopper writes, not when you press a button, so it cannot be shown before it happens."
        : `When a shopper chats with your assistant, each reply it sends uses ${formatPeaks(peaks)} Peaks. This happens when the shopper writes, not when you press a button, so it cannot be shown before it happens.`,
    control: "Every reply is listed in the record below. The assistant stops answering by itself when your Peaks run out, or when shopper chats reach the limit you set on this page. To stop them sooner, turn the storefront assistant off on your site. On a Shopify store, that is in the theme editor.",
  };
}
