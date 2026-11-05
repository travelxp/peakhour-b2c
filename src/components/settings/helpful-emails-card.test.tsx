import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Markup only: the hooks are replaced, so nothing here reaches the api or the query client.
const h = vi.hoisted(() => ({ answer: undefined as undefined | { enabled: boolean; canChange: boolean }, pending: false, mutate: vi.fn() }));
vi.mock("@/hooks/use-notification-tips", () => ({
  useNotificationTips: () => ({ data: h.answer }),
  useSetNotificationTips: () => ({ isPending: h.pending, mutate: h.mutate }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const { HelpfulEmailsCard } = await import("./helpful-emails-card");
const { canChangeTips, TIPS_ALERTS_NOTE, TIPS_HINT, TIPS_LABEL, TIPS_READONLY_NOTE, TIPS_TITLE } = await import("@/lib/notification-tips");

/**
 * PE-14. The weekly summary and tips switch in Settings > Preferences: a BUSINESS setting. An owner or an admin gets a switch; anyone else sees where it
 * stands and who can change it; nothing is drawn before the api answers; the api's word on who may change it wins over the role the page knows.
 */
const button = (html: string) => /<button[^>]*id="helpful-emails"[^>]*>/.exec(html)![0];
/** the attribute, not the word: the switch's class names mention `disabled:` for its styles */
const isDisabled = (btn: string) => /\sdisabled=""/.test(btn);

beforeEach(() => {
  h.answer = { enabled: true, canChange: true };
  h.pending = false;
  h.mutate.mockClear();
});

describe("who may change it", () => {
  it("is an owner or an admin, as the api's requireRole('admin') says", () => {
    expect(canChangeTips("owner")).toBe(true);
    expect(canChangeTips("admin")).toBe(true);
    for (const r of ["editor", "viewer", "", null, undefined]) expect(canChangeTips(r as string | null)).toBe(false);
  });
});

describe("the card", () => {
  it("draws nothing before the api has answered", () => {
    h.answer = undefined;
    expect(renderToStaticMarkup(<HelpfulEmailsCard role="owner" />)).toBe("");
  });
  it("an owner sees the switch, on, with its label, its hint and the note that alerts are separate", () => {
    const html = renderToStaticMarkup(<HelpfulEmailsCard role="owner" />);
    for (const t of [TIPS_TITLE, TIPS_LABEL, TIPS_HINT, TIPS_ALERTS_NOTE]) expect(html).toContain(t.replace(/'/g, "&#x27;"));
    expect(button(html)).toContain('aria-checked="true"');
    expect(isDisabled(button(html))).toBe(false);
    expect(html).not.toContain(TIPS_READONLY_NOTE);
  });
  it("shows it off when the business has turned it off", () => {
    h.answer = { enabled: false, canChange: true };
    expect(button(renderToStaticMarkup(<HelpfulEmailsCard role="admin" />))).toContain('aria-checked="false"');
  });
  it("an editor sees where it stands, a disabled switch and who can change it", () => {
    h.answer = { enabled: true, canChange: false };
    const html = renderToStaticMarkup(<HelpfulEmailsCard role="editor" />);
    expect(isDisabled(button(html))).toBe(true);
    expect(button(html)).toContain('aria-checked="true"');
    expect(html).toContain(TIPS_READONLY_NOTE);
    expect(html).toContain(TIPS_ALERTS_NOTE);
  });
  it("the api's word wins: a role the page thinks is an admin, that the api refuses, gets no switch", () => {
    h.answer = { enabled: true, canChange: false };
    expect(isDisabled(button(renderToStaticMarkup(<HelpfulEmailsCard role="admin" />)))).toBe(true);
  });
  it("and the role wins over an api that says yes to a role that may not (belt and braces)", () => {
    h.answer = { enabled: true, canChange: true };
    expect(isDisabled(button(renderToStaticMarkup(<HelpfulEmailsCard role="viewer" />)))).toBe(true);
  });
  it("the switch is held while a save is under way", () => {
    h.pending = true;
    expect(isDisabled(button(renderToStaticMarkup(<HelpfulEmailsCard role="owner" />)))).toBe(true);
  });
  it("promises nothing the api does not do: it says the whole business, and that alerts still arrive", () => {
    const html = renderToStaticMarkup(<HelpfulEmailsCard role="owner" />);
    expect(html).toMatch(/whole business/);
    expect(html).toMatch(/always arrive/);
  });
});
