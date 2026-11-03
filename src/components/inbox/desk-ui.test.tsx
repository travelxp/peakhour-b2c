import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";

// Markup only: every hook module is replaced so nothing here reaches the api, the router or the auth provider.
vi.mock("@/hooks/use-inbox-desk", () => ({}));
vi.mock("@/hooks/use-wa-conversations", () => ({}));
vi.mock("@/hooks/use-control-plane", () => ({}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { _id: "u1", name: "Ada", preferences: { timezone: "Asia/Kolkata" } }, org: { _id: "o1" }, orgs: [], business: { _id: "b1" } }) }));

const { DeskControlsView } = await import("./desk-controls");
const { NotesPanelView } = await import("./notes-panel");
const { NoteCard } = await import("./note-card");
const { AiPauseView } = await import("./ai-pause");
const { TeamDeskFormView, TagManagerView, TEAM_DESK_READONLY_NOTE } = await import("./team-desk-card");
const { AssigneeBadge, CsatBadge, TimerChip, TagChips } = await import("./desk-badges");
const { ThreadHeader } = await import("./thread-header");
const { formFromSettings, NOTE_LABEL } = await import("@/lib/inbox-desk");

const here = (f: string) => readFileSync(join(__dirname, f), "utf8");
const team = [
  { userId: "u1", name: "Ada Lovelace", role: "editor" },
  { userId: "u2", name: "Bo Diddley", role: "admin" },
];
const tags = [
  { id: "t1", name: "VIP" },
  { id: "t2", name: "Refund" },
];
const noop = () => {};
// the attribute, not Tailwind's `disabled:` variants in the class list
const DIS = /\sdisabled(="")?[\s/>]/;

function controls(over: Partial<ComponentProps<typeof DeskControlsView>> = {}) {
  return renderToStaticMarkup(
    <DeskControlsView
      canWork
      canCreateTag={false}
      assignee={{ userId: "u2", name: "Bo Diddley" }}
      me="u1"
      team={team}
      tags={tags}
      tagIds={["t1"]}
      busy={false}
      onAssign={noop}
      onToggleTag={noop}
      onCreateTag={async () => null}
      {...over}
    />,
  );
}

describe("the assign control and tag editor (viewer gate)", () => {
  it("an editor gets the assign control and the tag editor", () => {
    const h = controls();
    expect(h).toContain('aria-label="Assign this conversation"');
    expect(h).toContain('aria-label="Edit tags"');
    expect(h).toContain("Bo Diddley");
    expect(h).toContain("VIP");
  });
  it("a viewer sees who has it and its tags, and NO control", () => {
    const h = controls({ canWork: false });
    expect(h).toContain("Assigned to Bo Diddley");
    expect(h).toContain("VIP");
    expect(h).not.toContain("<button");
    expect(h).not.toContain("Assign this conversation");
    expect(h).not.toContain("Edit tags");
    expect(h).toContain('data-testid="desk-readonly"');
  });
  it("a viewer on an unassigned conversation reads 'Not assigned'", () => {
    expect(controls({ canWork: false, assignee: null, tagIds: [] })).toContain("Not assigned");
  });
  it("the control is disabled while a change is in flight (no second click)", () => {
    expect(/<button[^>]*aria-label="Assign this conversation"[^>]*>/.exec(controls({ busy: true }))![0]).toMatch(DIS);
    expect(/<button[^>]*aria-label="Assign this conversation"[^>]*>/.exec(controls({ busy: false }))![0]).not.toMatch(DIS);
  });
  it("an unassigned conversation offers Assign", () => {
    expect(controls({ assignee: null })).toContain(">Assign<");
  });
});

