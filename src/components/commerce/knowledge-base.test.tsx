import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { KbFinding, KbSuggestionsResponse } from "@/lib/knowledge-base";

// The views are pure given their data; the hook module is replaced so nothing here reaches the api or the auth provider.
const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
vi.mock("@/hooks/use-knowledge-base", () => ({
  useAnswerKbRequest: () => mutation,
  useApproveSuggestion: () => mutation,
  useCreateKbEntry: () => mutation,
  useDismissKbRequest: () => mutation,
  useDismissSuggestion: () => mutation,
  useFindingAction: () => mutation,
  useKbEntries: () => ({}),
  useKbEntryAction: () => mutation,
  useKbFindings: () => ({}),
  useKbRequests: () => ({}),
  useKbSuggestions: () => ({}),
  useSaveSuggestion: () => mutation,
  useUpdateKbEntry: () => mutation,
}));
vi.mock("@/hooks/use-commerce-stores", () => ({ useCommerceStores: () => ({}) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { SuggestionsView, FindingsView, MoreFindings } = await import("./knowledge-base");

const NOW = Date.parse("2026-11-10T12:00:00Z");
const suggestion = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  title: "What is your return window?",
  content: "You can return items within [your return window in days] days.",
  topic: "Returns",
  origin: "request" as const,
  evidence: [{ kind: "reply" as const, ref: "r1", quote: "Returns are fine within a month" }],
  needsFacts: ["What is your return window in days?"],
  hasPlaceholders: true,
  timesAsked: 14,
  lastAskedAt: "2026-11-08T12:00:00Z",
  requestCount: 3,
  draftedAt: null,
  ...over,
});
const routedNone = { product_info: { count: 0, topics: [], destination: "catalog_manager" as const }, support: { count: 0, topics: [], destination: "inbox" as const } };
const render = (data: KbSuggestionsResponse) => renderToStaticMarkup(<SuggestionsView data={data} now={NOW} onApproved={() => {}} onFailed={() => {}} />);

describe("Suggested answers", () => {
  it("shows the card: asked line, based on, what it needs, the placeholder highlighted, and Approve disabled with its reason", () => {
    const out = render({ suggestions: [suggestion()], routed: routedNone });
    expect(out).toContain("Asked 14 times · last asked 2 days ago");
    expect(out).toContain("Based on: ");
    expect(out).toContain("What is your return window in days?");
    expect(out).toMatch(/<mark[^>]*data-kb-placeholder[^>]*>\[your return window in days\]<\/mark>/);
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="kb-sg-s1-reason"[^>]*>(?:<!-- -->)?Approve/);
    expect(out).toContain('id="kb-sg-s1-reason"');
    expect(out).toContain("Fill in the detail in [square brackets] to approve.");
    for (const label of ["Save without approving", "Dismiss"]) expect(out).toContain(label);
  });
  it("enables Approve when nothing is left to fill in", () => {
    const out = render({ suggestions: [suggestion({ content: "Within 30 days.", hasPlaceholders: false })], routed: routedNone });
    expect(out).not.toContain("kb-sg-s1-reason");
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*>(?:<!-- -->)?Approve/);
  });
  it("lists them in the api's order, as it arrives", () => {
    const out = render({ suggestions: [suggestion({ id: "a", title: "First" }), suggestion({ id: "b", title: "Second" })], routed: routedNone });
    expect(out.indexOf("First")).toBeLessThan(out.indexOf("Second"));
  });
  it("★says where a store-details draft came from, never Asked 0 times", () => {
    const out = render({ suggestions: [suggestion({ timesAsked: 0, lastAskedAt: null, origin: "generator" })], routed: routedNone });
    expect(out).toContain("Suggested from your store details");
    expect(out).not.toMatch(/Asked 0/);
  });
  it("says the plain empty sentence, with no card", () => {
    const out = render({ suggestions: [], routed: routedNone });
    expect(out).toContain("data-kb-suggestions-empty");
    expect(out).toContain("No suggested answers right now.");
    expect(out).not.toContain("Approve");
  });
  it("shows the routed lines with links to the existing pages, even with no suggestion", () => {
    const out = render({
      suggestions: [],
      routed: { product_info: { count: 12, topics: [], destination: "catalog_manager" }, support: { count: 5, topics: [], destination: "inbox" } },
    });
    expect(out).toContain("12 questions were about products:");
    expect(out).toContain('href="/dashboard/commerce/catalog"');
    expect(out).toContain("5 were support problems:");
    expect(out).toContain('href="/dashboard/inbox"');
  });
});

const finding = (over: Partial<KbFinding>): KbFinding => ({
  id: "f1",
  checkKind: "legal",
  severity: "revisit",
  quote: "No returns, ever.",
  why: "Shoppers in your market usually have a right to a refund for faulty goods.",
  suggestion: "Faulty items can be returned for a refund.",
  evidence: { sourceUrl: "https://www.accc.gov.au/refunds", sourceTitle: "ACCC refunds" },
  state: "open",
  lastSeenAt: "2026-11-09T00:00:00Z",
  ...over,
});
const findings = (list: KbFinding[], view: "open" | "dismissed" = "open", entries = [] as never[], shop: string | null = null) =>
  renderToStaticMarkup(<FindingsView data={{ findings: list }} view={view} entries={entries} shop={shop} />);

