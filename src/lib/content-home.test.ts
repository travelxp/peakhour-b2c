import { describe, expect, it } from "vitest";
import type { RailItem } from "@/hooks/use-home-summary";
import type { ScheduledItemDto } from "@/lib/scheduler/types";
import {
  COMING_UP_DAYS,
  COMING_UP_GRACE_MS,
  COMPOSE_HREF,
  HOME_NEEDS_OK_LIMIT,
  comingUp,
  contentNeedsOk,
  draftsLine,
} from "./content-home";

const rail = (over: Partial<RailItem>): RailItem => ({
  type: "approve",
  channel: "linkedin",
  refId: "r1",
  title: "A post",
  ctaHref: "/dashboard/calendar",
  pillar: "content",
  ...over,
});

const item = (id: string, status: ScheduledItemDto["status"], at: string): ScheduledItemDto =>
  ({
    _id: id,
    orgId: "o",
    businessId: "b",
    planId: "p",
    channel: "linkedin",
    connectionId: "c",
    status,
    scheduledAtUtc: at,
    audienceTimezone: "UTC",
    payload: { text: id, snapshotAt: at, version: 1 },
    attemptsCount: 0,
    payloadStale: false,
    publishViaReminder: false,
    priority: "normal",
    createdAt: at,
  }) as ScheduledItemDto;

describe("contentNeedsOk", () => {
  it("keeps only content rows, in the api's order, and shows the first three", () => {
    const needsYou = [
      rail({ refId: "g1", pillar: "growth" }),
      rail({ refId: "c1" }),
      rail({ refId: "s1", pillar: "support" }),
      rail({ refId: "c2", type: "failed" }),
      rail({ refId: "c3" }),
      rail({ refId: "c4" }),
    ];
    const r = contentNeedsOk({ needsYou, kpis: { publishedThisWeek: 0, needsYou: 6, scheduledUpcoming: 0 } });
    expect(r.count).toBe(4);
    expect(r.top.map((i) => i.refId)).toEqual(["c1", "c2", "c3"]);
    expect(r.top).toHaveLength(HOME_NEEDS_OK_LIMIT);
    expect(r.mayBeMore).toBe(false);
  });

  it("says the count may be a floor when the summary's list was capped", () => {
    const needsYou = [rail({ refId: "c1" })];
    const r = contentNeedsOk({ needsYou, kpis: { publishedThisWeek: 0, needsYou: 11, scheduledUpcoming: 0 } });
    expect(r.mayBeMore).toBe(true);
  });

  it("is empty when nothing is waiting", () => {
    const r = contentNeedsOk({ needsYou: [], kpis: { publishedThisWeek: 0, needsYou: 0, scheduledUpcoming: 0 } });
    expect(r).toEqual({ top: [], count: 0, mayBeMore: false });
  });
});

describe("comingUp", () => {
  const now = new Date("2026-11-21T12:00:00Z");

  it("keeps posts still going out inside seven days, soonest first", () => {
    const out = comingUp(
      [
        item("late", "queued", "2026-11-27T10:00:00Z"),
        item("soon", "ready", "2026-11-21T13:00:00Z"),
        item("retry", "awaiting_retry", "2026-11-22T09:00:00Z"),
        item("flying", "in_flight", "2026-11-21T12:30:00Z"),
      ],
      now,
    );
    expect(out.map((i) => i._id)).toEqual(["flying", "soon", "retry", "late"]);
  });

  it("drops published, failed, cancelled, skipped and needs-action posts", () => {
    const at = "2026-11-22T09:00:00Z";
    const out = comingUp(
      (["published", "failed", "cancelled", "skipped", "needs_action"] as const).map((s) => item(s, s, at)),
      now,
    );
    expect(out).toEqual([]);
  });

  it("keeps a post just overdue that is still going out, and drops one overdue past the grace", () => {
    const grace = new Date(now.getTime() - COMING_UP_GRACE_MS);
    const out = comingUp(
      [
        item("just-overdue", "in_flight", new Date(grace.getTime() + 1000).toISOString()),
        item("long-overdue", "queued", new Date(grace.getTime() - 1000).toISOString()),
      ],
      now,
    );
    expect(out.map((i) => i._id)).toEqual(["just-overdue"]);
  });

  it("drops anything past the window, and a bad date", () => {
    const edge = new Date(now.getTime() + COMING_UP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const out = comingUp(
      [
        item("past", "queued", "2026-11-20T11:59:59Z"),
        item("edge", "queued", edge),
        item("bad", "queued", "not a date"),
        item("now", "queued", now.toISOString()),
      ],
      now,
    );
    expect(out.map((i) => i._id)).toEqual(["now"]);
  });
});

describe("draftsLine", () => {
  it("says none only when the summary loaded and held nothing", () => {
    expect(draftsLine({ top: [], count: 0, mayBeMore: false })).toBe("No drafts are waiting for you.");
  });

  it("does not say none when the summary failed, or was capped before the content rows", () => {
    expect(draftsLine(undefined)).not.toMatch(/No drafts/);
    expect(draftsLine({ top: [], count: 0, mayBeMore: true })).not.toMatch(/No drafts/);
  });

  it("counts, as a floor when the list was capped", () => {
    expect(draftsLine({ top: [], count: 1, mayBeMore: false })).toBe("1 item is waiting for your OK.");
    expect(draftsLine({ top: [], count: 3, mayBeMore: true })).toBe("At least 3 items are waiting for your OK.");
  });
});

describe("COMPOSE_HREF", () => {
  it("is the address the Calendar page opens its Compose sheet on", () => {
    expect(COMPOSE_HREF).toBe("/dashboard/calendar?compose=1");
  });
});
