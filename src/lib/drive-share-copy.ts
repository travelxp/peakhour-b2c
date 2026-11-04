/**
 * The words about share-link visitor data (owner decision 2026-11-04). ONE PLACE, and the number is always an argument that came from
 * the api (`cfg_drive_settings.shareVisitorRetentionDays`, which the CMS can change): nothing here may hold a literal day count, and a
 * test reads this file to prove it.
 */

/** "1 day" / "90 days". */
export function daysText(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}

/** The customer's share dialog, beside the expiry and password fields. */
export function shareDialogNotice(retentionDays: number): string {
  return `When someone opens this link, we keep their IP address and device for ${daysText(retentionDays)} so you can spot a leak.`;
}

/** The visitor's page, before they open the file or enter a password. */
export function visitorNotice(retentionDays: number): string {
  return `Opening this link records your IP address and device. We keep these for ${daysText(retentionDays)}.`;
}

/** In a link's "Opened by" list, once the address and device are gone. */
export function detailsRemovedText(retentionDays: number): string {
  return `Details removed after ${daysText(retentionDays)}`;
}

export const NOT_OPENED_YET = "Not opened yet.";

/** "12 Nov 2026, 3:04 pm" in the reader's own zone and language: the time a visitor opened a link is the customer's to read in their day. */
export function openedAtText(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown time";
  return d.toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** How long a locked link asks the visitor to wait: the api locks for a fixed time and says so in words, not a number. */
export const LOCKED_TEXT = "Too many wrong passwords. Please try again in a few minutes.";
export const GONE_TEXT = "This link does not exist or has expired.";
export const ERROR_TEXT = "This file is not available right now. Please try again in a moment.";