describe("notes", () => {
  const note = { id: "n1", body: "Called, no answer", authorUserId: "u1", authorName: "Ada Lovelace", createdAt: "2026-11-03T10:00:00.000Z" };
  function panel(over: Partial<ComponentProps<typeof NotesPanelView>> = {}) {
    return renderToStaticMarkup(
      <NotesPanelView notes={[note]} label={NOTE_LABEL} me="u1" role="editor" state="ready" body="" onBody={noop} saving={false} onAdd={noop} onDelete={noop} deletingId={null} error={null} {...over} />,
    );
  }
  it("the note label is exactly 'Note — only your team sees this', with the author", () => {
    const h = renderToStaticMarkup(<NoteCard body="Hello" author="Ada Lovelace" time="10:00" />);
    expect(h).toContain(">Note — only your team sees this<");
    expect(h).toContain("Ada Lovelace · 10:00");
    expect(h).toContain("border-dashed");
    // never a message bubble
    expect(h).not.toContain("bg-success/15");
  });
  it("an editor can add a note (textarea, button), and delete their own", () => {
    const h = panel();
    expect(h).toContain('aria-label="Add a note"');
    expect(h).toContain("Add note");
    expect(h).toContain(">Delete<");
    expect(h).toContain("2000 left of 2000");
  });
  it("an editor cannot delete someone else's note", () => {
    expect(panel({ me: "u9" })).not.toContain(">Delete<");
  });
  it("a viewer reads the notes and has no textarea, no Add, no Delete", () => {
    const h = panel({ role: "viewer" });
    expect(h).toContain("Called, no answer");
    expect(h).toContain(NOTE_LABEL);
    expect(h).not.toContain("<textarea");
    expect(h).not.toContain("Add note");
    expect(h).not.toContain(">Delete<");
    expect(h).toContain("needs Editor access or above");
  });
  it("the textarea and button are disabled while saving, and Add is off for an empty note", () => {
    const saving = panel({ saving: true, body: "Hello" });
    expect(/<textarea[^>]*>/.exec(saving)![0]).toMatch(DIS);
    expect(saving).toContain("Saving…");
    expect(/<button[^>]*>Saving…/.exec(saving)![0]).toMatch(DIS);
    expect(/<button[^>]*>Add note/.exec(panel({ body: "" }))![0]).toMatch(DIS);
    expect(/<button[^>]*>Add note/.exec(panel({ body: "Hello" }))![0]).not.toMatch(DIS);
  });
  it("a note past 2000 characters says so and cannot be saved", () => {
    const h = panel({ body: "x".repeat(2001) });
    expect(h).toContain("A note can be up to 2000 characters");
    expect(/<button[^>]*>Add note/.exec(h)![0]).toMatch(DIS);
  });
  it("a failed save shows its plain error", () => {
    expect(panel({ error: "Saving the note didn’t work just now. Check your connection and try again." })).toContain("Check your connection and try again.");
  });
});

describe("pause the shopper assistant", () => {
  const copy = { title: "TITLE-FROM-API", on: "ON-COPY-FROM-API", off: "OFF-COPY-FROM-API", notEmergencyStop: "NOT-THE-EMERGENCY-STOP-FROM-API" };
  const view = (over: Partial<ComponentProps<typeof AiPauseView>> = {}) =>
    renderToStaticMarkup(<AiPauseView copy={copy} paused={false} canToggle busy={false} onToggle={noop} variant="card" {...over} />);
  it("shows the api's words as sent, including the difference from the emergency stop", () => {
    const h = view();
    expect(h).toContain("TITLE-FROM-API");
    expect(h).toContain("OFF-COPY-FROM-API");
    expect(h).toContain("NOT-THE-EMERGENCY-STOP-FROM-API");
    expect(view({ paused: true })).toContain("ON-COPY-FROM-API");
    expect(view({ paused: true })).not.toContain("OFF-COPY-FROM-API");
  });
  it("the source retypes none of the api's copy", () => {
    const src = here("ai-pause.tsx");
    for (const line of ["Pause the shopper assistant", "This is not the emergency stop", "The assistant is paused.", "The assistant is answering shoppers."]) expect(src.replace(/\s+/g, " ")).not.toContain(line);
  });
  it("an admin or owner has the switch; its state is the server's", () => {
    const off = /<button[^>]*role="switch"[^>]*>/.exec(view())![0];
    expect(off).toContain('aria-checked="false"');
    expect(/<button[^>]*role="switch"[^>]*>/.exec(view({ paused: true }))![0]).toContain('aria-checked="true"');
  });
  it("an editor and a viewer get NO switch and NO Resume, in either variant", () => {
    for (const variant of ["card", "inbox"] as const) {
      const h = view({ canToggle: false, paused: true, variant });
      expect(h, variant).not.toContain('role="switch"');
      expect(h, variant).not.toContain("Resume");
      expect(h, variant).toContain("ON-COPY-FROM-API");
    }
  });
  it("in the Inbox, a paused assistant is a banner with Resume for an admin", () => {
    const h = view({ variant: "inbox", paused: true });
    expect(h).toContain('role="status"');
    expect(h).toContain("Resume the assistant");
    expect(h).not.toContain('role="switch"');
  });
  it("in the Inbox, nothing shows to a non-admin while the assistant is answering", () => {
    expect(view({ variant: "inbox", canToggle: false, paused: false })).toBe("");
  });
  it("the switch is disabled while the change is in flight", () => {
    expect(/<button[^>]*role="switch"[^>]*>/.exec(view({ busy: true }))![0]).toMatch(DIS);
  });
});

