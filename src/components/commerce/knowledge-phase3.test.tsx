import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CandidatesResponse, CoverageResponse, PolicyEvidence } from "@/lib/knowledge-phase3";
import { setSections } from "@/lib/knowledge-phase3";
import type { CapabilitiesResponse } from "@/lib/policy-builder";

// The views are pure given their data; the hook module is replaced so nothing here reaches the api or the auth provider.
const state: { caps: unknown; coverage: unknown } = { caps: {}, coverage: {} };
vi.mock("@/hooks/use-knowledge-base", () => ({
  useKbBenchmarks: () => ({}),
  useKbCandidates: () => ({}),
  useKbCapabilities: () => state.caps,
  useKbCoverage: () => state.coverage,
  useKbEvidence: () => ({}),
  usePublishSet: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { BenchmarksView, ConversationStarters, CoverageMap, CoverageView, EvidenceView, StarterSectionView } = await import("./knowledge-phase3");

describe("benchmarks card", () => {
  it("links the benchmarks page when not joined, and says the figures are not advice when they are shown", () => {
    expect(renderToStaticMarkup(<BenchmarksView standing={{ state: "unavailable", reason: "not_consented" }} />)).toContain('<a href="/dashboard/growth/learning">Go to Benchmarks</a>');
    const out = renderToStaticMarkup(
      <BenchmarksView standing={{ state: "ready", figures: [{ state: "compared", key: "return_window", label: "your return window", sentence: "Most stores like yours give 15 to 30 days for returns; you give 14." }] }} />,
    );
    expect(out).toContain("you give 14.");
    expect(out).toContain("not advice");
  });
  it("shows the too-small sentence and no link", () => {
    const out = renderToStaticMarkup(<BenchmarksView standing={{ state: "too_small" }} />);
    expect(out).toContain("Not enough stores like yours yet to compare.");
    expect(out).not.toContain("<a ");
  });
});

const evidence = (over: Partial<PolicyEvidence> = {}): PolicyEvidence => ({
  order: { id: "o1", name: "#1001", number: 1001, placedAtUtc: "2026-11-12T14:05:00.000Z", placedAtLocal: "12 Nov 2026, 19:35 (Asia/Kolkata)", timeZone: "Asia/Kolkata", timeZoneNote: null },
  policies: [
    { title: "Returns policy", channel: "shopify", channelLabel: "Shopify", slot: "legal_policy", target: "legal_policy:s:p", kind: "published", text: "Return within 14 days.", hash: "abc123", recordedAt: "2026-11-01T10:00:00.000Z", firstRecordAt: "2026-10-01T10:00:00.000Z", textMayBeCut: false, sentence: "Published by Peakhour to Shopify." },
    { title: "Shipping policy", channel: "shopify", channelLabel: "Shopify", slot: "legal_policy", target: "legal_policy:s:q", kind: "no_record_before", text: null, hash: null, recordedAt: null, firstRecordAt: "2026-11-10T10:00:00.000Z", textMayBeCut: false, sentence: "Peakhour has no record of your Shipping policy before 10 Nov 2026." },
  ],
  noRecord: false,
  summary: "1 policy was on record as live when this order was placed.",
  notes: ["This is a record of what Peakhour holds, not legal advice."],
  generatedAtUtc: "2026-11-12T15:00:00.000Z",
  ...over,
});

describe("evidence view", () => {
  it("shows the text, live since, channel and target, both times, the hash, the notes and a download button", () => {
    const out = renderToStaticMarkup(<EvidenceView evidence={evidence()} order="#1001" />);
    expect(out).toContain("Return within 14 days.");
    expect(out).toContain("Live since 1 Nov 2026, 15:30 (Asia/Kolkata)");
    expect(out).toContain("Shopify, your store policy");
    expect(out).toContain("Target: legal_policy:s:p");
    expect(out).toContain("12 Nov 2026, 19:35 (Asia/Kolkata), which is 12 Nov 2026, 14:05 (UTC)");
    expect(out).toContain("Hash: abc123");
    expect(out).toContain("Download as a file");
    expect(out).toContain("not legal advice");
  });
  it("says no record before the date, plainly, with no text", () => {
    const out = renderToStaticMarkup(<EvidenceView evidence={evidence()} order="#1001" />);
    expect(out).toContain("No record before 10 Nov 2026, 15:30 (Asia/Kolkata)");
  });
  it("says so when there is nothing at all", () => {
    expect(renderToStaticMarkup(<EvidenceView evidence={evidence({ policies: [], noRecord: true })} order="1" />)).toContain("no policy record to show");
  });
});

const section = (over: Partial<ReturnType<typeof setSections>[number]> = {}) => ({ ...setSections({ channels: [{ channel: "meta", label: "Facebook", connections: [{ id: "c1", label: "My Page", slots: [{ slot: "ice_breakers_messenger" as const, allowed: true }] }] }] })[0], ...over });
const cands: CandidatesResponse = {
  slot: "ice_breakers_messenger",
  maxEntries: 4,
  candidates: [
    { id: "e1", title: "Where is my order?", timesAsked: 12, lastAskedAt: null, fits: true, published: true },
    { id: "e2", title: "A title that is far too long to fit", timesAsked: 5, lastAskedAt: null, fits: false, published: false },
    { id: "e3", title: "Do you ship abroad?", timesAsked: 1, lastAskedAt: null, fits: true, published: false },
  ],
};
const view = (over: Partial<Parameters<typeof StarterSectionView>[0]> = {}) => (
  <StarterSectionView section={section()} data={cands} loading={false} failed={false} onRetry={() => {}} picked={["e1"]} onToggle={() => {}} replace={false} onReplace={() => {}} busy={false} onPublish={() => {}} outcome={null} error={null} {...over} />
);

describe("conversation starters", () => {
  it("shows the candidates most-asked first with how often, what is out now, and the replace choice", () => {
    const out = renderToStaticMarkup(view());
    expect(out).toContain("Messenger conversation starters");
    expect(out.indexOf("Where is my order?")).toBeLessThan(out.indexOf("Do you ship abroad?"));
    expect(out).toContain("Asked 12 times");
    expect(out).toContain("on your Page now");
    expect(out).toContain("Replace what is on the Page");
    expect(out).toContain("Publish to Messenger");
  });
  it("disables a title that does not fit and says why", () => {
    const out = renderToStaticMarkup(view());
    expect(out).toMatch(/disabled=""[^>]*aria-describedby="[^"]*e2"/);
    expect(out).toContain("too long to fit there");
  });
  it("disables unticked boxes once the most is chosen", () => {
    const four: CandidatesResponse = { ...cands, maxEntries: 1 };
    const out = renderToStaticMarkup(view({ data: four, picked: ["e1"] }));
    expect(out).toContain("You have chosen 1");
  });
  it("shows Meta not having approved messaging as a note, with no controls and no request for candidates", () => {
    const s = section({ enabled: false, note: "Messenger messages are not open yet: Peakhour is waiting for Meta to approve messaging, so ice breakers cannot be published." });
    const out = renderToStaticMarkup(view({ section: s, data: undefined }));
    expect(out).toContain("waiting for Meta");
    expect(out).not.toContain("checkbox");
    expect(out).not.toContain("<button");
  });
  it("shows each entry's outcome, the refusal in words, and what was taken down", () => {
    const out = renderToStaticMarkup(
      view({
        outcome: {
          removedLine: "Took down 1 question that was there before.",
          lines: [
            { entryId: "e1", title: "Where is my order?", tone: "ok", text: "Published." },
            { entryId: "e3", title: "Do you ship abroad?", tone: "bad", text: "This title is 90 characters and the most that fits there is 80. Shorten the title." },
          ],
        },
      }),
    );
    expect(out).toContain("Took down 1 question");
    expect(out).toContain("Published.");
    expect(out).toContain("the most that fits there is 80");
  });
  it("draws nothing for a business with no such slot, and the section for one with it", () => {
    state.caps = { data: { channels: [{ channel: "shopify", label: "Shopify", connections: [{ id: "c", label: "S", slots: [{ slot: "page", allowed: true }] }] }] } satisfies { channels: CapabilitiesResponse["channels"] } };
    expect(renderToStaticMarkup(<ConversationStarters />)).toBe("");
    state.caps = { data: { channels: [{ channel: "meta", label: "Facebook", connections: [{ id: "c", label: "My Page", slots: [{ slot: "ice_breakers_instagram", allowed: false, reason: "not_supported", message: "Meta has not approved messaging yet." }] }] }] } };
    const out = renderToStaticMarkup(<ConversationStarters />);
    expect(out).toContain("Instagram conversation starters");
    expect(out).toContain("Meta has not approved messaging yet.");
  });
});

const coverage: CoverageResponse = {
  days: 30,
  topics: [
    { key: "a", label: "Shipping time", asked: 3, covered: true, entryId: "e1" },
    { key: "b", label: "Gift wrap", asked: 9, covered: false, requestId: "r1" },
  ],
  answeredRate: { channels: ["whatsapp", "web"], weeks: [{ weekStart: "2026-11-02", asked: 10, answered: 7 }] },
  notes: ["Only questions in the chats Peakhour can see are counted."],
};

describe("coverage map", () => {
  it("lists topics by times asked, marks covered or not, links the uncovered one, and labels the channels counted", () => {
    const out = renderToStaticMarkup(<CoverageView data={coverage} />);
    expect(out.indexOf("Gift wrap")).toBeLessThan(out.indexOf("Shipping time"));
    expect(out).toContain("Not covered");
    expect(out).toContain("Covered");
    expect(out).toContain('href="/dashboard/inbox?tab=insights&amp;type=missing_info"');
    expect(out).toContain("Counted on: WhatsApp and Website chat.");
    expect(out).toContain("70%");
    expect(out).toContain("Week of 2 Nov");
    expect(out).toContain("Only questions in the chats");
  });
  it("hides the whole section when the route is not there, and shows no error", () => {
    state.coverage = { hidden: true, isError: true, isLoading: false, error: { status: 404 } };
    expect(renderToStaticMarkup(<CoverageMap />)).toBe("");
  });
  it("shows a real failure with a retry", () => {
    state.coverage = { hidden: false, isError: true, isLoading: false, data: undefined, refetch: vi.fn() };
    const out = renderToStaticMarkup(<CoverageMap />);
    expect(out).toContain("Could not load what shoppers ask about.");
    expect(out).toContain("Try again");
  });
  it("shows the section when the api answers", () => {
    state.coverage = { hidden: false, isError: false, isLoading: false, data: coverage };
    expect(renderToStaticMarkup(<CoverageMap />)).toContain("What shoppers ask about");
  });
});
