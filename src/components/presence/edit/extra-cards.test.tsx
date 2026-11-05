import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { presenceListingQueryKey } from "@/lib/presence-panels";
import { presenceEditKeys } from "@/lib/presence-edit";
import { presenceExtrasKey } from "@/hooks/use-presence-extras";

/**
 * The posts, services, details and links cards rendered with the api's answers in the cache (PE-12): that a network which does not declare a
 * panel draws NOTHING, the states a merchant sees (loading, waiting for a connection, failed, empty, partial), what a role may press, what waits
 * is read from the change list, and that the network's name only ever comes from the api's label.
 * WHAT THIS CANNOT PROVE: a browser (static markup, no effect or click runs) or the api (every answer is a fixture).
 */

vi.mock("sonner", () => ({ toast: { success: () => undefined, error: () => undefined } }));
vi.mock("@/lib/api", () => ({ api: { get: async () => { throw new Error("no network in this test"); }, put: async () => undefined, post: async () => undefined } }));

const { PostsCard } = await import("@/components/presence/edit/posts-card");
const { ServicesCard } = await import("@/components/presence/edit/services-card");
const { DetailsCard } = await import("@/components/presence/edit/details-card");
const { LinksCard } = await import("@/components/presence/edit/links-card");

const NET = "net_a";
const WRITES = { released: true, notice: null };
const ALL = { posts: true, links: true, services: true, attributes: true };
const cap = (panels: Record<string, boolean> | undefined) => ({ network: NET, label: "NetA", writableFields: [], riskyFields: [], limits: {}, options: {}, ...(panels ? { panels } : {}), writes: WRITES });

const posts = (over: Record<string, unknown> = {}) => ({
  network: NET,
  label: "NetA",
  declaration: { kinds: ["update", "event"], actions: ["BOOK", "CALL"], actionWithoutUrl: "CALL", limits: { summaryMaxLength: 100 }, edit: true, removal: { restorable: false } },
  writes: WRITES,
  complete: true,
  items: [
    { ref: "p/1", kind: "update", summary: "Open late on Friday.", state: "live", languageCode: null, action: null, event: null, offer: null, createdAt: null, updatedAt: null, url: null, hasPhoto: false },
    { ref: "p/2", kind: "event", summary: "Join us.", state: "rejected", languageCode: null, action: { type: "BOOK", url: "https://a.example" }, event: { title: "Party", start: "2026-12-01" }, offer: null, createdAt: null, updatedAt: null, url: null, hasPhoto: true },
  ],
  ...over,
});
const services = (over: Record<string, unknown> = {}) => ({
  network: NET, label: "NetA", writes: WRITES, optionsNotice: null,
  current: [{ kind: "listed", id: "svc/coffee", description: "Hot" }, { kind: "custom", categoryId: "c", name: "Latte art" }],
  options: [{ id: "svc/coffee", label: "Coffee" }, { id: "svc/tea", label: "Tea" }],
  ...over,
});
const details = (over: Record<string, unknown> = {}) => ({
  network: NET, label: "NetA", writes: WRITES, optionsNotice: null,
  current: [{ id: "a/wifi", kind: "yesno", value: true }, { id: "a/retired", kind: "yesno", value: false }],
  options: [
    { id: "a/wifi", label: "Wi-Fi", kind: "yesno", values: [], deprecated: false },
    { id: "a/old", label: "Old thing", kind: "yesno", values: [], deprecated: true },
    { id: "a/seating", label: "Seating", kind: "choice", values: [{ value: "IN", label: "Indoor" }], deprecated: false },
  ],
  ...over,
});
const links = (over: Record<string, unknown> = {}) => ({
  network: NET, label: "NetA", writes: WRITES, types: [{ type: "BOOK", label: "Book a table" }],
  current: [{ type: "BOOK", uri: "https://a.example/book", preferred: true }],
  ...over,
});
const change = (over: Record<string, unknown> = {}) => ({
  id: "c1", listingId: "l1", network: NET, field: "posts", status: "validated", riskTier: "ordinary", notes: ["A note."], source: "form",
  before: { kind: "update", summary: "Open late on Friday.", ref: "p/1" }, after: { op: "delete", ref: "p/1" }, reason: null, held: null, validation: null,
  createdAt: "2026-11-06T10:00:00.000Z", expiresAt: "2026-11-09T10:00:00.000Z", submittedAt: null, liveAt: null, liveCheck: null, undone: false, undoable: false, ...over,
});

