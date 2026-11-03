import { describe, it, expect } from "vitest";
import {
  ASSIGNEE_FILTERS,
  NOTE_LABEL,
  NOTE_MAX,
  TAG_LIMIT,
  assigneeFilterFromParam,
  assigneeFor,
  awayPreview,
  canDeleteNote,
  canManageDesk,
  canPauseAssistant,
  canWorkConversation,
  createFlightGuard,
  deskListParams,
  formFromSettings,
  initialsOf,
  noteDraft,
  patchFromForm,
  pruneAvailable,
  formatMinutes,
  searchWithFilters,
  tagCountLine,
  tagFromParam,
  tagNameError,
  timelineOf,
  timerView,
  toggleAvailable,
  toggleTag,
  validateForm,
  type DeskNote,
  type DeskSettings,
  type ResponseTimer,
} from "@/lib/inbox-desk";

const SETTINGS: DeskSettings = {
  aiPaused: false,
  aiPausedAt: null,
  autoAssign: { enabled: false, availableUserIds: [] },
  firstResponseMinutes: 15,
  hours: null,
  awayMessage: null,
};

describe("who may do what", () => {
  it("assigning, noting and tagging is an editor's; a viewer and nobody cannot", () => {
    for (const r of ["owner", "admin", "editor"]) expect(canWorkConversation(r), r).toBe(true);
    for (const r of ["viewer", null, undefined, ""]) expect(canWorkConversation(r), String(r)).toBe(false);
  });
  it("settings, tags and the pause are an admin's", () => {
    for (const r of ["owner", "admin"]) {
      expect(canManageDesk(r), r).toBe(true);
      expect(canPauseAssistant(r), r).toBe(true);
    }
    for (const r of ["editor", "viewer", null, undefined]) {
      expect(canManageDesk(r), String(r)).toBe(false);
      expect(canPauseAssistant(r), String(r)).toBe(false);
    }
  });
  it("only the author deletes a note, and only if they can still write", () => {
    const note = { authorUserId: "u1" };
    expect(canDeleteNote(note, "u1", "editor")).toBe(true);
    expect(canDeleteNote(note, "u2", "owner")).toBe(false);
    expect(canDeleteNote(note, "u1", "viewer")).toBe(false);
    expect(canDeleteNote(note, null, "editor")).toBe(false);
  });
});

describe("the list filters build the right query", () => {
  it("All and no tag send nothing; Mine, Unassigned and a tag are named", () => {
    expect(deskListParams({ assignee: "all", tag: null })).toEqual({});
    expect(deskListParams({ assignee: "mine", tag: null })).toEqual({ assignee: "mine" });
    expect(deskListParams({ assignee: "unassigned", tag: "t1" })).toEqual({ assignee: "unassigned", tag: "t1" });
    expect(deskListParams({ assignee: "all", tag: "t1" })).toEqual({ tag: "t1" });
  });
  it("the three chips are All, Mine, Unassigned", () => {
    expect(ASSIGNEE_FILTERS.map((f) => f.label)).toEqual(["All", "Mine", "Unassigned"]);
  });
  it("a URL value is read back, and anything odd is All / no tag", () => {
    expect(assigneeFilterFromParam("mine")).toBe("mine");
    expect(assigneeFilterFromParam("unassigned")).toBe("unassigned");
    for (const v of ["assigned", "someone", "", null, undefined]) expect(assigneeFilterFromParam(v), String(v)).toBe("all");
    expect(tagFromParam("abc123")).toBe("abc123");
    for (const v of ["", " ", null, "a b", "x".repeat(65), "<script>"]) expect(tagFromParam(v), String(v)).toBeNull();
  });
  it("the page's query string keeps the tab and rewrites the filters (so a reload keeps both)", () => {
    expect(searchWithFilters("tab=conversations", { assignee: "mine", tag: "t1" })).toBe("tab=conversations&assignee=mine&tag=t1");
    expect(searchWithFilters("tab=conversations&assignee=mine&tag=t1", { assignee: "all", tag: null })).toBe("tab=conversations");
    expect(searchWithFilters("assignee=mine&thread=whatsapp%3Ax", { assignee: "unassigned", tag: null })).toBe("thread=whatsapp%3Ax&assignee=unassigned");
  });
});

