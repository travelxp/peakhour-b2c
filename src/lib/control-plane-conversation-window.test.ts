import { describe, expect, it } from "vitest";
import type { ConversationMessage } from "@/lib/api/control-plane";
import {
  anchorDayLabel,
  anchorKeyPart,
  apiPageParam,
  autoLoadDirection,
  CONVERSATION_RECENT_NOTE,
  conversationQuietWindowText,
  conversationView,
  dayKeyIn,
  fetchConversationEntry,
  initialConversationParam,
  isDayKey,
  latestAnchor,
  sentinelInView,
  isJumpableDay,
  newerConversationParam,
  nextDayKey,
  olderConversationParam,
  RECENT_DAYS,
  shouldFollowNewest,
  windowPlacement,
  zonedDayStart,
  type ConversationEntry,
} from "./control-plane-conversation";

/**
 * Owner answer 2026-10-21, item 20: the Conversation tab opens on the last 3
 * days, loads older history as the reader scrolls, and jumps to a date. Titles
 * carry an id ([W01]) so the mutation runner can select exactly one test.
 *
 * ★THE ZONES DEFEAT THE SHORTCUTS (memory: the host zone must defeat the
 * shortcut). The host here is Asia/Kolkata, so a day start computed in the
 * HOST's zone would pass a Kolkata case; every zone below is another one, and
 * they include UTC+14, a 23-hour and a 25-hour day, and a day whose midnight
 * does not exist.
 */

const msg = (text: string, sentAt: string): ConversationMessage => ({ sender: "merchant", text, sentAt });
const page = (
  messages: ConversationMessage[],
  over: { nextCursor?: string | null; newerCursor?: string | null; window?: boolean } = {},
): ConversationEntry => ({
  kind: "page",
  messages,
  nextCursor: over.nextCursor ?? null,
  newerCursor: over.newerCursor ?? null,
  window: over.window ?? false,
});
const iso = (ms: number) => new Date(ms).toISOString();
const HOUR = 60 * 60 * 1000;

describe("a calendar day in a zone", () => {
  it("[W01] a day key is a real YYYY-MM-DD date and nothing else", () => {
    expect(isDayKey("2026-10-12")).toBe(true);
    expect(isDayKey("2024-02-29")).toBe(true);
    for (const bad of ["2026-02-29", "2026-13-01", "2026-10-32", "2026-1-01", "2026-10-12T00:00", "", "12/10/2026"]) {
      expect(isDayKey(bad), bad).toBe(false);
    }
  });

  it("[W02] the start of a day is local midnight in the given zone, never the host's", () => {
    expect(iso(zonedDayStart("2026-10-12", "Pacific/Kiritimati"))).toBe("2026-10-11T10:00:00.000Z");
    expect(iso(zonedDayStart("2026-10-12", "Asia/Kathmandu"))).toBe("2026-10-11T18:15:00.000Z");
    expect(iso(zonedDayStart("2026-10-12", "Pacific/Pago_Pago"))).toBe("2026-10-12T11:00:00.000Z");
    expect(iso(zonedDayStart("2026-10-12", "UTC"))).toBe("2026-10-12T00:00:00.000Z");
  });

  it("[W03] a DST day is 23 or 25 hours long, from its own midnight", () => {
    const la = "America/Los_Angeles";
    expect(iso(zonedDayStart("2026-03-08", la))).toBe("2026-03-08T08:00:00.000Z");
    expect(zonedDayStart("2026-03-09", la) - zonedDayStart("2026-03-08", la)).toBe(23 * HOUR);
    expect(iso(zonedDayStart("2026-11-01", la))).toBe("2026-11-01T07:00:00.000Z");
    expect(zonedDayStart("2026-11-02", la) - zonedDayStart("2026-11-01", la)).toBe(25 * HOUR);
  });

  it("[W04] a day whose midnight does not exist starts at its first instant (Santiago, 01:00)", () => {
    // ★Chile springs forward at 24:00: 23:59:59 on the 5th is followed by
    //  01:00 on the 6th. "UTC midnight minus the offset" lands on the 5th.
    const z = "America/Santiago";
    expect(iso(zonedDayStart("2026-09-06", z))).toBe("2026-09-06T04:00:00.000Z");
    expect(dayKeyIn(zonedDayStart("2026-09-06", z) - 1, z)).toBe("2026-09-05");
    expect(dayKeyIn(zonedDayStart("2026-09-06", z), z)).toBe("2026-09-06");
  });

  it("[W05] the next day is by the calendar, across months, years and a leap day", () => {
    expect(nextDayKey("2026-10-31")).toBe("2026-11-01");
    expect(nextDayKey("2026-12-31")).toBe("2027-01-01");
    expect(nextDayKey("2028-02-28")).toBe("2028-02-29");
  });
});

