import type { FetchIssue, TrustedSource } from "../types";

/** Short, plain-English "since" label: "since 12 May" (same year) or "since 12 May 2025". */
export function sinceLabel(iso: string | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" };
  return `since ${d.toLocaleDateString("en-GB", opts)}`;
}

/** The problem line for a source we cannot read: what failed, and since when. */
export function problemLine(issue: FetchIssue, now?: Date): string {
  const since = sinceLabel(issue.firstSeenAt, now);
  const msg = issue.message.replace(/[.\s]+$/, "");
  return since ? `We can't read this source: ${msg} (${since})` : `We can't read this source: ${msg}`;
}

/** True when we paused the source because we could not reach it. */
export function isPausedForFetch(source: Pick<TrustedSource, "status" | "inactiveReason">): boolean {
  return source.status === "inactive" && source.inactiveReason === "fetch_failing";
}
