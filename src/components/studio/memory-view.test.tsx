import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { MemoryView } = await import("./memory-view");
const { STUDIO_COPY } = await import("@/lib/studio-copy");

import type { MemoryLine, MemoryRead } from "@/lib/api/creative";

const line = (over: Partial<MemoryLine> = {}): MemoryLine => ({
  id: "l1",
  text: "You prefer deep reds and gold borders",
  kind: "taste",
  source: "learned",
  origin: "A pattern we noticed",
  evidence: { count: 12, since: "2026-11-03T00:00:00.000Z", basis: "pattern", label: "Based on 12 posts, since 3 Nov." },
  editable: false,
  ...over,
});
const mine = (over: Partial<MemoryLine> = {}) => line({ id: "mine", text: "Keep headlines short", source: "you", editable: true, evidence: null, origin: "You wrote this", ...over });
const data = (over: Partial<MemoryRead> = {}): MemoryRead => ({
  lines: [line()],
  rules: [
    { text: "Your logo and legal text stay as they are.", changeIn: "brand-kit" },
    { text: "Health claims follow IN rules.", changeIn: null },
  ],
  note: "Learning never overrides these.",
  trends: { approvedPosts: 3, enough: false, needs: 10 },
  pooledOptIn: false,
  ...over,
});
const actions = { onStop: () => {}, onSave: async () => true, onAdd: async () => true, onPooled: () => {}, onExport: () => {}, onWipe: () => {} };
const render = (over: Partial<Parameters<typeof MemoryView>[0]> = {}) =>
  renderToStaticMarkup(<MemoryView status="ready" data={data()} proTools={false} canChange onRetry={() => {}} actions={actions} {...over} />);

describe("memory page states", () => {
  it("loading: skeletons only", () => {
    const html = render({ status: "loading", data: undefined });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Your taste");
  });
  it("error: an error with Retry, never the empty state", () => {
    const html = render({ status: "error", data: undefined });
    expect(html).toContain("couldn&#x27;t load what we&#x27;ve learned about you");
    expect(html).toContain("Retry");
    expect(html).not.toContain("Nothing learned yet");
  });
  it("ready with no data is also an error, never a blank page", () => expect(render({ data: undefined })).toContain("Retry"));
  it("offline: says so", () => expect(render({ status: "offline", data: undefined })).toContain("offline"));
  it("empty: the spec's words, with See ideas; the rules and privacy still show", () => {
    const html = render({ data: data({ lines: [] }) });
    expect(html).toContain("Nothing learned yet");
    expect(html).toContain("After you shortlist or skip a few previews, we&#x27;ll note what you like here. You can change or delete anything.");
    expect(html).toContain('href="/dashboard/studio"');
    expect(html).toContain("Rules that always win");
    expect(html).toContain("Privacy");
  });
});

describe("learned lines", () => {
  it("each line shows its sentence, its evidence and a labelled Stop using this", () => {
    const html = render();
    expect(html).toContain("You prefer deep reds and gold borders");
    expect(html).toContain("A pattern we noticed. Based on 12 posts, since 3 Nov.");
    expect(html).toContain('aria-label="Stop using: You prefer deep reds and gold borders"');
    expect(html).toContain("Stop using this");
  });
  it("a thin line says it is an early guess", () => {
    const html = render({ data: data({ lines: [line({ evidence: { count: 2, since: "2026-11-03T00:00:00.000Z", basis: "pattern", label: "Early guess. Based on 2 posts." } })] }) });
    expect(html).toContain("Early guess. Based on 2 posts.");
  });
  it("a line from a test says so and nothing claims proof", () => {
    const html = render({ data: data({ lines: [line({ origin: "From a test of two versions" })] }) });
    expect(html).toContain("From a test of two versions");
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/bproofb|bprovedb|because of this/i);
  });
  it("lines are list items", () => expect(render()).toMatch(/<ul[^>]*>\s*<li/));
  it("novices cannot edit or add: no Edit button, no Add a preference", () => {
    const html = render({ proTools: false, data: data({ lines: [mine({ editable: false })] }) });
    expect(html).not.toContain(">Edit<");
    expect(html).not.toContain("Add a preference");
  });
  it("Pro tools: a line the merchant wrote can be edited; a learned one cannot be reworded", () => {
    const html = render({ proTools: true, data: data({ lines: [mine(), line()] }) });
    expect(html).toContain('aria-label="Edit: Keep headlines short"');
    expect(html).not.toContain('aria-label="Edit: You prefer deep reds');
    expect(html).toContain("Add a preference");
    expect(html).toContain("0 of 140 characters");
    expect(html).toContain("You wrote this");
  });
  it("the editor opens with a labelled field and a character count", () => {
    const html = render({ proTools: true, initialEditingId: "mine", data: data({ lines: [mine()] }) });
    expect(html).toContain('for="studio-line-mine"');
    expect(html).toContain('value="Keep headlines short"');
    expect(html).toContain("20 of 140 characters");
    expect(html).toContain("Save");
    expect(html).toContain("Cancel");
  });
  it("the delete button is off while that line's delete is in flight", () => {
    const html = render({ busyIds: new Set(["l1"]) });
    const button = html.slice(html.lastIndexOf("<button", html.indexOf("Stop using this")), html.indexOf("Stop using this"));
    expect(button).toContain('disabled=""');
  });
  it("with Pro tools off, a line the merchant wrote can be stopped but not edited", () => {
    const html = render({ proTools: false, data: data({ lines: [mine()] }) });
    expect(html).not.toContain(">Edit<");
    expect(html).toContain("Stop using this");
  });
  it("a viewer reads everything and changes nothing, and is told why", () => {
    const html = render({ canChange: false, proTools: true });
    expect(html).not.toContain("Stop using this");
    expect(html).not.toContain("Add a preference");
    expect(html).toContain("Ask an editor to change this.");
    expect(html).toContain("You prefer deep reds and gold borders");
  });
});

