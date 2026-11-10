import { describe, it, expect, vi } from "vitest";
import {
  APPROVED_LINE,
  FINDINGS_EMPTY,
  LEGAL_LINE,
  approveState,
  basedOnLine,
  findingFooter,
  groupFindings,
  isImportedPolicy,
  isLegal,
  placeholdersIn,
  realityLine,
  routedLines,
  runApprove,
  shopifyPoliciesHref,
  sortSuggestions,
  splitPlaceholders,
  suggestionAskedLine,
  type KbFinding,
} from "./knowledge-base";

const NOW = Date.parse("2026-11-10T12:00:00Z");

describe("placeholdersIn (the api's rule: [1-120 chars, one line])", () => {
  it("PASS: finds each bracketed detail in order", () => {
    expect(placeholdersIn("Returns within [your return window in days] days to [your returns address].")).toEqual(["[your return window in days]", "[your returns address]"]);
  });
  it("ignores empty brackets, nested brackets, a bracket split across lines and over-long ones", () => {
    expect(placeholdersIn("a [] b [x\ny] c")).toEqual([]);
    expect(placeholdersIn(`[${"x".repeat(121)}]`)).toEqual([]);
    expect(placeholdersIn(`[${"x".repeat(120)}]`)).toHaveLength(1);
    expect(placeholdersIn("a [[b]] c")).toEqual(["[b]"]);
  });
  it("splits text into plain and placeholder runs that rejoin to the text", () => {
    const t = "Ship in [days] days. Thanks [x]";
    const parts = splitPlaceholders(t);
    expect(parts.map((p) => p.text).join("")).toBe(t);
    expect(parts.filter((p) => p.placeholder).map((p) => p.text)).toEqual(["[days]", "[x]"]);
    expect(splitPlaceholders("")).toEqual([]);
  });
});

describe("approveState: the placeholder guard", () => {
  it("PASS: allowed with a title, an answer and no placeholder", () => {
    expect(approveState("Returns", "30 days.")).toEqual({ enabled: true });
  });
  it("is blocked, with a reason in words, while a placeholder is in the answer", () => {
    const s = approveState("Returns", "Within [your return window in days] days.");
    expect(s.enabled).toBe(false);
    expect(s.enabled === false && s.reason).toMatch(/square brackets/);
  });
  it("is blocked by a placeholder in the title too, and counts several", () => {
    expect(approveState("[topic]", "ok").enabled).toBe(false);
    const s = approveState("T", "[a] and [b]");
    expect(s.enabled === false && s.reason).toContain("2 details");
  });
  it("is allowed again once every one is filled", () => {
    expect(approveState("T", "Within 30 days.").enabled).toBe(true);
  });
  it("blocks an empty title, an empty answer and an over-long one, each with its own reason", () => {
    expect(approveState(" ", "x")).toMatchObject({ enabled: false, reason: expect.stringContaining("title") });
    expect(approveState("t", "  ")).toMatchObject({ enabled: false, reason: expect.stringContaining("answer") });
    expect(approveState("t", "x".repeat(8193)).enabled).toBe(false);
    expect(approveState("t", "x".repeat(8192)).enabled).toBe(true);
  });
});

describe("sortSuggestions", () => {
  const s = (id: string, timesAsked: number, lastAskedAt: string | null) => ({ id, timesAsked, lastAskedAt });
  it("most asked first, then most recent, then id; does not mutate", () => {
    const input = [s("b", 2, "2026-11-01"), s("a", 2, "2026-11-01"), s("c", 14, null), s("d", 2, "2026-11-05")];
    expect(sortSuggestions(input).map((x) => x.id)).toEqual(["c", "d", "a", "b"]);
    expect(input[0]!.id).toBe("b");
  });
});