describe("where the tab opens and what it asks the api for", () => {
  const NOW = Date.parse("2026-10-21T12:00:00.000Z");

  it("[W06] the latest window is the last 3 CALENDAR days in the zone, measured at fetch time", () => {
    expect(RECENT_DAYS).toBe(3);
    const z = "Pacific/Kiritimati";
    expect(initialConversationParam(latestAnchor(z))).toEqual({ kind: "recent", timeZone: z });
    // 12:00Z on the 21st is 02:00 on the 22nd at UTC+14: the 20th, 21st and 22nd.
    expect(apiPageParam({ kind: "recent", timeZone: z }, NOW)).toEqual({ kind: "window", since: "2026-10-19T10:00:00.000Z" });
    // ★Not 72 hours: an hour later is still the same three days.
    expect(apiPageParam({ kind: "recent", timeZone: z }, NOW + HOUR)).toEqual({ kind: "window", since: "2026-10-19T10:00:00.000Z" });
    // And at 23:59 local on the 22nd too; one minute later it moves a day.
    expect(apiPageParam({ kind: "recent", timeZone: z }, Date.parse("2026-10-22T09:59:00.000Z"))).toEqual({ kind: "window", since: "2026-10-19T10:00:00.000Z" });
    expect(apiPageParam({ kind: "recent", timeZone: z }, Date.parse("2026-10-22T10:00:00.000Z"))).toEqual({ kind: "window", since: "2026-10-20T10:00:00.000Z" });
  });

  it("[W27] the last 3 days across a 25-hour day start at the third day's own midnight", () => {
    // 04:00 PST on 2 Nov in LA: the 2nd, the 1st (25 hours) and 31 Oct (PDT).
    expect(apiPageParam({ kind: "recent", timeZone: "America/Los_Angeles" }, Date.parse("2026-11-02T12:00:00.000Z"))).toEqual({
      kind: "window",
      since: "2026-10-31T07:00:00.000Z",
    });
  });

  it("[W07] a jump asks for that whole day in its zone, half-open, whatever the clock says", () => {
    const anchor = { kind: "day" as const, day: "2026-11-01", timeZone: "America/Los_Angeles" };
    const param = initialConversationParam(anchor);
    expect(param).toEqual({ kind: "day", day: "2026-11-01", timeZone: "America/Los_Angeles" });
    const want = { kind: "window", since: "2026-11-01T07:00:00.000Z", until: "2026-11-02T08:00:00.000Z" };
    expect(apiPageParam(param, NOW)).toEqual(want);
    expect(apiPageParam(param, 0)).toEqual(want);
  });

  it("[W08] an older or newer step is passed to the api as it is", () => {
    expect(apiPageParam({ kind: "older", cursor: "1.0000000000000000" }, NOW)).toEqual({ kind: "older", cursor: "1.0000000000000000" });
    expect(apiPageParam({ kind: "newer", after: "2.0000000000000000" }, NOW)).toEqual({ kind: "newer", after: "2.0000000000000000" });
  });

  it("[W09] each day and zone is its own cache entry, and the latest is one entry", () => {
    expect(anchorKeyPart(latestAnchor("Asia/Kolkata"))).toBe("latest@Asia/Kolkata");
    expect(anchorKeyPart(latestAnchor("Asia/Kolkata"))).not.toBe(anchorKeyPart(latestAnchor("Europe/London")));
    // No zone yet: nothing is fetched under a key of its own.
    expect(anchorKeyPart(null)).toBe("pending");
    const a = anchorKeyPart({ kind: "day", day: "2026-10-12", timeZone: "Asia/Kolkata" });
    expect(a).toBe("day:2026-10-12@Asia/Kolkata");
    expect(a).not.toBe(anchorKeyPart({ kind: "day", day: "2026-10-13", timeZone: "Asia/Kolkata" }));
    expect(a).not.toBe(anchorKeyPart({ kind: "day", day: "2026-10-12", timeZone: "Europe/London" }));
  });

  it("[W10] the window page is marked, a step is not, and a missing newerCursor reads as none", async () => {
    const seen: unknown[] = [];
    const fetchPage = async (p: unknown) => {
      seen.push(p);
      return { messages: [], nextCursor: "1.0000000000000000" };
    };
    expect(await fetchConversationEntry(fetchPage, { kind: "recent", timeZone: "UTC" }, NOW)).toMatchObject({ window: true, newerCursor: null });
    expect(await fetchConversationEntry(fetchPage, { kind: "day", day: "2026-10-12", timeZone: "UTC" }, NOW)).toMatchObject({ window: true });
    expect(await fetchConversationEntry(fetchPage, { kind: "older", cursor: "1.0000000000000000" }, NOW)).toMatchObject({ window: false });
    expect(await fetchConversationEntry(fetchPage, { kind: "newer", after: "1.0000000000000000" }, NOW)).toMatchObject({ window: false });
    // ★The api is asked in instants, at the time given.
    expect(seen[0]).toEqual({ kind: "window", since: "2026-10-19T00:00:00.000Z" });
    expect(seen[1]).toEqual({ kind: "window", since: "2026-10-12T00:00:00.000Z", until: "2026-10-13T00:00:00.000Z" });
  });

  it("[W11] the newer page is asked with the FIRST page's newerCursor; none at the live end or after a refusal", () => {
    expect(newerConversationParam(page([], { newerCursor: "9.0000000000000000" }))).toEqual({ kind: "newer", after: "9.0000000000000000" });
    expect(newerConversationParam(page([]))).toBeNull();
    expect(newerConversationParam({ kind: "refused", reason: "forbidden" })).toBeNull();
    // The older step reads nextCursor only.
    expect(olderConversationParam(page([], { newerCursor: "9.0000000000000000" }))).toBeNull();
  });
});