describe("Policy health", () => {
  it("shows the quote, why, the rewrite with Copy and Dismiss", () => {
    const out = findings([finding({})]);
    expect(out).toContain("No returns, ever.");
    expect(out).toContain("Faulty items can be returned for a refund.");
    expect(out).toContain("Copy");
    expect(out).toContain("Dismiss");
    expect(out).not.toContain("Reopen");
  });
  it("★a legal finding links its source and says it is not legal advice; never says illegal or violation", () => {
    const out = findings([finding({})]);
    expect(out).toContain('href="https://www.accc.gov.au/refunds"');
    expect(out).toContain("This is guidance, not legal advice.");
    expect(out).not.toMatch(/illegal|violation/i);
  });
  it("★a tip sits under its own heading, apart from the legal finding", () => {
    const out = findings([finding({ id: "a" }), finding({ id: "b", severity: "tip", checkKind: "unclear", evidence: undefined, quote: "Tip quote" })]);
    expect(out).toContain('data-kb-severity="revisit"');
    expect(out).toContain('data-kb-severity="tip"');
    expect(out.indexOf("Worth a revisit")).toBeLessThan(out.indexOf("Tips"));
    const tipPart = out.slice(out.indexOf('data-kb-severity="tip"'));
    expect(tipPart).not.toContain("not legal advice");
  });
  it("offers Reopen, not Dismiss, in the dismissed view; and the plain empty sentences", () => {
    expect(findings([finding({ state: "dismissed" })], "dismissed")).toContain("Reopen");
    expect(findings([])).toContain("We check your policies regularly.");
    expect(findings([], "dismissed")).toContain("You have not dismissed anything.");
  });
  it("on an imported Shopify policy offers Edit in Shopify and Take over; on an owner entry neither", () => {
    const imported = { id: "e1", title: "Refunds", content: "", tags: [], source: "import", status: "active", channels: [], readOnly: true, managedIn: "Shopify", url: null, syncedAt: null, createdAt: null, updatedAt: null } as never;
    const out = findings([finding({ entryId: "e1" })], "open", [imported], "acme.myshopify.com");
    expect(out).toContain('href="https://admin.shopify.com/store/acme/settings/legal"');
    expect(out).toContain("Edit in Shopify");
    expect(out).toContain("Take over in Peakhour");
    const owner = findings([finding({ entryId: "e1" })], "open", [{ ...(imported as object), source: "owner", readOnly: false } as never], "acme.myshopify.com");
    expect(owner).not.toContain("Take over in Peakhour");
    expect(owner).not.toContain("Edit in Shopify");
  });
  it("★Edit in Shopify only when the policy is managed in Shopify; Take over still shows", () => {
    const other = { id: "e1", title: "Refunds", content: "", tags: [], source: "import", status: "active", channels: [], readOnly: true, managedIn: "its source", url: null, syncedAt: null, createdAt: null, updatedAt: null } as never;
    const out = findings([finding({ entryId: "e1" })], "open", [other], "acme.myshopify.com");
    expect(out).not.toContain("Edit in Shopify");
    expect(out).toContain("Take over in Peakhour");
  });
  it("a contradiction names the other entry and its claims", () => {
    const out = findings([finding({ checkKind: "contradiction", evidence: { claims: ["30 days"], otherEntryTitle: "Shipping", otherQuote: "7 days" } })]);
    expect(out).toContain("Your answer says: 30 days");
    expect(out).toContain("Also in &quot;Shipping&quot;");
    expect(out).not.toContain("not legal advice");
  });
  it("renders a reality check generically from its fields", () => {
    const out = findings([finding({ checkKind: "reality", evidence: { claims: ["ships in 2 days"] } })]);
    expect(out).toContain("Your answer says: ships in 2 days");
    expect(out).not.toContain("not legal advice");
  });
});

describe("Findings past one page", () => {
  const more = (over: Partial<Parameters<typeof MoreFindings>[0]> = {}) =>
    renderToStaticMarkup(<MoreFindings shown={100} total={130} hasMore loading={false} failed={false} onMore={() => {}} {...over} />);
  it("says Showing 100 of 130 and offers Show more", () => {
    const out = more();
    expect(out).toContain("Showing 100 of 130");
    expect(out).toContain("Show more");
  });
  it("says nothing when everything is shown", () => {
    expect(more({ shown: 130 })).toBe("");
  });
  it("says so when the next page failed, and keeps the button to retry", () => {
    const out = more({ failed: true });
    expect(out).toContain("Could not load more.");
    expect(out).toContain("Show more");
  });
});