describe("suggestionAskedLine", () => {
  it("says how many times and when", () => {
    expect(suggestionAskedLine({ timesAsked: 14, lastAskedAt: "2026-11-08T12:00:00Z" }, NOW)).toBe("Asked 14 times · last asked 2 days ago");
    expect(suggestionAskedLine({ timesAsked: 1, lastAskedAt: "2026-11-09T12:00:00Z" }, NOW)).toBe("Asked once · last asked yesterday");
    expect(suggestionAskedLine({ timesAsked: 3, lastAskedAt: "2026-11-10T01:00:00Z" }, NOW)).toBe("Asked 3 times · last asked today");
  });
  it("leaves the time out when there is none", () => {
    expect(suggestionAskedLine({ timesAsked: 3, lastAskedAt: null }, NOW)).toBe("Asked 3 times");
    expect(suggestionAskedLine({ timesAsked: 3, lastAskedAt: "garbage" }, NOW)).toBe("Asked 3 times");
  });
});

describe("basedOnLine", () => {
  it("quotes the evidence, caps the count, and is null with none", () => {
    expect(basedOnLine([])).toBeNull();
    expect(basedOnLine([{ kind: "reply", ref: "r", quote: "  " }])).toBeNull();
    expect(basedOnLine([{ kind: "reply", ref: "r", quote: "We accept returns in 30 days" }])).toBe('Based on: "We accept returns in 30 days"');
    const many = Array.from({ length: 5 }, (_, i) => ({ kind: "fact" as const, ref: `r${i}`, quote: `q${i}` }));
    expect(basedOnLine(many)).toContain("and 2 more");
  });
});

describe("routedLines", () => {
  const r = (product: number, support: number) => ({
    product_info: { count: product, topics: [], destination: "catalog_manager" as const },
    support: { count: support, topics: [], destination: "inbox" as const },
  });
  it("PASS: both lines, linked to the existing pages", () => {
    expect(routedLines(r(12, 5))).toEqual([
      { text: "12 questions were about products:", linkLabel: "improve them in Catalog Manager", href: "/dashboard/commerce/catalog" },
      { text: "5 were support problems:", linkLabel: "see Inbox", href: "/dashboard/inbox" },
    ]);
  });
  it("says one in the singular, and nothing for zero or no answer", () => {
    expect(routedLines(r(1, 1)).map((l) => l.text)).toEqual(["1 question was about products:", "1 was a support problem:"]);
    expect(routedLines(r(0, 0))).toEqual([]);
    expect(routedLines(undefined)).toEqual([]);
  });
});

const finding = (over: Partial<KbFinding>): KbFinding => ({
  id: "f",
  checkKind: "unclear",
  severity: "revisit",
  why: "w",
  suggestion: "s",
  state: "open",
  lastSeenAt: "2026-11-09T00:00:00Z",
  ...over,
});

describe("groupFindings: severity grouping and tip separation", () => {
  it("orders important, revisit, tip; keeps the api order inside a group; drops empty groups", () => {
    const g = groupFindings([
      finding({ id: "1", severity: "tip" }),
      finding({ id: "2", severity: "important" }),
      finding({ id: "3", severity: "revisit" }),
      finding({ id: "4", severity: "important" }),
    ]);
    expect(g.map((x) => x.severity)).toEqual(["important", "revisit", "tip"]);
    expect(g[0]!.findings.map((f) => f.id)).toEqual(["2", "4"]);
    expect(groupFindings([finding({ severity: "tip" })]).map((x) => x.severity)).toEqual(["tip"]);
    expect(groupFindings([])).toEqual([]);
  });
  it("★a tip is never in the same group as a legal finding", () => {
    const legalTip = finding({ id: "t", severity: "tip", checkKind: "legal" });
    const legal = finding({ id: "l", severity: "revisit", checkKind: "legal" });
    for (const g of groupFindings([legalTip, legal])) {
      expect(g.findings.some((f) => f.severity === "tip") && g.findings.some((f) => f.severity !== "tip")).toBe(false);
    }
  });
  it("shows an unknown severity as a revisit rather than dropping it", () => {
    expect(groupFindings([finding({ id: "x", severity: "weird" })])).toEqual([{ severity: "revisit", findings: [expect.objectContaining({ id: "x" })] }]);
  });
});

