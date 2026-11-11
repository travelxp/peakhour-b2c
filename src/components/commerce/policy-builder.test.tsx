import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CapabilitiesResponse, MarketCheck, PolicyPrice, Publication, Question, UploadSummary } from "@/lib/policy-builder";

// The views are pure given their data; the hook module is replaced so nothing here reaches the api or the auth provider.
const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, variables: undefined };
vi.mock("@/hooks/use-knowledge-base", () => ({
  useApprovePolicyDraft: () => mutation,
  useGeneratePolicy: () => mutation,
  useKbCapabilities: () => ({}),
  useKbPolicies: () => ({}),
  useKbPublications: () => ({}),
  usePolicyFindings: () => ({}),
  usePolicyPrice: () => ({}),
  usePolicyQuestions: () => ({}),
  usePublishEntry: () => mutation,
  useResolvePublication: () => mutation,
  useSavePolicyAnswers: () => mutation,
  useUnpublish: () => mutation,
  useUploadKnowledge: () => mutation,
  useUploadPrice: () => ({}),
}));
vi.mock("@/hooks/use-commerce-stores", () => ({ useCommerceStores: () => ({}) }));
vi.mock("@/components/drive/drive-picker", () => ({ DrivePicker: () => null }));
vi.mock("@/components/commerce/knowledge-base", () => ({ Highlighted: ({ text }: { text: string }) => <>{text}</> }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { UploadResultView } = await import("./policy-upload");
const { PriceCardView, MarketFindingsView, PublishPanelView, PublicationRow, QuestionField, PolicyList, WebsiteBand } = await import("./policy-builder");

const price = (over: Partial<PolicyPrice> = {}): PolicyPrice => ({
  peaks: 60,
  free: false,
  label: "Write a policy",
  token: "t",
  expiresAt: 9e12,
  balance: { unlimited: false, remaining: 200, enough: true },
  ready: true,
  policy: null,
  regenerate: false,
  chargedWhen: "a draft is delivered",
  ...over,
});

describe("price card", () => {
  it("shows the price and the balance before the click, with no top-up when the balance covers it", () => {
    const out = renderToStaticMarkup(<PriceCardView price={price()} />);
    expect(out).toContain("Price: 60 Peaks");
    expect(out).toContain("You have 200 Peaks.");
    expect(out).not.toContain("Add Peaks");
  });
  it("links the existing Peaks top-up page when the balance is short", () => {
    const out = renderToStaticMarkup(<PriceCardView price={price({ balance: { unlimited: false, remaining: 5, enough: false } })} />);
    expect(out).toContain('<a href="/dashboard/peaks">Add Peaks</a>');
    expect(out).toContain("which is not enough");
  });
  it("says writing again replaces an edited draft", () => {
    expect(renderToStaticMarkup(<PriceCardView price={price({ regenerate: true })} />)).toContain("replaces it, including any edits you made to it");
  });
});

describe("questions", () => {
  const q: Question = {
    fact: "dispatchDays",
    ask: "How many days after an order do you send it out?",
    help: "Orders should leave within this many days.",
    shape: { kind: "days", min: 0, max: 365 },
    prefill: [{ fact: "dispatchDays", kind: "dispatch_orders", source: "orders", value: 2, sampleSize: 300, note: "Your orders left in 2 days at the median" }],
    answer: 3,
    answerSource: { fact: "dispatchDays", source: "prefill:orders", sampleSize: 300 },
  };
  const render = (over: Partial<Parameters<typeof QuestionField>[0]> = {}) => renderToStaticMarkup(<QuestionField q={q} value="3" savedValue="3" onChange={() => {}} onUse={() => {}} {...over} />);
  it("shows the prefill with where it came from, and a Use button for a figure that differs from the box", () => {
    const out = render();
    expect(out).toContain("Your orders left in 2 days at the median (2)");
    expect(out).toContain('aria-label="Use 2 for: How many days after an order do you send it out?"');
    expect(out).toContain("Suggested from your orders, based on 300 orders");
  });
  it("hides Use once the box already holds the offered figure, and the source once the box has been edited", () => {
    expect(render({ value: "2", savedValue: "3" })).not.toContain(">Use this<");
    expect(render({ value: "9", savedValue: "3" })).not.toContain("based on 300 orders");
  });
  it("labels the box with its question and ties help and errors to it", () => {
    const out = render({ error: "Enter a number from 0 to 365." });
    expect(out).toMatch(/<label[^>]*for="([^"]+)"[^>]*>How many days/);
    expect(out).toContain('aria-invalid="true"');
    expect(out).toMatch(/aria-describedby="[^"]+-help [^"]+-err"/);
    expect(out).toContain('role="alert"');
  });
  it("offers context only (no Use button) for an offer with no value", () => {
    const ctx: Question = { ...q, prefill: [{ fact: "dispatchDays", kind: "dispatch_entry", source: "entry", sampleSize: 1, note: "Your shipping page mentions dispatch" }] };
    const out = renderToStaticMarkup(<QuestionField q={ctx} value="" savedValue="" onChange={() => {}} onUse={() => {}} />);
    expect(out).toContain("Your shipping page mentions dispatch");
    expect(out).not.toContain(">Use this<");
  });
});

describe("policy list", () => {
  it("draws one card per type with its status, and a Set up button only for a type with no row", () => {
    const rows = { returns: [{ id: "1", policyType: "returns", status: "active", markets: [], marketKey: "*", facts: {}, factSources: [] }], shipping: [{ id: "2", policyType: "shipping", status: "draft", markets: ["GB"], marketKey: "GB", facts: {}, factSources: [] }] };
    const data = Object.fromEntries(["returns", "refunds", "exchanges", "shipping", "cancellation", "cod", "warranty"].map((t) => [t, (rows as Record<string, unknown[]>)[t] ?? []]));
    const out = renderToStaticMarkup(<PolicyList data={data as never} open={null} onOpen={() => {}} />);
    expect(out.match(/aria-expanded="false"/g)?.length).toBe(7);
    expect(out).toContain("Live in your assistant");
    expect(out).toContain("Answers saved, not written yet");
    expect(out).toContain("For GB: answers saved");
    expect(out.match(/Not started/g)?.length).toBe(5);
    expect(out).toContain('aria-label="Set up refunds policy"');
    expect(out).toContain('aria-label="Open returns policy"');
  });
});

describe("market findings", () => {
  const f = (over: Record<string, unknown> = {}) => ({
    ruleKey: "gb-cooling-off",
    market: "GB",
    severity: "revisit",
    why: "Worth a revisit. Online sales in the UK usually carry a 14 day cancellation right.",
    suggestion: "State the 14 day cancellation right.",
    quote: "All sales are final.",
    source: { title: "UK Consumer Contracts Regulations", url: "https://www.legislation.gov.uk/uksi/2013/3134" },
    notLegalAdvice: "This is guidance, not legal advice.",
    ...over,
  });
  const check = (over: Partial<MarketCheck> = {}): MarketCheck => ({ findings: [f()], checked: ["GB"], unchecked: [], failed: [], splitMarkets: [], ...over });
  it("shows the finding in the api's words, the official source as a link, and the not legal advice line", () => {
    const out = renderToStaticMarkup(<MarketFindingsView check={check()} markets={["GB"]} />);
    expect(out).toContain("Worth a revisit");
    expect(out).toContain("All sales are final.");
    expect(out).toContain('href="https://www.legislation.gov.uk/uksi/2013/3134"');
    expect(out).toContain("UK Consumer Contracts Regulations");
    expect(out).toContain("This is guidance, not legal advice.");
    expect(out).not.toMatch(/illegal/i);
  });
  it("never draws a source link for an unsafe address, and still carries the line", () => {
    const out = renderToStaticMarkup(<MarketFindingsView check={check({ findings: [f({ source: { title: "x", url: "javascript:alert(1)" } })] })} markets={["GB"]} />);
    expect(out).not.toContain("javascript:");
    expect(out).toContain("not legal advice");
  });
  it("puts a tip under its own heading, apart from the important ones", () => {
    const out = renderToStaticMarkup(<MarketFindingsView check={check({ findings: [f({ ruleKey: "a", severity: "important" }), f({ ruleKey: "b", severity: "tip" })] })} markets={[]} />);
    expect(out.indexOf("Look at these first")).toBeLessThan(out.indexOf("Tips"));
    expect(out).toMatch(/data-kb-severity="tip"/);
  });
  it("says so when nothing was flagged", () => {
    expect(renderToStaticMarkup(<MarketFindingsView check={check({ findings: [] })} markets={[]} />)).toContain("found nothing to flag");
  });
  it("offers a separate policy per market when the api names the split, and not for a single-market policy", () => {
    const split = check({ splitMarkets: ["GB", "IN"] });
    const out = renderToStaticMarkup(<MarketFindingsView check={split} markets={[]} onSplit={() => {}} />);
    expect(out).toContain("Write one for United Kingdom");
    expect(out).toContain("Write one for India");
    expect(renderToStaticMarkup(<MarketFindingsView check={split} markets={["GB"]} onSplit={() => {}} />)).not.toContain("Write one for");
  });
  it("says a market could not be checked", () => {
    expect(renderToStaticMarkup(<MarketFindingsView check={check({ failed: ["IN"] })} markets={[]} />)).toContain("could not check India");
  });
});

// -- publishing -----------------------------------------------------------------------------------------------------

const caps: CapabilitiesResponse = {
  channels: [
    {
      channel: "site",
      label: "Acme site",
      connections: [
        {
          id: "c1",
          label: "acme.example",
          slots: [
            { slot: "page", allowed: false, reason: "not_supported", message: "Update the Peakhour plugin on acme.example to publish pages." },
            { slot: "faq", allowed: true },
            { slot: "legal_policy", allowed: false, reason: "grant_missing", recheckable: false, policyTypes: ["returns"] },
          ],
        },
      ],
    },
  ],
};
const pub = (over: Partial<Publication> = {}): Publication => ({ id: "e1.abc", channel: "site", slot: "faq", store: "acme.example", state: "live", url: "https://acme.example/faq", publishedAt: null, checkedAt: null, error: null, outdated: false, entryStatus: "active", ...over });

describe("publish panel", () => {
  const render = (over: Partial<Parameters<typeof PublishPanelView>[0]> = {}) => renderToStaticMarkup(<PublishPanelView entryId="e1" caps={caps} publications={[]} checking={false} checkFailed={false} ctx={{ policyType: "returns", markets: [] }} {...over} />);
  it("draws a button for the allowed slot only, with the others as notes", () => {
    const out = render();
    expect(out).toContain("Publish to the FAQ");
    expect(out).toMatch(/<button[^>]*>(?:<!-- -->)?Publish to the FAQ/);
    expect(out).toContain("Update the Peakhour plugin on acme.example to publish pages.");
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Publish as a page to acme.example"/);
    expect(out).toContain("Reconnect it and approve the permissions");
    expect(out).toContain('href="/dashboard/integrations"');
  });
  it("gives the FAQ help, and promises nothing from a search engine", () => {
    const out = render();
    expect(out).toContain("Peakhour FAQ block");
    expect(out).not.toMatch(/rich result/i);
  });
  it("hides the store-wide policy slot for a policy of another type or for chosen markets", () => {
    expect(render({ ctx: { policyType: "warranty", markets: [] } })).not.toContain("Publish as your store policy");
    expect(render({ ctx: { policyType: "returns", markets: ["GB"] } })).not.toContain("Publish as your store policy");
    expect(render({ ctx: { policyType: "returns", markets: [] } })).toContain("Publish as your store policy");
  });
  it("with no capabilities draws no button, and says to connect", () => {
    const out = render({ caps: { channels: [] } });
    expect(out).not.toMatch(/<button[^>]*>(?:<!-- -->)?Publish/);
    expect(out).toContain("Connect your website or store");
  });
  it("says Publish again for a slot that is already out, and hides the button for a changed one (the banner settles it)", () => {
    expect(render({ publications: [pub()] })).toContain("Publish again");
    const out = render({ publications: [pub({ state: "diverged" })] });
    expect(out).not.toMatch(/<button[^>]*>(?:<!-- -->)?Publish (again|to the FAQ)/);
    expect(out).toContain("data-kb-diverged");
  });
});

describe("divergence banner", () => {
  const render = (p: Publication) => renderToStaticMarkup(<PublicationRow pub={p} caps={caps} />);
  it("says the site's text was changed, offers both ways out, and overwrote nothing", () => {
    const out = render(pub({ state: "diverged" }));
    expect(out).toContain("You changed this on acme.example after Peakhour published it.");
    expect(out).toContain("Nothing was overwritten");
    expect(out).toContain("Keep Peakhour&#x27;s");
    expect(out).toContain("Keep mine");
    expect(out).toContain('href="https://acme.example/faq"');
  });
  it("on a store policy states that keep mine then needs Write my policy again", () => {
    expect(render(pub({ state: "diverged", slot: "legal_policy" }))).toContain("use Write my policy first");
    expect(render(pub({ state: "diverged", slot: "page" }))).not.toContain("use Write my policy first");
  });
  it("shows no banner for a live copy, and offers to take it off", () => {
    const out = render(pub());
    expect(out).not.toContain("data-kb-diverged");
    expect(out).toContain("Take it off");
    expect(out).toContain("Live on acme.example as the FAQ.");
  });
  it("never links an unsafe address", () => {
    expect(render(pub({ url: "javascript:alert(1)" }))).not.toContain("javascript:");
  });
});

describe("website band", () => {
  it("says where to connect when nothing is connected, and not when something is", () => {
    expect(renderToStaticMarkup(<WebsiteBand caps={{ channels: [] }} />)).toContain("Connect your website");
    const out = renderToStaticMarkup(<WebsiteBand caps={caps} />);
    expect(out).toContain("Publish your policies to your website");
    expect(out).not.toContain("Connect your website</a>");
  });
});

describe("upload result", () => {
  const result = (over: Partial<UploadSummary> = {}): UploadSummary => ({
    source: { kind: "drive", label: "returns.pdf" },
    truncated: false,
    entries: { drafted: 1, replaced: 0, evidenceAdded: 0, unchanged: 0, skippedForCap: 0 },
    policies: [],
    conflicts: [{ policyType: "returns", fact: "windowDays", kept: 30, found: 14 }],
    delivered: 1,
    ...over,
  });
  it("lists the drafts it created and the conflicts, keeping the merchant's answer", () => {
    const out = renderToStaticMarkup(<UploadResultView result={result()} />);
    expect(out).toContain("1 suggested answer was added under Suggested answers");
    expect(out).toContain("Returns, window days: you have 30, the document says 14. Yours was kept.");
    expect(out).toContain('role="status"');
  });
});