type Kind = "posts" | "services" | "attributes" | "links";
function render(Card: React.ComponentType<Record<string, unknown>>, field: Kind, o: { data?: unknown; panels?: Record<string, boolean> | "none"; can?: { propose: boolean; approve: boolean } | null; changes?: unknown[] | null; noCaps?: boolean } = {}) {
  const { data, panels = ALL, can = { propose: true, approve: true }, changes = [], noCaps = false } = o;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(presenceListingQueryKey(undefined, undefined), {
    setup: "ready",
    connection: { network: NET, label: "NetA", status: "active", locationName: "p", locations: [], lastSyncAt: null, lastError: null },
    listing: { id: "l1", name: "Shop", status: "active", description: null, primaryCategory: null, additionalCategories: [], contact: {}, address: null, geo: null, regularHours: [], specialHours: [], updatedAt: null },
    networks: [{ network: NET, label: "NetA", capabilities: {} }],
  });
  if (!noCaps) qc.setQueryData(presenceEditKeys.capabilities, { items: [cap(panels === "none" ? undefined : panels)], ...(can ? { can } : { can: undefined }) });
  if (changes) qc.setQueryData(presenceEditKeys.changes("l1"), { items: changes });
  if (data) qc.setQueryData(presenceExtrasKey(field, "l1", NET), data);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(Card)));
}

describe("a panel is drawn only for a network that declares it", () => {
  const cases: Array<[string, React.ComponentType<Record<string, unknown>>, Kind, unknown]> = [
    ["posts", PostsCard as never, "posts", posts()],
    ["services", ServicesCard as never, "services", services()],
    ["attributes", DetailsCard as never, "attributes", details()],
    ["links", LinksCard as never, "links", links()],
  ];
  it.each(cases)("%s: declared draws the card", (_n, Card, field, data) => {
    expect(render(Card, field, { data }).length).toBeGreaterThan(100);
  });
  it.each(cases)("%s: not declared draws nothing at all (no disabled control)", (_n, Card, field, data) => {
    expect(render(Card, field, { data, panels: { ...ALL, [field]: false } })).toBe("");
  });
  it.each(cases)("%s: an api that sends no panels draws nothing", (_n, Card, field, data) => {
    expect(render(Card, field, { data, panels: "none" })).toBe("");
  });
  it("one panel declared does not draw another", () => {
    expect(render(LinksCard as never, "links", { data: links(), panels: { posts: true, links: false, services: false, attributes: false } })).toBe("");
  });
  it("until the capabilities have answered it shows a skeleton and no panel's controls", () => {
    const html = render(PostsCard as never, "posts", { data: posts(), noCaps: true });
    expect(html).not.toContain(">Write a post<");
    expect(html).not.toContain(">Delete<");
  });
});

describe("the posts card", () => {
  it("lists each post with its state in the network's label, and the delete note says it cannot be brought back", () => {
    const html = render(PostsCard as never, "posts", { data: posts() });
    expect(html).toContain("Open late on Friday.");
    expect(html).toContain("Showing on NetA");
    expect(html).toContain("NetA did not publish this post.");
    expect(html).toContain("Peakhour cannot bring it back");
    expect(html).toContain("Has a photo (shown on NetA, not changed here)");
    expect(html.match(/>Edit</g)).toHaveLength(2);
    expect(html.match(/>Delete</g)).toHaveLength(2);
    expect(html).toContain(">Write a post<");
    expect(html).not.toContain("Google");
  });
  it("a network that does not let posts be edited offers delete only", () => {
    const html = render(PostsCard as never, "posts", { data: posts({ declaration: { ...posts().declaration, edit: false } }) });
    expect(html).not.toContain(">Edit<");
    expect(html).toContain(">Delete<");
  });
  it("a viewer sees the posts and no control, and is told it is their role", () => {
    const html = render(PostsCard as never, "posts", { data: posts(), can: { propose: false, approve: false } });
    expect(html).not.toContain(">Edit<");
    expect(html).not.toContain(">Delete<");
    expect(html).not.toContain(">Write a post<");
    expect(html).toContain("Your role can look at your posts but not change them");
  });
  it("a role that could not be read is not blamed on the role, and nothing can be changed", () => {
    const html = render(PostsCard as never, "posts", { data: posts(), can: null });
    expect(html).toContain("We could not check what your role can do");
    expect(html).not.toContain("Your role can look");
    expect(html).not.toContain(">Delete<");
  });
  it("what waits on a post is read from the change list: that post has no Edit or Delete and says what is waiting", () => {
    const html = render(PostsCard as never, "posts", { data: posts(), changes: [change()] });
    expect(html.match(/>Delete</g)).toHaveLength(1);
    expect(html).toContain("A change is waiting below. Approve or decline it there.");
    expect(html).toContain("This post will be removed");
  });
  it("until the change list has answered, writing and deleting are withheld and it says why", () => {
    const html = render(PostsCard as never, "posts", { data: posts(), changes: null });
    expect(html).not.toContain(">Write a post<");
    expect(html).not.toContain(">Delete<");
    expect(html).toContain("Checking your waiting posts changes...");
  });
  it("a partial list says so and still allows a new post", () => {
    const html = render(PostsCard as never, "posts", { data: posts({ complete: false }) });
    expect(html).toContain("may be missing some");
    expect(html).toContain(">Write a post<");
  });
  it("an empty list says there are no posts yet, and the switch-off notice is the api's words", () => {
    const html = render(PostsCard as never, "posts", { data: posts({ items: [], writes: { released: false, notice: "Nothing is sent to NetA yet." } }) });
    expect(html).toContain("You have no posts on NetA yet.");
    expect(html).toContain("Nothing is sent to NetA yet.");
  });
  it("with no read yet it shows a skeleton and, with nothing to show, no controls", () => {
    const html = render(PostsCard as never, "posts", {});
    expect(html).not.toContain(">Write a post<");
    expect(html).toContain("Your posts");
  });
});