describe("the timer and the list badges", () => {
  const chip = (timer: ComponentProps<typeof TimerChip>["timer"]) => renderToStaticMarkup(<TimerChip timer={timer} />);
  it("renders ok, amber, red and paused each with its own tone", () => {
    expect(chip({ state: "ok", elapsedMinutes: 2, targetMinutes: 15, paused: false })).toContain('data-tone="ok"');
    expect(chip({ state: "amber", elapsedMinutes: 8, targetMinutes: 15, paused: false })).toContain('data-tone="amber"');
    expect(chip({ state: "red", elapsedMinutes: 16, targetMinutes: 15, paused: false })).toContain('data-tone="red"');
    const paused = chip({ state: "red", elapsedMinutes: 16, targetMinutes: 15, paused: true });
    expect(paused).toContain('data-tone="paused"');
    expect(paused).toContain("Paused until opening");
  });
  it("nothing for a conversation without a timer", () => {
    expect(chip(null)).toBe("");
  });
  it("the assignee badge shows initials and the name; none when unassigned", () => {
    const h = renderToStaticMarkup(<AssigneeBadge assignee={{ userId: "u1", name: "Ada Lovelace" }} />);
    expect(h).toContain(">AL<");
    expect(h).toContain("Assigned to Ada Lovelace");
    expect(renderToStaticMarkup(<AssigneeBadge assignee={null} />)).toBe("");
  });
  it("tag chips show names, cap with +N, and skip a deleted tag", () => {
    const many = [...tags, { id: "t3", name: "Late" }];
    const h = renderToStaticMarkup(<TagChips tagIds={["t1", "t2", "t3", "gone"]} tags={many} max={2} />);
    expect(h).toContain("VIP");
    expect(h).toContain("Refund");
    expect(h).not.toContain("Late");
    expect(h).toContain("+1");
    expect(renderToStaticMarkup(<TagChips tagIds={["gone"]} tags={tags} />)).toBe("");
  });
  it("the thread header carries the timer and the desk controls when given", () => {
    const h = renderToStaticMarkup(
      <ThreadHeader
        title="Asha"
        channel="whatsapp"
        status="escalated"
        needsYou
        held={null}
        onBack={noop}
        hold={{ available: false, label: "", start: noop }}
        canExport={false}
        exporting={false}
        onExport={noop}
        timer={<TimerChip timer={{ state: "amber", elapsedMinutes: 8, targetMinutes: 15, paused: false }} />}
        desk={<span data-testid="desk-slot">desk</span>}
      />,
    );
    expect(h).toContain("Reply soon");
    expect(h).toContain("desk-slot");
  });
});

describe("the shopper's rating (Inbox CSAT)", () => {
  const asked = "2026-11-03T10:00:00.000Z";
  it("an answered rating reads 'Rated 4/5' and who closed it", () => {
    const h = renderToStaticMarkup(<CsatBadge csat={{ score: 4, resolvedBy: "ai", askedAt: asked, answeredAt: asked }} />);
    expect(h).toContain("Rated 4/5 · closed by the assistant");
    expect(h).toContain('data-answered="true"');
    expect(renderToStaticMarkup(<CsatBadge csat={{ score: 2, resolvedBy: "human", askedAt: asked, answeredAt: asked }} />)).toContain("Rated 2/5 · closed by your team");
  });
  it("an unanswered request says so and never shows a score", () => {
    const h = renderToStaticMarkup(<CsatBadge csat={{ score: null, resolvedBy: "human", askedAt: asked, answeredAt: null }} />);
    expect(h).toContain("Rating asked, no answer yet · closed by your team");
    expect(h).not.toContain("/5");
  });
  it("nothing for a conversation that was never asked", () => {
    expect(renderToStaticMarkup(<CsatBadge csat={null} />)).toBe("");
    expect(renderToStaticMarkup(<CsatBadge csat={undefined} />)).toBe("");
  });
  it("the open conversation's header renders it (wired in the pane)", () => {
    const src = readFileSync(join(process.cwd(), "src/components/inbox/conversations-pane.tsx"), "utf8");
    expect(src).toContain("<CsatBadge csat={waThread?.csat} />");
  });
});