describe("the first-reply timer", () => {
  const t = (over: Partial<ResponseTimer>): ResponseTimer => ({ state: "ok", elapsedMinutes: 4, targetMinutes: 15, paused: false, ...over });
  it("has nothing when the conversation has no timer", () => {
    expect(timerView(null)).toBeNull();
    expect(timerView(undefined)).toBeNull();
  });
  it("ok, amber and red each read differently and carry their own tone", () => {
    expect(timerView(t({}))).toMatchObject({ tone: "ok", label: "Waiting 4 min of 15 min" });
    expect(timerView(t({ state: "amber", elapsedMinutes: 9 }))).toMatchObject({ tone: "amber", label: "Reply soon: waiting 9 min of 15 min" });
    expect(timerView(t({ state: "red", elapsedMinutes: 20 }))).toMatchObject({ tone: "red", label: "Overdue: waiting 20 min (target 15 min)" });
    expect(timerView(t({ state: "amber" }))!.className).toContain("warning");
    expect(timerView(t({ state: "red" }))!.className).toContain("destructive");
  });
  it("paused says so in plain words, whatever the state was", () => {
    for (const state of ["ok", "amber", "red"] as const) {
      expect(timerView(t({ state, paused: true })), state).toMatchObject({ tone: "paused", label: "Paused until opening" });
    }
  });
  it("long waits read in hours", () => {
    expect(timerView(t({ state: "red", elapsedMinutes: 125, targetMinutes: 60 }))!.label).toBe("Overdue: waiting 2 h 5 min (target 1 h)");
  });
});

describe("assignee helpers", () => {
  it("initials: two letters at most, ? for no name", () => {
    expect(initialsOf("Ada Lovelace")).toBe("AL");
    expect(initialsOf("ada")).toBe("A");
    expect(initialsOf("Mary Ann Smith")).toBe("MS");
    expect(initialsOf("")).toBe("?");
    expect(initialsOf(null)).toBe("?");
  });
  it("the optimistic assignee: me, a teammate, nobody", () => {
    const team = [{ userId: "u1", name: "Ada", role: "editor" }, { userId: "u2", name: "Bo", role: "admin" }];
    expect(assigneeFor("me", "u1", team)).toEqual({ userId: "u1", name: "Ada" });
    expect(assigneeFor("u2", "u1", team)).toEqual({ userId: "u2", name: "Bo" });
    expect(assigneeFor(null, "u1", team)).toBeNull();
    expect(assigneeFor("me", null, team)).toBeNull();
    expect(assigneeFor("zz", "u1", team)).toEqual({ userId: "zz", name: "Teammate" });
  });
});

describe("notes", () => {
  it("the label is exact", () => {
    expect(NOTE_LABEL).toBe("Note — only your team sees this");
  });
  it("a note is saved when it has words, not while saving, and never past the limit", () => {
    expect(noteDraft("", false).canSave).toBe(false);
    expect(noteDraft("   ", false).canSave).toBe(false);
    expect(noteDraft("Call back Friday", false)).toMatchObject({ canSave: true, error: null });
    expect(noteDraft("Call back Friday", true).canSave).toBe(false);
    expect(noteDraft("x".repeat(NOTE_MAX), false)).toMatchObject({ canSave: true, remaining: 0 });
    const over = noteDraft("x".repeat(NOTE_MAX + 1), false);
    expect(over.canSave).toBe(false);
    expect(over.error).toContain("2000");
  });
  it("lays notes into the messages by time, keeping the messages' own order", () => {
    const msg = (id: string, timestamp: string | null) => ({ id, timestamp });
    const note = (id: string, createdAt: string): DeskNote => ({ id, body: id, authorUserId: "u", authorName: "A", createdAt });
    const out = timelineOf(
      [msg("m1", "2026-11-03T10:00:00Z"), msg("m2", "2026-11-03T10:10:00Z"), msg("m3", null), msg("m4", "2026-11-03T10:30:00Z")],
      [note("n2", "2026-11-03T10:20:00Z"), note("n1", "2026-11-03T10:05:00Z"), note("n3", "2026-11-03T11:00:00Z")],
    );
    expect(out.map((i) => (i.kind === "note" ? i.note.id : i.line.id))).toEqual(["m1", "n1", "m2", "m3", "n2", "m4", "n3"]);
  });
  it("no notes: the messages unchanged", () => {
    expect(timelineOf([{ timestamp: null }], []).map((i) => i.kind)).toEqual(["message"]);
  });
});