describe("rules that always win", () => {
  it("are shown apart, with no edit or stop control, and a link to the Brand Kit", () => {
    const html = render({ proTools: true });
    const rules = html.slice(html.indexOf("Rules that always win"), html.indexOf("Is it getting better?"));
    expect(rules).toContain("Your logo and legal text stay as they are.");
    expect(rules).toContain("Health claims follow IN rules.");
    expect(rules).toContain("Learning never overrides these.");
    expect(rules).toContain('href="/dashboard/drive?tab=brand"');
    expect(rules).not.toContain("Stop using");
    expect(rules).not.toContain(">Edit<");
    expect(rules.match(/Change in Brand Kit/g)).toHaveLength(1);
  });
  it("two rules with the same words both draw", () => {
    const rule = { text: "Same words.", changeIn: null } as const;
    expect(render({ data: data({ rules: [rule, rule] }) }).match(/Same words\./g)).toHaveLength(2);
  });
  it("a rule line that slips into the taste list is not shown as a learned line", () => {
    const html = render({ data: data({ lines: [line({ id: "r", kind: "rule", text: "Never show prices" })] }) });
    expect(html).not.toContain("Never show prices");
    expect(html).toContain("Nothing learned yet");
  });
});

describe("trend and privacy", () => {
  it("under ten approved posts says how many are needed, with no trend", () => {
    const html = render();
    expect(html).toContain("Needs about 10 posts to show a trend.");
    expect(html).toContain("3 approved posts so far.");
  });
  it("with enough posts it says what it is based on", () => expect(render({ data: data({ trends: { approvedPosts: 14, enough: true, needs: 10 } }) })).toContain("Based on 14 approved posts."));
  it("the opt-in switch is a labelled switch, off by default, with its help", () => {
    const html = render();
    expect(html).toContain('for="studio-pooled"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("Patterns only, never your pictures or text.");
  });
  it("the switch waits while a change is on its way", () => {
    expect(render({ pooledBusy: true })).toMatch(/role="switch"[^>]*disabled=""/);
  });
  it("on shows checked", () => expect(render({ data: data({ pooledOptIn: true }) })).toContain('aria-checked="true"'));
  it("Export and Wipe are there; a viewer cannot wipe or change the switch", () => {
    const html = render();
    expect(html).toContain("Export");
    expect(html).toContain("Wipe everything we&#x27;ve learned");
    const viewer = render({ canChange: false });
    const wipe = viewer.slice(viewer.lastIndexOf("<button", viewer.indexOf("Wipe everything")), viewer.indexOf("Wipe everything"));
    expect(wipe).toContain('disabled=""');
  });
  it("the wipe confirmation says it cannot be undone and the Library is untouched", () => {
    expect(STUDIO_COPY.learned.wipeBody).toBe("This can't be undone. Your Library isn't touched.");
  });
});