describe("a quiet window is not an empty conversation", () => {
  const idle = { status: "success" as const, fetchStatus: "idle" as const };

  it("[W12] no messages in the window but older ones exist: the box opens", () => {
    expect(conversationView({ entries: [page([], { window: true, nextCursor: "1.0000000000000000" })], ...idle })).toEqual({
      kind: "messages",
      messages: [],
    });
  });

  it("[W13] no messages on a jumped-to day but newer ones exist: the box opens", () => {
    expect(conversationView({ entries: [page([], { window: true, newerCursor: "1.0000000000000000" })], ...idle })).toEqual({
      kind: "messages",
      messages: [],
    });
  });

  it("[W14] only the OUTER cursors count: an older cursor on a middle page does not make an empty list non-empty", () => {
    // [newest .. oldest]: the first page's newerCursor and the last page's nextCursor.
    const entries = [page([], { newerCursor: null, nextCursor: "x.0000000000000000" }), page([], { nextCursor: null, window: true })];
    expect(conversationView({ entries, ...idle })).toEqual({ kind: "empty" });
  });

  it("[W15] the quiet-window line names the window it opened on", () => {
    const both = { older: true, newer: true };
    expect(conversationQuietWindowText(latestAnchor("UTC"), null, both)).toBe(
      "No messages in the last 3 days. Older messages load as you scroll up.",
    );
    const day = { kind: "day" as const, day: "2026-10-12", timeZone: "Pacific/Kiritimati" };
    expect(conversationQuietWindowText(day, "Mon, 12 Oct 2026", both)).toBe(
      "No messages on Mon, 12 Oct 2026. Showing the nearest messages before and after it.",
    );
    expect(conversationQuietWindowText(day, null, both)).toContain("2026-10-12");
    expect(CONVERSATION_RECENT_NOTE).toBe("Showing the last 3 days first. Scroll up for older messages.");
  });

  it("[W16] a jumped-to day is labelled as that day in its own zone (UTC+14), in a pinned locale", () => {
    // ★Its start is 10:00 UTC on the 11th: labelled in UTC or the host's
    //  zone, it would read as the 11th.
    const label = anchorDayLabel({ kind: "day", day: "2026-10-12", timeZone: "Pacific/Kiritimati" }, "en-GB");
    // ICU versions differ on the comma after the weekday; the day may not.
    expect(label).toMatch(/^Mon,? 12 Oct 2026$/);
    expect(anchorDayLabel(latestAnchor("UTC"), "en-GB")).toBeNull();
  });
});