describe("tags", () => {
  const tags = [{ id: "a", name: "VIP" }, { id: "b", name: "Refund" }];
  it("names: required, bounded, unique ignoring case; a rename may keep its own name", () => {
    expect(tagNameError("  ", tags)).toMatch(/Type a name/);
    expect(tagNameError("x".repeat(31), tags)).toMatch(/at most 30/);
    expect(tagNameError("vip", tags)).toMatch(/already have/);
    expect(tagNameError("vip", tags, "a")).toBeNull();
    expect(tagNameError("Wholesale", tags)).toBeNull();
  });
  it("shows how many of the 30 are used", () => {
    expect(TAG_LIMIT).toBe(30);
    expect(tagCountLine(2)).toBe("2 of 30 tags used");
  });
  it("toggle adds then removes", () => {
    expect(toggleTag(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleTag(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("the team desk form", () => {
  it("opens from a business with no settings: 15 minutes, hours off, weekdays 09:00-18:00, the person's timezone", () => {
    const f = formFromSettings(SETTINGS, "Asia/Kolkata");
    expect(f.firstResponseMinutes).toBe("15");
    expect(f.hoursEnabled).toBe(false);
    expect(f.timezone).toBe("Asia/Kolkata");
    expect(f.awayMessage).toBe("");
    expect(f.autoAssign).toBe(false);
    expect(f.days.map((d) => [d.day, d.closed])).toEqual([[1, false], [2, false], [3, false], [4, false], [5, false], [6, true], [0, true]]);
    expect(f.days[0]).toMatchObject({ open: "09:00", close: "18:00" });
  });
  it("opens from saved hours: the saved zone wins, days not saved are closed", () => {
    const f = formFromSettings({ ...SETTINGS, hours: { enabled: true, timezone: "Europe/London", days: [{ day: 1, open: "08:30", close: "12:00" }] } }, "Asia/Kolkata");
    expect(f.hoursEnabled).toBe(true);
    expect(f.timezone).toBe("Europe/London");
    expect(f.days.find((d) => d.day === 1)).toMatchObject({ closed: false, open: "08:30", close: "12:00" });
    expect(f.days.find((d) => d.day === 2)!.closed).toBe(true);
  });
  const good = () => formFromSettings(SETTINGS, "UTC");
  it("PASS: the default form is valid", () => {
    expect(validateForm(good())).toBeNull();
  });
  it("the target must be a whole number of minutes between 1 and 1440", () => {
    expect(validateForm({ ...good(), firstResponseMinutes: "" })).toMatch(/whole number/);
    expect(validateForm({ ...good(), firstResponseMinutes: "0" })).toMatch(/at least 1 minute/);
    expect(validateForm({ ...good(), firstResponseMinutes: "1441" })).toMatch(/at most 24 hours/);
    expect(validateForm({ ...good(), firstResponseMinutes: "1440" })).toBeNull();
  });
  it("with hours on: a day needs close after open, and at least one day must be open", () => {
    const on = { ...good(), hoursEnabled: true };
    expect(validateForm(on)).toBeNull();
    expect(validateForm({ ...on, days: on.days.map((d) => (d.day === 1 ? { ...d, open: "18:00", close: "09:00" } : d)) })).toBe("Monday: closing time must be after opening time.");
    expect(validateForm({ ...on, days: on.days.map((d) => ({ ...d, closed: true })) })).toMatch(/Open at least one day/);
    // hours off: a bad day is not the api's business
    expect(validateForm({ ...on, hoursEnabled: false, days: on.days.map((d) => ({ ...d, closed: true })) })).toBeNull();
  });
  it("taking turns needs at least one available teammate", () => {
    expect(validateForm({ ...good(), autoAssign: true, availableUserIds: [] })).toMatch(/at least one available teammate/);
    expect(validateForm({ ...good(), autoAssign: true, availableUserIds: ["u1"] })).toBeNull();
    expect(validateForm({ ...good(), autoAssign: false, availableUserIds: [] })).toBeNull();
  });
  it("a removed or demoted teammate is dropped from the available list (the api refuses a save that names them)", () => {
    const f = { ...good(), autoAssign: true, availableUserIds: ["u1", "gone"] };
    expect(pruneAvailable(f, [{ userId: "u1", name: "Ada", role: "editor" }]).availableUserIds).toEqual(["u1"]);
    expect(pruneAvailable(f, [{ userId: "u1", name: "Ada", role: "editor" }, { userId: "gone", name: "G", role: "editor" }])).toBe(f);
  });
  it("a timer with no usable number reads 0 min, not NaN", () => {
    expect(formatMinutes(Number.NaN)).toBe("0 min");
    expect(formatMinutes(90)).toBe("1 h 30 min");
  });
  it("the away message is bounded", () => {
    expect(validateForm({ ...good(), awayMessage: "x".repeat(301) })).toMatch(/at most 300/);
  });
  it("saves open days only, the target as a number, and '' for the default away line", () => {
    const body = patchFromForm({ ...good(), hoursEnabled: true, awayMessage: "  ", autoAssign: true, availableUserIds: ["u1"] });
    expect(body.firstResponseMinutes).toBe(15);
    expect(body.hours.enabled).toBe(true);
    expect(body.hours.days).toHaveLength(5);
    expect(body.hours.days[0]).toEqual({ day: 1, open: "09:00", close: "18:00" });
    expect(body.awayMessage).toBe("");
    expect(body.autoAssign).toEqual({ enabled: true, availableUserIds: ["u1"] });
  });
  it("a half-edited day is not sent when hours are off (the api checked nothing then)", () => {
    const f = { ...good(), hoursEnabled: false };
    const bad = { ...f, days: f.days.map((d) => (d.day === 1 ? { ...d, open: "18:00", close: "09:00" } : d.day === 2 ? { ...d, open: "" } : d)) };
    expect(validateForm(bad)).toBeNull();
    expect(patchFromForm(bad).hours.days.map((d) => d.day)).toEqual([3, 4, 5]);
  });
  it("the away preview fills {opens}, and shows the default when empty", () => {
    const def = "Our team is away now and will reply after {opens}.";
    expect(awayPreview("", def, "{opens}")).toBe("Our team is away now and will reply after 9:00 am tomorrow.");
    expect(awayPreview("Back at {opens}!", def, "{opens}")).toBe("Back at 9:00 am tomorrow!");
    expect(awayPreview("We reply soon.", def, "{opens}")).toBe("We reply soon.");
  });
  it("available teammates toggle", () => {
    expect(toggleAvailable(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleAvailable(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("a double click is one request", () => {
  it("a second run while one is in flight does nothing; after it settles, runs again", async () => {
    const guard = createFlightGuard();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = async () => {
      calls++;
      await gate;
    };
    const first = guard.run(slow);
    const second = guard.run(slow);
    expect(guard.busy).toBe(true);
    release();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(guard.busy).toBe(false);
    await guard.run(async () => void calls++);
    expect(calls).toBe(2);
  });
  it("a failure releases the guard (the next click works)", async () => {
    const guard = createFlightGuard();
    await expect(guard.run(async () => Promise.reject(new Error("no")))).rejects.toThrow("no");
    expect(guard.busy).toBe(false);
  });
});