describe("the services card", () => {
  it("lists what the network holds with the network's own names, offers only services not held, and each can be removed", () => {
    const html = render(ServicesCard as never, "services", { data: services() });
    expect(html).toContain("Coffee");
    expect(html).toContain("Latte art");
    expect(html).toContain("(Hot)");
    expect(html.match(/>Remove</g)).toHaveLength(2);
    expect(html).toContain(">Tea<");
    expect(html.match(/<option value="svc\/coffee"/g) ?? []).toHaveLength(0);
  });
  it("when the network's list did not load it says so, still shows what is held, and offers no add", () => {
    const html = render(ServicesCard as never, "services", { data: services({ options: null, optionsNotice: "We could not read NetA's list of services just now." }) });
    expect(html).toContain("We could not read NetA&#x27;s list of services just now.");
    expect(html).toContain("Adding a service is not available until the list loads.");
    expect(html).toContain("Latte art");
    expect(html).not.toContain("Add a service");
  });
  it("a viewer has no Remove; an empty list says so", () => {
    expect(render(ServicesCard as never, "services", { data: services(), can: { propose: false, approve: false } })).not.toContain(">Remove<");
    expect(render(ServicesCard as never, "services", { data: services({ current: [] }) })).toContain("You have no services on NetA yet.");
  });
  it("a waiting change blocks another and says so", () => {
    const html = render(ServicesCard as never, "services", { data: services(), changes: [change({ field: "services", before: [], after: [{ kind: "listed", id: "svc/tea" }] })] });
    expect(html).toContain("A change to your services is waiting below.");
    expect(html).not.toContain(">Remove<");
  });
});

describe("the details card", () => {
  it("offers each detail the network offers, never a deprecated one", () => {
    const html = render(DetailsCard as never, "attributes", { data: details() });
    expect(html).toContain("Wi-Fi");
    expect(html).toContain("Seating");
    expect(html).not.toContain("Old thing");
  });
  it("what is held but no longer offered is shown and can be removed, not edited", () => {
    const html = render(DetailsCard as never, "attributes", { data: details() });
    expect(html).toContain("no longer offered to change");
    expect(html).toContain("Retired: No");
    expect(html).toContain('aria-label="Remove Retired"');
  });
  it("when the network's list did not load, the held details are shown as lines and no editor is drawn", () => {
    const html = render(DetailsCard as never, "attributes", { data: details({ options: null, optionsNotice: "We could not read NetA's list of details just now." }) });
    expect(html).toContain("Changing details is not available until the list loads.");
    expect(html).toContain("Wifi: Yes");
    expect(html).not.toContain("<select");
    // nothing can be changed without the list, not even a removal
    expect(html).not.toContain("no longer offered to change");
    expect(html).not.toContain(">Remove<");
  });
  it("a viewer sees lines and no editor", () => {
    const html = render(DetailsCard as never, "attributes", { data: details(), can: { propose: false, approve: false } });
    expect(html).not.toContain("<select");
    expect(html).toContain("Wi-Fi: Yes");
  });
});

describe("the links card", () => {
  it("lists the links with the api's words, marks the preferred, and says a partner's are not touched", () => {
    const html = render(LinksCard as never, "links", { data: links() });
    expect(html).toContain("Book a table: https://a.example/book");
    expect(html).toContain("(preferred)");
    expect(html).toContain("Links that a partner provides are not shown here and are not changed.");
    expect(html).toContain(">Remove<");
    expect(html).not.toContain(">Make preferred<");
    expect(html).toContain(">Add link<");
  });
  it("a viewer has no controls; an empty list says so", () => {
    const html = render(LinksCard as never, "links", { data: links(), can: { propose: false, approve: false } });
    expect(html).not.toContain(">Remove<");
    expect(html).not.toContain(">Add link<");
    expect(render(LinksCard as never, "links", { data: links({ current: [] }) })).toContain("You have no booking or order links on NetA yet.");
  });
  it("a second link of a kind can be made preferred", () => {
    const html = render(LinksCard as never, "links", { data: links({ current: [{ type: "BOOK", uri: "https://a.example/1", preferred: true }, { type: "BOOK", uri: "https://a.example/2" }] }) });
    expect(html.match(/>Make preferred</g)).toHaveLength(1);
  });
});

describe("a panel lists its own network's changes", () => {
  it("another network's change is not listed under this one", () => {
    const html = render(PostsCard as never, "posts", { data: posts(), changes: [change({ id: "mine" }), change({ id: "other", network: "net_b", field: "posts" })] });
    expect(html.match(/This post will be removed/g)).toHaveLength(1);
  });
});
