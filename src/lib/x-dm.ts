/**
 * X messages (Inbox lane I3g): the X panel's data and wording.
 * The api is `GET /v1/x/dm/status` (a 404 while the platform switch is off: the panel then renders NOTHING),
 * `POST /v1/x/dm/enable`, `POST /v1/x/dm/disable` and `PUT /v1/x/dm/cap`.
 */

export type XDmState = "off" | "on" | "cap_reached" | "needs_reconnect" | "unavailable";

export interface XDmStatus {
  connected: boolean;
  connectionId: string | null;
  state: XDmState;
  /** AI credits per X message, from the rate card. Null: no price is set, so the switch cannot be turned on. */
  pricePerMessage: number | null;
  monthlyCap: number;
  usedThisMonth: number;
  /** When a reached limit resets (ISO). */
  resumesAt: string | null;
}

export const X_DM_CAP_MIN = 1;
export const X_DM_CAP_MAX = 100_000;

export const X_DM_COPY = {
  title: "X messages",
  intro: "Peakhour answers people who send your X account a direct message, hands the chat to your team when it should, and shows every conversation in your Inbox.",
  on: "On",
  off: "Off",
  turnOn: "Turn on X messages",
  turnOff: "Turn off",
  grant: "Grant message access",
  grantWhy: "Peakhour needs permission to read and send direct messages on your X account. X will ask you to approve it.",
  connectFirst: "Connect your X account first, then come back here to turn on X messages.",
  noPrice: "X messages cannot be turned on yet because their price is not set.",
  saveLimit: "Save limit",
  limitLabel: "Most X messages a month",
  zeroCredits: "When your AI credits run out, Peakhour stops answering X messages and they wait in your Inbox marked Needs you.",
} as const;

/** "Each X message uses 5 AI credits." The number is the rate card's, never typed here. */
export function priceLine(price: number | null): string | null {
  if (price === null) return null;
  return `Each X message uses ${price} AI credit${price === 1 ? "" : "s"}. A customer's message and each reply (yours or Peakhour's) are one each.`;
}

export const usageLine = (s: Pick<XDmStatus, "usedThisMonth" | "monthlyCap">): string =>
  `${s.usedThisMonth.toLocaleString("en-US")} of ${s.monthlyCap.toLocaleString("en-US")} X messages used this month.`;

/** The banner for a reached limit, naming the date it starts again. */
export function capReachedLine(s: Pick<XDmStatus, "monthlyCap" | "resumesAt">): string {
  const at = s.resumesAt ? new Date(s.resumesAt) : null;
  // an unreadable date reads as the plain fallback, never "Invalid Date"
  const when = at && !Number.isNaN(at.getTime()) ? at.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "the start of next month";
  return `You reached your limit of ${s.monthlyCap.toLocaleString("en-US")} X messages this month, so Peakhour has stopped reading them. It starts again on ${when}. Raise the limit to carry on now.`;
}

/** A whole number from 1 to 100,000, or null. */
export function parseCap(raw: string): number | null {
  const t = raw.trim();
  // commas are thousands separators only: "1,500" is 1500, but "1,00" or "1,5" is a typo and is refused, not saved as another number
  if (!/^(?:[0-9]{1,6}|[0-9]{1,3}(?:,[0-9]{3})+)$/.test(t)) return null;
  const n = Number(t.replace(/,/g, ""));
  return n >= X_DM_CAP_MIN && n <= X_DM_CAP_MAX ? n : null;
}

export const CAP_RANGE_ERROR = `Enter a whole number from ${X_DM_CAP_MIN} to ${X_DM_CAP_MAX.toLocaleString("en-US")}.`;

export const REFRESH_FAILED = "Your change was saved, but this page could not refresh. Reload it to see the current state.";
export const LOAD_FAILED = "X messages could not be loaded.";

/** Only a 404 means "not released": any other failure to read the status is a failure, not an absence. */
export const isNotReleased = (err: unknown): boolean => (err as { status?: unknown } | null)?.status === 404;

/** The api's own sentence when it sent one, else a next step: never a bare code. */
export function xDmErrorMessage(err: unknown): string {
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" && m.trim() ? m : "That did not work. Check your connection and try again.";
}