describe("findingFooter: the legal line", () => {
  it("★PASS: a legal finding carries the guidance line and its source link", () => {
    const f = finding({ checkKind: "legal", evidence: { sourceUrl: "https://www.acc.gov.au/x", sourceTitle: "Refunds" } });
    expect(findingFooter(f)).toEqual({ legalLine: LEGAL_LINE, sourceHref: "https://www.acc.gov.au/x", sourceLabel: "Refunds" });
    expect(LEGAL_LINE).toBe("This is guidance, not legal advice.");
  });
  it("★a legal finding still carries the line when its source address is unsafe or missing, and no link", () => {
    expect(findingFooter(finding({ checkKind: "legal", evidence: { sourceUrl: "javascript:alert(1)" } }))).toEqual({ legalLine: LEGAL_LINE, sourceHref: null, sourceLabel: null });
    expect(findingFooter(finding({ checkKind: "legal" })).legalLine).toBe(LEGAL_LINE);
  });
  it("a finding with an official source is treated as legal whatever its kind", () => {
    expect(isLegal(finding({ checkKind: "missing", evidence: { sourceUrl: "https://x.gov/y" } }))).toBe(true);
    expect(findingFooter(finding({ checkKind: "missing", evidence: { sourceUrl: "https://x.gov/y" } })).legalLine).toBe(LEGAL_LINE);
  });
  it("gives a non-legal finding no legal line", () => {
    expect(findingFooter(finding({ checkKind: "template" }))).toEqual({ legalLine: null, sourceHref: null, sourceLabel: null });
  });
  it("names a source with no title plainly", () => {
    expect(findingFooter(finding({ checkKind: "legal", evidence: { sourceUrl: "https://x.gov/y" } })).sourceLabel).toBe("Official source");
  });
});

describe("realityLine: a reality check renders from its fields", () => {
  it("lists the claims; null for any other kind or without claims", () => {
    expect(realityLine(finding({ checkKind: "reality", evidence: { claims: ["ships in 2 days"] } }))).toBe("Your answer says: ships in 2 days");
    expect(realityLine(finding({ checkKind: "reality" }))).toBeNull();
    expect(realityLine(finding({ checkKind: "legal", evidence: { claims: ["x"] } }))).toBeNull();
  });
});

describe("imported policy actions", () => {
  it("only an imported, read-only entry offers Edit in Shopify and Take over", () => {
    expect(isImportedPolicy({ readOnly: true, source: "import" })).toBe(true);
    expect(isImportedPolicy({ readOnly: false, source: "owner" })).toBe(false);
    expect(isImportedPolicy(undefined)).toBe(false);
  });
  it("the Shopify policies link is built from a checked handle, never a given URL", () => {
    expect(shopifyPoliciesHref("acme.myshopify.com")).toBe("https://admin.shopify.com/store/acme/settings/legal");
    expect(shopifyPoliciesHref("evil.com/x")).toBeNull();
    expect(shopifyPoliciesHref(null)).toBeNull();
  });
});

describe("the words", () => {
  it("avoid internal terms and the legal words", () => {
    const all = [APPROVED_LINE, FINDINGS_EMPTY, LEGAL_LINE].join(" ");
    expect(all).not.toMatch(/illegal|violation|draft|topicKey|gapClass|fingerprint|checkKind/i);
    expect(APPROVED_LINE).toBe("Approved. Your assistant now answers this on every channel.");
  });
});

describe("runApprove: the page wiring", () => {
  it("sends the EDITED words, trimmed", async () => {
    const send = vi.fn().mockResolvedValue({});
    await expect(runApprove(send, "  Returns ", " Within 30 days. ")).resolves.toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith({ title: "Returns", content: "Within 30 days." });
  });
  it("★sends nothing while a placeholder remains, and says why", async () => {
    const send = vi.fn();
    const r = await runApprove(send, "Returns", "In [days] days.");
    expect(send).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
  });
  it("shows the api's own sentence when it refuses (409)", async () => {
    const send = vi.fn().mockRejectedValue(new Error("This suggestion was changed while you were approving it. Reload it and try again."));
    await expect(runApprove(send, "T", "C")).resolves.toEqual({ ok: false, error: "This suggestion was changed while you were approving it. Reload it and try again." });
  });
  it("falls back to a plain sentence for an error with no message", async () => {
    const send = vi.fn().mockRejectedValue("boom");
    const r = await runApprove(send, "T", "C");
    expect(r).toEqual({ ok: false, error: expect.stringContaining("did not save") });
  });
});