describe("Team desk settings", () => {
  const defaults = { awayMessage: "Our team is away now and will reply after {opens}.", opensToken: "{opens}" };
  const baseForm = () =>
    formFromSettings({ aiPaused: false, aiPausedAt: null, autoAssign: { enabled: true, availableUserIds: ["u1"] }, firstResponseMinutes: 20, hours: { enabled: true, timezone: "Asia/Kolkata", days: [{ day: 1, open: "09:00", close: "18:00" }] }, awayMessage: null }, "UTC");
  const form = (over: Partial<ComponentProps<typeof TeamDeskFormView>> = {}) =>
    renderToStaticMarkup(<TeamDeskFormView form={baseForm()} onChange={noop} canEdit team={team} defaults={defaults} error={null} saving={false} onSave={noop} zones={["Asia/Kolkata", "UTC"]} {...over} />);
  it("an admin edits: the fields are live and there is a Save", () => {
    const h = form();
    expect(h).toContain("Save team desk settings");
    expect(/<input[^>]*id="desk-first-reply"[^>]*>/.exec(h)![0]).not.toMatch(DIS);
    expect(h).toContain('value="20"');
    expect(h).toContain("Business hours");
    expect(h).toContain("Take turns on new conversations");
  });
  it("everyone else reads it: values shown, every control disabled, no Save", () => {
    const h = form({ canEdit: false });
    expect(h).toContain(TEAM_DESK_READONLY_NOTE);
    expect(h).not.toContain("Save team desk settings");
    expect(h).toContain('value="20"');
    expect(/<input[^>]*id="desk-first-reply"[^>]*>/.exec(h)![0]).toMatch(DIS);
    expect(/<textarea[^>]*>/.exec(h)![0]).toMatch(DIS);
    for (const m of h.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)) expect(m[0]).toMatch(DIS);
  });
  it("shows the default away line and the {opens} token, with a live preview", () => {
    const h = form();
    expect(h).toContain('placeholder="Our team is away now and will reply after {opens}."');
    expect(h).toContain("Use {opens} where the time you next open should go");
    expect(h).toContain("Preview: </span>Our team is away now and will reply after 9:00 am tomorrow.");
    const custom = form({ form: { ...baseForm(), awayMessage: "Back at {opens}" } });
    expect(custom).toContain("Preview: </span>Back at 9:00 am tomorrow");
  });
  it("round-robin lists the teammates with the available ones ticked", () => {
    const h = form();
    expect(h).toContain("Who is available");
    expect(/<input[^>]*type="checkbox"[^>]*checked[^>]*>/.test(h)).toBe(true);
    expect(h).toContain("Ada Lovelace");
    expect(h).toContain("Bo Diddley");
  });
  it("round-robin is off by default and shows no teammate list", () => {
    const off = form({ form: formFromSettings({ aiPaused: false, aiPausedAt: null, autoAssign: { enabled: false, availableUserIds: [] }, firstResponseMinutes: 15, hours: null, awayMessage: null }, "UTC") });
    expect(/<button[^>]*id="desk-rr"[^>]*>/.exec(off)![0]).toContain('aria-checked="false"');
    expect(off).not.toContain("Who is available");
  });
  it("a refused save shows the api's message", () => {
    expect(form({ error: "Closing time must be after opening time" })).toContain("Closing time must be after opening time");
  });
  it("defaults the timezone to the person's Preferences timezone for a business with none", () => {
    expect(formFromSettings({ aiPaused: false, aiPausedAt: null, autoAssign: { enabled: false, availableUserIds: [] }, firstResponseMinutes: 15, hours: null, awayMessage: null }, "Asia/Kolkata").timezone).toBe("Asia/Kolkata");
  });
});

describe("tag management", () => {
  const mgr = (over: Partial<ComponentProps<typeof TagManagerView>> = {}) =>
    renderToStaticMarkup(<TagManagerView tags={tags} canEdit busy={false} error={null} onCreate={async () => true} onRename={async () => true} onDelete={async () => {}} {...over} />);
  it("shows how many of the 30 are used, with rename and delete for an admin", () => {
    const h = mgr();
    expect(h).toContain("2 of 30 tags used");
    expect(h).toContain(">Rename<");
    expect(h).toContain(">Delete<");
    expect(h).toContain("Add tag");
  });
  it("a non-admin sees the tags and the count and nothing to change", () => {
    const h = mgr({ canEdit: false });
    expect(h).toContain("VIP");
    expect(h).toContain("2 of 30 tags used");
    expect(h).not.toContain("Rename");
    expect(h).not.toContain("Add tag");
  });
  it("at 30 tags, adding is off and says why", () => {
    const thirty = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, name: `Tag ${i}` }));
    const h = mgr({ tags: thirty });
    expect(h).toContain("30 of 30 tags used");
    expect(h).toContain("30 is the most a business can have");
    expect(/<button[^>]*>Add tag/.exec(h)![0]).toMatch(DIS);
  });
  it("shows the api's refusal", () => {
    expect(mgr({ error: 'You already have a tag called "VIP".' })).toContain("You already have a tag called");
  });
});

describe("dark mode: no hard-coded colour in the team desk markup", () => {
  const HEX = /(?:bg|text|border|ring|fill|stroke|from|to|via)-\[#[0-9a-fA-F]{3,8}\]|["'`(]#[0-9a-fA-F]{3,8}["'`)]/;
  it.each(["desk-badges.tsx", "desk-controls.tsx", "note-card.tsx", "notes-panel.tsx", "ai-pause.tsx", "team-desk-card.tsx"])("%s has none", (file) => {
    expect(here(file)).not.toMatch(HEX);
  });
});