describe("where the opened window sits, and what loads next", () => {
  const a = msg("a", "2026-10-10T10:00:00.000Z");
  const b = msg("b", "2026-10-11T10:00:00.000Z");
  const c = msg("c", "2026-10-12T10:00:00.000Z");
  const d = msg("d", "2026-10-13T10:00:00.000Z");

  it("[W17] the window's first line is counted after every older page's lines", () => {
    // Cache order is newest page first: [newer, window, older].
    expect(windowPlacement([page([d]), page([b, c], { window: true }), page([a])])).toEqual({ index: 1, empty: false });
    expect(windowPlacement([page([b, c], { window: true })])).toEqual({ index: 0, empty: false });
  });

  it("[W18] a quiet window points at the nearest newer line", () => {
    expect(windowPlacement([page([c, d]), page([], { window: true }), page([a, b])])).toEqual({ index: 2, empty: true });
  });

  it("[W19] with no window page loaded there is no placement", () => {
    expect(windowPlacement([page([a]), { kind: "refused", reason: "forbidden" }])).toBeNull();
  });

  const base = {
    topVisible: false,
    bottomVisible: false,
    hasOlder: true,
    hasNewer: true,
    isFetching: false,
    olderFailed: false,
    newerFailed: false,
  };
  it("[W20] the top in view loads older; the bottom in view loads newer", () => {
    expect(autoLoadDirection({ ...base, topVisible: true })).toBe("older");
    expect(autoLoadDirection({ ...base, bottomVisible: true })).toBe("newer");
    expect(autoLoadDirection(base)).toBeNull();
  });

  it("[W21] nothing loads while anything is fetching (the fetches cancel each other)", () => {
    expect(autoLoadDirection({ ...base, topVisible: true, bottomVisible: true, isFetching: true })).toBeNull();
  });

  it("[W22] both ends in view: older first", () => {
    expect(autoLoadDirection({ ...base, topVisible: true, bottomVisible: true })).toBe("older");
  });

  it("[W23] an end with nothing more, or that failed, does not load; the other end still can", () => {
    expect(autoLoadDirection({ ...base, topVisible: true, hasOlder: false })).toBeNull();
    expect(autoLoadDirection({ ...base, topVisible: true, olderFailed: true })).toBeNull();
    expect(autoLoadDirection({ ...base, topVisible: true, bottomVisible: true, olderFailed: true })).toBe("newer");
    expect(autoLoadDirection({ ...base, bottomVisible: true, hasNewer: false })).toBeNull();
    expect(autoLoadDirection({ ...base, bottomVisible: true, newerFailed: true })).toBeNull();
  });

  it("[W24] a new newest line pulls the reader down only at the bottom of the live end", () => {
    expect(shouldFollowNewest(true, true)).toBe(true);
    // ★After a jump, a newer page landing below a reader at the bottom is not
    //  a message arriving.
    expect(shouldFollowNewest(true, false)).toBe(false);
    expect(shouldFollowNewest(false, true)).toBe(false);
  });
});

