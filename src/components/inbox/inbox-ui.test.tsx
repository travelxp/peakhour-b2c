import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";

// Markup only: every hook module is replaced so nothing here reaches the api, the router or the auth provider.
vi.mock("@/hooks/use-legal-holds", () => ({ useLegalHolds: () => ({}), useBusinessHold: () => ({}), useThreadHold: () => ({}) }));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { _id: "u1", name: "Ada", preferences: { inboxAlerts: { newLead: false } } }, refreshUser: async () => {}, org: { _id: "o1" }, orgs: [{ _id: "o1", role: "owner" }], business: { _id: "b1" } }),
}));
vi.mock("@/hooks/use-wa-conversations", () => ({}));
vi.mock("@/hooks/use-control-plane", () => ({ useOrgMembers: () => ({}) }));

const { Bubble, DaySeparator } = await import("./message-bubble");
const { ThreadHeader } = await import("./thread-header");
const { WaNoticeCard } = await import("./conversations-pane");
const { StatusPill, ChannelChip, UnreadDot } = await import("./inbox-badges");
const { InboxAlertsCard } = await import("./inbox-alerts-card");

const here = (f: string) => readFileSync(join(__dirname, f), "utf8");

describe("dark mode: no hard-coded colour in the conversation markup", () => {
  // a Tailwind arbitrary colour (bg-[#dcf8c6]), or a hex literal anywhere in the file's code
  const HEX = /(?:bg|text|border|ring|fill|stroke|from|to|via)-\[#[0-9a-fA-F]{3,8}\]|["'`(]#[0-9a-fA-F]{3,8}["'`)]/;
  it.each(["message-bubble.tsx", "conversations-pane.tsx", "thread-header.tsx", "inbox-badges.tsx", "manage-panel.tsx"])("%s has none", (file) => {
    expect(here(file)).not.toMatch(HEX);
  });
  it("the page itself has none either (the old bubble colours lived there)", () => {
    const page = readFileSync(join(__dirname, "../../app/(site)/dashboard/inbox/page.tsx"), "utf8");
    expect(page).not.toMatch(HEX);
    expect(page).not.toContain("#dcf8c6");
    expect(page).not.toContain("#e5ddd5");
  });
  it("the matcher itself catches the old colours (the check is not inert)", () => {
    expect('className="bg-[#dcf8c6]"').toMatch(HEX);
    expect('className="bg-[#e5ddd5] p-3"').toMatch(HEX);
    expect("const c = '#fff'").toMatch(HEX);
  });
  it("the bubbles use theme tokens: the business's and assistant's lines are tinted success, the shopper's are a card", () => {
    const mine = renderToStaticMarkup(<Bubble role="merchant" content="On its way" sender="You · Inbox" />);
    const theirs = renderToStaticMarkup(<Bubble role="user" content="Where is it?" sender="Asha" />);
    expect(mine).toContain("bg-success/15");
    expect(mine).toContain("text-foreground");
    expect(theirs).toContain("bg-card");
    expect(theirs).toContain("text-card-foreground");
    expect(mine + theirs).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(renderToStaticMarkup(<Bubble role="assistant" content="x" sender="Peakhour AI" />)).toContain("bg-success/15");
  });
  it("a bubble shows its time when it has one, and nothing when it has not", () => {
    expect(renderToStaticMarkup(<Bubble role="user" content="hi" sender="Asha" time="08:05" />)).toContain("08:05");
    expect(renderToStaticMarkup(<Bubble role="user" content="hi" sender="Asha" />)).not.toContain("text-right");
  });
  it("a day separator names the day, and an empty label renders nothing", () => {
    expect(renderToStaticMarkup(<DaySeparator label="Yesterday" />)).toContain("Yesterday");
    expect(renderToStaticMarkup(<DaySeparator label="" />)).toBe("");
  });
});

describe("badges", () => {
  it("'Needs you' outranks 'With a human'; without it the status reads as before", () => {
    expect(renderToStaticMarkup(<StatusPill status="escalated" needsYou />)).toContain("Needs you");
    expect(renderToStaticMarkup(<StatusPill status="escalated" needsYou />)).not.toContain("With a human");
    expect(renderToStaticMarkup(<StatusPill status="escalated" />)).toContain("With a human");
    expect(renderToStaticMarkup(<StatusPill status="active" />)).toContain("Active");
  });
  it("the channel chip names the channel, and the unread dot is announced", () => {
    expect(renderToStaticMarkup(<ChannelChip channel="storefront" />)).toContain("Storefront");
    expect(renderToStaticMarkup(<ChannelChip channel="whatsapp" />)).toContain("WhatsApp");
    expect(renderToStaticMarkup(<UnreadDot />)).toContain('aria-label="Unread"');
  });
});

describe("honest states: the card says what to do", () => {
  it("not connected: a Connect WhatsApp link to the WhatsApp page, and never 'Couldn't load'", () => {
    const html = renderToStaticMarkup(<WaNoticeCard state="not_connected" />);
    expect(html).toContain("Connect WhatsApp to see your conversations");
    expect(html).toContain('href="/dashboard/content/whatsapp"');
    expect(html).toContain(">Connect WhatsApp<");
    expect(html).not.toMatch(/couldn.t load/i);
  });
  it("needs re-auth: a Reconnect link", () => {
    const html = renderToStaticMarkup(<WaNoticeCard state="needs_reauth" />);
    expect(html).toContain("Reconnect WhatsApp");
    expect(html).toContain('href="/dashboard/content/whatsapp"');
  });
  it("not available yet: the sentence, and no button to press", () => {
    const html = renderToStaticMarkup(<WaNoticeCard state="not_available" />);
    expect(html).toContain("WhatsApp isn&#x27;t available yet");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<button");
  });
  it("PASS: a working connection shows no card", () => {
    expect(renderToStaticMarkup(<WaNoticeCard state="ok" />)).toBe("");
  });
});

describe("the thread header on a phone", () => {
  type Props = ComponentProps<typeof ThreadHeader>;
  const base: Props = {
    title: "Asha with a very long contact name that would push the actions off a 375 pixel screen",
    channel: "whatsapp",
    status: "active",
    needsYou: false,
    held: null,
    onBack: () => {},
    hold: { available: true, label: "Keep (legal hold)", start: () => {} },
    canExport: true,
    exporting: false,
    onExport: () => {},
    handover: { label: "Take over", variant: "default", pending: false, disabled: false, onClick: () => {} },
  };
  const html = (over: Partial<Props> = {}) => renderToStaticMarkup(<ThreadHeader {...base} {...over} />);

  it("has a back button that only shows below lg", () => {
    expect(html()).toMatch(/aria-label="Back to conversations"[^>]*/);
    const back = /<button[^>]*aria-label="Back to conversations"[^>]*>/.exec(html())![0];
    expect(back).toContain("lg:hidden");
  });
  it("the title is the one thing that shrinks (min-w-0, flex-1, truncate); the actions never shrink", () => {
    const h = html();
    expect(h).toContain('class="min-w-0 flex-1"');
    expect(h).toContain("truncate");
    expect(h).toContain('class="flex shrink-0 items-center gap-2"');
  });
  it("Keep and Export are in the overflow menu below lg and inline buttons from lg, never both visible", () => {
    const h = html();
    const wide = /<div[^>]*data-testid="header-actions-wide"[^>]*>/.exec(h)![0];
    expect(wide).toContain("hidden");
    expect(wide).toContain("lg:flex");
    const more = /<button[^>]*data-testid="header-more"[^>]*>/.exec(h)![0];
    expect(more).toContain("lg:hidden");
    expect(more).toContain('aria-label="More actions"');
  });
  it("the main action is 'Take over' on an active thread and the quieter 'Return to AI' on a held one", () => {
    expect(html()).toContain("Take over");
    const back = html({ handover: { label: "Return to AI", variant: "outline", pending: false, disabled: false, onClick: () => {} } });
    expect(back).toContain("Return to AI");
    expect(back).not.toContain("Take over");
  });
  it("a storefront chat has no hand-over button at all", () => {
    const h = html({ channel: "storefront", handover: null });
    expect(h).not.toContain("Take over");
    expect(h).not.toContain("Return to AI");
    expect(h).toContain("Storefront");
  });
  it("someone who may neither hold nor export gets no menu and no wide actions", () => {
    const h = html({ hold: { available: false, label: "", start: () => {} }, canExport: false });
    expect(h).not.toContain("header-more");
    expect(h).not.toContain("header-actions-wide");
  });
  it("a conversation that needs you says so in the header", () => {
    expect(html({ needsYou: true, status: "escalated" })).toContain("Needs you");
  });
});

describe("Settings: inbox emails", () => {
  it("an owner sees the three switches, with the one they turned off off", () => {
    const h = renderToStaticMarkup(<InboxAlertsCard role="owner" />);
    expect(h).toContain("A shopper is waiting for a reply");
    expect(h).toContain("A new lead arrives");
    expect(h).toContain("A review of two stars or fewer");
    // newLead was saved as false in the mocked profile; the other two are absent = on
    const newLead = /<button[^>]*id="alert-newLead"[^>]*>/.exec(h)![0];
    const needsHuman = /<button[^>]*id="alert-needsHuman"[^>]*>/.exec(h)![0];
    expect(newLead).toContain('aria-checked="false"');
    expect(needsHuman).toContain('aria-checked="true"');
  });
  it("an editor, a viewer and nobody see nothing: they get no emails", () => {
    for (const role of ["editor", "viewer", null]) expect(renderToStaticMarkup(<InboxAlertsCard role={role} />), String(role)).toBe("");
  });
});
