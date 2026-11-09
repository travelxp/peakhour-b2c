import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * How the posts, services, details and links panels are wired (PE-12), pinned as text because b2c vitest renders no DOM: the page draws them only
 * for an editable network and keys each by place and network, the shell draws nothing for a network that does not declare the panel, one
 * refresh follows a proposal, and the edit card never lists a change a panel lists. Same approach as the photos wiring spec.
 */

const SRC = resolve(__dirname, "..");
const flat = (p: string) => readFileSync(join(SRC, p), "utf8").replace(/\s+/g, " ");

describe("how the panels are wired", () => {
  it("the page draws the four cards for an editable network, each KEYED by place and network", () => {
    const home = flat("components/presence/presence-home.tsx");
    for (const [card, key] of [["PostsCard", "posts"], ["ServicesCard", "services"], ["DetailsCard", "details"], ["LinksCard", "links"]]) {
      expect(home).toContain(`<${card} key={\`${key}|\${panelLocation ?? ""}|\${panelNetwork ?? ""}\`}`);
    }
    expect(home).toMatch(/\{editOn \? \( <> <PostsCard/);
  });
  it("the shell draws nothing unless the network's declaration offers the panel", () => {
    const shell = flat("components/presence/edit/extra-panel.tsx");
    expect(shell).toContain("drawsPanel(capabilityOf(caps.data, network), field)");
    expect(shell).toContain("if (!listing || !network || !target || !drawn) return null;");
    // the network read is not even made for a panel that is not drawn
    expect(shell).toContain("useExtra(field, listing?.id, network, drawn)");
  });
  it("a proposal carries its place in its variables and is read through outcomeOf; the panel and the change list are refreshed once after it", () => {
    const shell = flat("components/presence/edit/extra-panel.tsx");
    expect(shell).toContain("outcomeOf(await m.propose.mutateAsync({ ...target!, proposal: { field, value, ...(base ? { base } : {}) } }))");
    // the base of the list the DRAFT started from rides with the change (the card passes it), and the api's refusal of a stale one reloads the panel
    expect(shell).toContain("async function submit(value: unknown, base?: string)");
    expect(shell).not.toContain("(data as { base?: string }");
    expect(shell).toContain("isListChanged(err)");
    // after a proposal only the change list is read again, and not waited for
    expect(shell).toContain("void m.refreshChanges(target!);");
    expect(flat("hooks/use-presence-extras.ts")).toContain("const refreshChanges = (t: ExtraTarget) => qc.invalidateQueries({ queryKey: presenceEditKeys.changes(t.listingId) });");
    expect(flat("components/presence/edit/services-card.tsx")).toContain("withCustomService(list, data.categoryRef, own, data.current)");
    for (const card of ["services", "details", "links"]) {
      const src = flat(`components/presence/edit/${card}-card.tsx`);
      expect(src, card).toContain("useBasedDraft");
      expect(src, card).toContain("submit(built.value, d.base ?? data.base)");
      expect(src, card).toContain("disabled={busy || !canEdit}");
      expect(src, card).toContain("draftDroppedWords(label,");
      // the api's refusal is shown after the draft has cleared
      expect(src, card).toContain("{!draft && message && (");
    }
    const hook = flat("hooks/use-presence-extras.ts");
    expect(hook).toContain("mutationFn: (v: ExtraTarget & { proposal: ExtraProposal })");
    expect(hook).toContain("refetchOnWindowFocus: false");
    expect(hook).toContain("retry: false");
  });
  it("the edit card lists a change itself only when no panel lists it, for this network only", () => {
    const edit = flat("components/presence/edit/edit-listing-card.tsx");
    expect(edit).toContain("const extraFields = new Set<string>(drawnExtraFields(cap));");
    expect(edit.match(/!listedElsewhere\(c\)/g)).toHaveLength(2);
  });
  it("the client reads the four panels and proposes on the four fields through the one change route", () => {
    const api = flat("lib/api/presence-extras.ts");
    for (const p of ["posts", "services", "attributes", "links"]) expect(api).toContain(`/v1/presence/extras/${p}?`);
    expect(api).toContain('"/v1/presence/changes"');
    expect(api).toContain("changes: [{ field: p.field, value: p.value, ...(p.base ? { base: p.base } : {}) }]");
  });
  it("the posts card reads what waits from the change list, and explains a delete before approval", () => {
    const card = flat("components/presence/edit/posts-card.tsx");
    expect(card).toContain("const pending = pendingForPost(changes, network, p.ref);");
    expect(card).toContain("deleteNote(data.declaration, label)");
  });
  it("the post form: one draft id per opening, a cleared button clears its address, and it starts from the first declared kind", () => {
    const posts = flat("components/presence/edit/posts-card.tsx");
    expect(posts).toContain("const [draftId] = useState(() => newDraftId());");
    expect(posts).toContain('e.target.value === "" || e.target.value === decl.actionWithoutUrl ? { actionUrl: "" }');
    expect(posts).toContain('emptyPostDraft(data.declaration.kinds[0] ?? "update")');
    expect(posts).toContain("held={p}");
    expect(posts).toContain("canEdit={access.mode === \"edit\"}");
    expect(posts).toContain("postDraftUnchanged(initial, d)");
    expect(posts).toContain("disabled={busy || !canEdit} onClick={() => void go()}");
  });
  it("a links change that settled reloads the listing, whose booking and order addresses it rewrote", () => {
    const hook = flat("hooks/use-presence-extras.ts");
    expect(hook).toContain('if (field === "links") void qc.invalidateQueries({ queryKey: ["presence", "listing"] });');
  });
});