describe("review R1: a jumped-to day is placed by time, and a sentinel is measured", () => {
  const z = "Pacific/Kiritimati";
  const day = { kind: "day" as const, day: "2026-10-12", timeZone: z };
  // The 12th at UTC+14 is 2026-10-11T10:00Z .. 2026-10-12T10:00Z.
  const before = msg("before", "2026-10-11T09:59:59.999Z");
  const first = msg("first", "2026-10-11T10:00:00.000Z");
  const later = msg("later", "2026-10-12T09:00:00.000Z");
  const after = msg("after", "2026-10-12T10:00:00.000Z");

  it("[W25] after a refetch no page is the day's own, and the day is still placed by its bounds", () => {
    // ★No window flag anywhere: a refetch restarted from a newer page.
    const entries = [page([after]), page([first, later]), page([before])];
    expect(windowPlacement(entries, day)).toEqual({ index: 1, empty: false });
  });

  it("[W28] a quiet day is placed at the nearest newer line, or at the end when there is none", () => {
    expect(windowPlacement([page([after]), page([before])], day)).toEqual({ index: 1, empty: true });
    expect(windowPlacement([page([before])], day)).toEqual({ index: 1, empty: true });
    expect(windowPlacement([{ kind: "refused", reason: "forbidden" }], day)).toBeNull();
  });

  it("[W26] a sentinel is in view when its box overlaps the scroll box, widened by the margin", () => {
    const box = { top: 100, bottom: 500 };
    expect(sentinelInView({ top: 100, bottom: 101 }, box, 120)).toBe(true);
    expect(sentinelInView({ top: -20, bottom: -19 }, box, 120)).toBe(true);
    // Touching the widened edge counts.
    expect(sentinelInView({ top: -21, bottom: -20 }, box, 120)).toBe(true);
    expect(sentinelInView({ top: -22, bottom: -21 }, box, 120)).toBe(false);
    expect(sentinelInView({ top: 620, bottom: 621 }, box, 120)).toBe(true);
    expect(sentinelInView({ top: 621, bottom: 622 }, box, 120)).toBe(false);
  });
});

describe("review R2: honest sides, a jumpable day, a stable day start", () => {
  const day = { kind: "day" as const, day: "2026-10-12", timeZone: "UTC" };
  it("[W29] a quiet day names only the sides that have messages", () => {
    expect(conversationQuietWindowText(day, "D", { older: true, newer: false })).toBe("No messages on D. Showing the messages before it.");
    expect(conversationQuietWindowText(day, "D", { older: false, newer: true })).toBe("No messages on D. Showing the messages after it.");
    expect(conversationQuietWindowText(day, "D", { older: false, newer: false })).toBe("No messages on D.");
  });

  it("[W30] a day before 2000 is not jumpable (the api refuses it); 2000-01-01 is", () => {
    expect(isJumpableDay("1999-12-31")).toBe(false);
    expect(isJumpableDay("2000-01-01")).toBe(true);
    expect(isJumpableDay("2026-02-30")).toBe(false);
  });

  it("[W31] a memoised day start is the same answer, per day and per zone", () => {
    const a = zonedDayStart("2026-10-12", "Asia/Kathmandu");
    expect(zonedDayStart("2026-10-12", "Asia/Kathmandu")).toBe(a);
    expect(zonedDayStart("2026-10-12", "Pacific/Kiritimati")).not.toBe(a);
    expect(zonedDayStart("2026-10-13", "Asia/Kathmandu")).toBe(a + 24 * HOUR);
  });
});
