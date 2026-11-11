import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { newActionKey } from "@/lib/api";
import {
  DRAFT_OUT_OF_DATE,
  FAQ_HELP,
  KEEP_THEIRS_POLICY_NOTE,
  POLICY_TYPES,
  approvedLine,
  buildSaveBody,
  clickHeaders,
  conflictLine,
  generateErrorLine,
  generatedLine,
  marketCheckLines,
  marketsKey,
  marketsParam,
  parseAnswer,
  parseMarketsBox,
  policyStatus,
  priceCard,
  publicationLine,
  publicationFor,
  publishButtons,
  newAnswersForm,
  reconcileAnswers,
  publishErrorLine,
  quoteLapsed,
  resolvedLine,
  runPolicyApprove,
  slotFits,
  sourceLine,
  splitOffer,
  uploadBody,
  uploadResultLines,
  valueToRaw,
  type CapabilitiesResponse,
  type PolicyPrice,
  type Publication,
  type Question,
  type UploadSummary,
} from "./policy-builder";

const price = (over: Partial<PolicyPrice> = {}): PolicyPrice => ({
  peaks: 60,
  free: false,
  label: "Write a policy",
  token: "signed.quote",
  expiresAt: 2_000,
  balance: { unlimited: false, remaining: 200, enough: true },
  ready: true,
  policy: { id: "p1", status: "draft", marketKey: "*" },
  regenerate: false,
  chargedWhen: "a draft is delivered",
  ...over,
});

describe("policy status", () => {
  it("is not started with no row, answers saved with only a draft, live with an active row", () => {
    expect(policyStatus(undefined)).toBe("not_started");
    expect(policyStatus([])).toBe("not_started");
    expect(policyStatus([{ status: "draft" }])).toBe("answers_saved");
    expect(policyStatus([{ status: "draft" }, { status: "active" }])).toBe("live");
  });
  it("lists the seven types the api serves", () => {
    expect([...POLICY_TYPES]).toEqual(["returns", "refunds", "exchanges", "shipping", "cancellation", "cod", "warranty"]);
  });
});

describe("answers", () => {
  const days = { kind: "days", min: 0, max: 365 } as const;
  it("a blank box is an unanswered fact, never zero", () => {
    expect(parseAnswer(days, "  ")).toEqual({ ok: true, value: undefined });
    expect(parseAnswer(days, "0")).toEqual({ ok: true, value: 0 });
  });
  it("holds each shape to the api's bounds", () => {
    expect(parseAnswer(days, "30")).toEqual({ ok: true, value: 30 });
    expect(parseAnswer(days, "366").ok).toBe(false);
    expect(parseAnswer(days, "2.5").ok).toBe(false);
    expect(parseAnswer(days, "abc").ok).toBe(false);
    expect(parseAnswer({ kind: "percent", min: 0, max: 100 }, "12.5")).toEqual({ ok: true, value: 12.5 });
    expect(parseAnswer({ kind: "yesno" }, "yes")).toEqual({ ok: true, value: true });
    expect(parseAnswer({ kind: "yesno" }, "no")).toEqual({ ok: true, value: false });
    expect(parseAnswer({ kind: "choice", options: [{ value: "a", label: "A" }] }, "b").ok).toBe(false);
    expect(parseAnswer({ kind: "time" }, "09:30")).toEqual({ ok: true, value: "09:30" });
    expect(parseAnswer({ kind: "time" }, "9:30").ok).toBe(false);
    expect(parseAnswer({ kind: "list", maxItems: 2, maxLength: 5 }, "a\nb\nc").ok).toBe(false);
    expect(parseAnswer({ kind: "list", maxItems: 5, maxLength: 5 }, "a\n\nb")).toEqual({ ok: true, value: ["a", "b"] });
    expect(parseAnswer({ kind: "text", maxLength: 3 }, "abcd").ok).toBe(false);
  });
  it("takes country codes in any case, once each", () => {
    expect(parseAnswer({ kind: "markets", maxItems: 250 }, "gb, in")).toEqual({ ok: true, value: ["GB", "IN"] });
    expect(parseAnswer({ kind: "markets", maxItems: 250 }, "GB, GB").ok).toBe(false);
    expect(parseAnswer({ kind: "markets", maxItems: 250 }, "GBR").ok).toBe(false);
    expect(parseMarketsBox("")).toEqual({ ok: true, markets: [] });
    expect(parseMarketsBox("us")).toEqual({ ok: true, markets: ["US"] });
  });
  it("round-trips a saved answer into its box", () => {
    expect(valueToRaw({ kind: "yesno" }, true)).toBe("yes");
    expect(valueToRaw({ kind: "yesno" }, undefined)).toBe("");
    expect(valueToRaw({ kind: "list", maxItems: 3, maxLength: 9 }, ["a", "b"])).toBe("a\nb");
    expect(valueToRaw(days, 14)).toBe("14");
  });
});

describe("saving answers", () => {
  const qs: Question[] = [
    { fact: "accepted", ask: "Do you accept returns?", shape: { kind: "yesno" }, prefill: [{ fact: "accepted", kind: "refund_share", source: "orders", value: true, sampleSize: 40, note: "Customers returned items in 4% of orders" }] },
    { fact: "windowDays", ask: "How many days?", shape: { kind: "days", min: 0, max: 365 }, prefill: [] },
  ];
  it("leaves blanks out and sends only an accepted offer that still equals what was offered", () => {
    const r = buildSaveBody(qs, { accepted: "yes", windowDays: "" }, new Set(["accepted"]), []);
    expect(r).toEqual({ ok: true, body: { facts: { accepted: true }, acceptedPrefill: ["accepted"] } });
    // changed after accepting: it is the merchant's answer now
    const changed = buildSaveBody(qs, { accepted: "no", windowDays: "" }, new Set(["accepted"]), []);
    expect(changed).toEqual({ ok: true, body: { facts: { accepted: false } } });
  });
  it("sends the market set only when there is one", () => {
    const r = buildSaveBody(qs, { accepted: "yes", windowDays: "30" }, new Set(), ["IN", "GB"]);
    expect(r.ok && r.body.markets).toEqual(["IN", "GB"]);
  });
  it("names the answer that is wrong, and refuses an empty save", () => {
    const bad = buildSaveBody(qs, { accepted: "", windowDays: "999" }, new Set(), []);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(Object.keys(bad.errors)).toEqual(["windowDays"]);
      expect(bad.summary).toBe("Check the answer marked below.");
    }
    const none = buildSaveBody(qs, {}, new Set(), []);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.summary).toBe("Answer at least one question before saving.");
  });
  it("sorts the markets for the query string", () => {
    expect(marketsParam(["IN", "GB"])).toEqual({ markets: "GB,IN" });
    expect(marketsParam([])).toEqual({});
  });
  it("says where an answer came from", () => {
    expect(sourceLine({ fact: "x", source: "merchant" })).toBe("Your answer");
    expect(sourceLine({ fact: "x", source: "prefill:orders", sampleSize: 1200 })).toBe("Suggested from your orders, based on 1,200 orders");
    expect(sourceLine({ fact: "x", source: "upload:url" })).toBe("From the page you added");
    expect(sourceLine(undefined)).toBeNull();
  });
});

describe("the price card", () => {
  it("shows the price first, and says it is charged only on delivery", () => {
    const c = priceCard(price());
    expect(c.price).toBe("60 Peaks");
    expect(c.lines[0]).toContain("charged only when a draft is delivered");
    expect(c.short).toBe(false);
  });
  it("offers the top-up when the balance is short, and says how much you have", () => {
    const c = priceCard(price({ balance: { unlimited: false, remaining: 10, enough: false } }));
    expect(c.short).toBe(true);
    expect(c.lines.join(" ")).toContain("You have 10 Peaks, which is not enough.");
  });
  it("never shows 0 Peaks for a free task, and says nothing of a balance when unlimited", () => {
    const c = priceCard(price({ free: true, peaks: 0, balance: { unlimited: true, remaining: null, enough: true } }));
    expect(c.price).toBe("Free");
    expect(c.lines.join(" ")).not.toContain("0 Peaks");
    expect(c.lines).toHaveLength(1);
  });
  it("says so when the balance could not be read", () => {
    expect(priceCard(price({ balance: null })).lines.join(" ")).toContain("could not check your Peaks balance");
  });
  it("says that writing again replaces an edited draft and is charged again", () => {
    const c = priceCard(price({ regenerate: true }));
    expect(c.lines.join(" ")).toContain("replaces it, including any edits you made to it, and is charged again");
  });
  it("blocks writing until the answers are saved", () => {
    expect(priceCard(price({ ready: false })).needsAnswers).toBe(true);
  });
  it("treats a lapsed quote as lapsed", () => {
    expect(quoteLapsed({ expiresAt: 1_000 }, 1_000)).toBe(true);
    expect(quoteLapsed({ expiresAt: 1_000 }, 999)).toBe(false);
  });
});

describe("one click, one charge", () => {
  it("sends a fresh Idempotency-Key on each click and the quote that was shown", () => {
    const a = clickHeaders("signed.quote", newActionKey);
    const b = clickHeaders("signed.quote", newActionKey);
    expect(a["Idempotency-Key"]).toMatch(/^click-/);
    expect(a["Idempotency-Key"]).not.toBe(b["Idempotency-Key"]);
    expect(a["x-peaks-quote"]).toBe("signed.quote");
  });
  it("sends no empty quote header when there is no token", () => {
    expect("x-peaks-quote" in clickHeaders(undefined, newActionKey)).toBe(false);
    expect("x-peaks-quote" in clickHeaders("", newActionKey)).toBe(false);
  });
  it("mints the key inside the call, so a retry is a new click (source check on the hooks)", () => {
    const src = readFileSync(fileURLToPath(new URL("../hooks/use-knowledge-base.ts", import.meta.url)), "utf8");
    expect(src).toContain("clickHeaders(quoteToken, newActionKey)");
    // never a key held across clicks
    expect(src).not.toMatch(/const\s+\w*[kK]ey\s*=\s*newActionKey\(\)/);
    expect((src.match(/clickHeaders\(quoteToken, newActionKey\)/g) ?? []).length).toBe(2);
  });
});

describe("writing: refusals in plain words", () => {
  it("offers the top-up on CREDITS_EXHAUSTED and says nothing was charged", () => {
    const l = generateErrorLine({ code: "CREDITS_EXHAUSTED", message: "You need 60 and have 10." });
    expect(l.topUp).toBe(true);
    expect(l.message).toContain("You need 60 and have 10.");
    expect(l.message).toContain("nothing was charged");
  });
  it("asks for a fresh price when the quote is not honoured", () => {
    const l = generateErrorLine({ code: "QUOTE_NOT_HONOURED", message: "x" });
    expect(l.refreshPrice).toBe(true);
    expect(l.message).toContain("Nothing was charged");
  });
  it("words the rest", () => {
    expect(generateErrorLine({ code: "ACT_ALREADY_RUNNING" }).message).toContain("already being written");
    expect(generateErrorLine({ code: "NOT_FOUND" }).message).toContain("save them first");
    expect(generateErrorLine({ code: "GENERATION_FAILED", message: "We could not write this policy just now." }).message).toBe("We could not write this policy just now.");
    expect(generateErrorLine(new Error("boom")).message).toBe("boom");
    expect(generateErrorLine(undefined).message).toContain("Nothing was charged");
  });
  it("says a deduped draft was not charged again, and a charged one what it cost", () => {
    const base = { drafted: true as const, peaks: 60, entry: { id: "e", title: "t", content: "c" }, policy: { id: "p", status: "draft", markets: [], marketKey: "*" }, needsFacts: [], replaced: false, marketCheck: "done" as const, marketFindings: null };
    expect(generatedLine({ ...base, charged: false, deduped: true, peaks: 0 })).toContain("Nothing more was charged");
    expect(generatedLine({ ...base, charged: true })).toContain("60 Peaks were charged");
    expect(generatedLine({ ...base, charged: true, replaced: true })).toContain("the earlier draft was replaced");
    expect(generatedLine({ ...base, charged: true })).toContain("does not use it until you approve it");
  });
});

describe("market findings", () => {
  it("says what was not checked and what failed", () => {
    const l = marketCheckLines({ findings: [], checked: ["*"], unchecked: ["IN"], failed: ["GB"], splitMarkets: [] });
    expect(l[0]).toContain("did not check India");
    expect(l[1]).toContain("could not check United Kingdom");
  });
  it("offers a separate policy per market only for a policy that covers several or every market", () => {
    const c = { splitMarkets: ["GB", "IN"] };
    expect(splitOffer(c, [])?.markets).toEqual(["GB", "IN"]);
    expect(splitOffer(c, ["GB", "IN"])?.markets).toEqual(["GB", "IN"]);
    expect(splitOffer(c, ["GB"])).toBeNull();
    expect(splitOffer({ splitMarkets: [] }, [])).toBeNull();
  });
});

describe("approving", () => {
  it("is honest that approving replaces the store's imported page in chat, and that it stays on the store", () => {
    const l = approvedLine({ supersededImported: [{ id: "1", title: "Refund policy" }] });
    expect(l).toContain("replaces the store page");
    expect(l).toContain("Refund policy");
    expect(l).toContain("stays on your store");
  });
  it("says so when the imported page could not be retired", () => {
    expect(approvedLine({ supersededImported: null })).toContain("still has both");
  });
  it("says nothing extra when nothing was replaced", () => {
    expect(approvedLine({ supersededImported: [] })).toBe("Approved. Your assistant now answers from this policy on every channel.");
    expect(approvedLine({})).toBe("Approved. Your assistant now answers from this policy on every channel.");
  });
  it("does not send a draft with a [placeholder] left, and sends the trimmed words otherwise", async () => {
    const send = vi.fn().mockResolvedValue({ entry: { id: "e", title: "t", content: "c" }, answered: 0 });
    const blocked = await runPolicyApprove(send, "Returns", "Within [your window] days.");
    expect(blocked.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
    const ok = await runPolicyApprove(send, "  Returns ", " Within 30 days. ");
    expect(ok.ok).toBe(true);
    expect(send).toHaveBeenCalledWith({ title: "Returns", content: "Within 30 days." });
  });
  it("on a 409 says the answers changed, to write it again", async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error("The answers this policy was written from have changed."), { status: 409 }));
    const r = await runPolicyApprove(send, "Returns", "Within 30 days.");
    expect(r).toMatchObject({ ok: false, stale: true });
    if (!r.ok) {
      expect(r.error).toContain("have changed");
      expect(r.error).toContain("Write it again");
    }
  });
  it("on another failure shows the api's sentence and is not stale", async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error("You have reached 200 entries."), { status: 400 }));
    const r = await runPolicyApprove(send, "Returns", "Within 30 days.");
    expect(r).toEqual({ ok: false, error: "You have reached 200 entries.", stale: false });
  });
});

describe("upload", () => {
  it("takes one Drive file or one page address", () => {
    expect(uploadBody({ driveFileId: " abc " })).toEqual({ ok: true, body: { driveFileId: "abc" } });
    expect(uploadBody({ url: " https://shop.example/returns " })).toEqual({ ok: true, body: { url: "https://shop.example/returns" } });
    expect(uploadBody({}).ok).toBe(false);
    expect(uploadBody({ url: "javascript:alert(1)" }).ok).toBe(false);
    expect(uploadBody({ url: "shop.example" }).ok).toBe(false);
  });
  const summary = (over: Partial<UploadSummary> = {}): UploadSummary => ({
    source: { kind: "url", label: "shop.example" },
    truncated: false,
    entries: { drafted: 2, replaced: 0, evidenceAdded: 1, unchanged: 0, skippedForCap: 0 },
    policies: [{ policyType: "returns", added: ["windowDays", "accepted"], saved: true }],
    conflicts: [{ policyType: "shipping", fact: "dispatchDays", kept: 2, found: 5 }],
    delivered: 3,
    ...over,
  });
  it("says what it created and that nothing is live until approved", () => {
    const l = uploadResultLines(summary());
    expect(l[0]).toContain("2 suggested answers were added");
    expect(l[0]).toContain("Nothing is live until you approve it");
    expect(l.join(" ")).toContain("2 answers were added to your returns policy answers");
  });
  it("reports a conflict, keeping the merchant's answer", () => {
    expect(conflictLine(summary().conflicts[0]!)).toBe("Shipping, dispatch days: you have 2, the document says 5. Yours was kept.");
  });
  it("says a long page was cut", () => {
    expect(uploadResultLines(summary({ truncated: true })).join(" ")).toContain("longer than we read at once");
  });
});

// -- publishing -----------------------------------------------------------------------------------------------------

/** A fixture with two channels. Neither name is known to the code under test: it draws what it is given. */
const caps: CapabilitiesResponse = {
  channels: [
    {
      channel: "shopify",
      label: "Shopify",
      connections: [
        {
          id: "c1",
          label: "acme.myshopify.com",
          slots: [
            { slot: "page", allowed: true },
            { slot: "faq", allowed: false, reason: "not_released" },
            { slot: "legal_policy", allowed: false, reason: "grant_missing", recheckable: true, policyTypes: ["returns", "shipping"] },
          ],
        },
      ],
    },
    {
      channel: "wordpress",
      label: "WordPress",
      connections: [
        {
          id: "c2",
          label: "acme.example",
          slots: [
            { slot: "page", allowed: false, reason: "not_supported", message: "Update the Peakhour plugin on acme.example to publish pages." },
            { slot: "faq", allowed: true },
            { slot: "legal_policy", allowed: true, policyTypes: ["returns"] },
          ],
        },
      ],
    },
  ],
};

describe("publish buttons are drawn from the capabilities", () => {
  it("draws nothing without capabilities", () => {
    expect(publishButtons(undefined)).toEqual([]);
    expect(publishButtons({ channels: [] })).toEqual([]);
  });
  it("draws a working button for an allowed slot (and for a recheckable missing grant), ordered page, FAQ, store policy", () => {
    const b = publishButtons(caps);
    expect(b.filter((x) => x.enabled).map((x) => `${x.channel}:${x.slot}`)).toEqual(["shopify:page", "wordpress:faq", "shopify:legal_policy", "wordpress:legal_policy"]);
    expect(b.map((x) => x.slot)).toEqual(["page", "page", "faq", "faq", "legal_policy", "legal_policy"]);
  });
  it("shows a not-released slot as a note, not a button", () => {
    const b = publishButtons(caps).find((x) => x.channel === "shopify" && x.slot === "faq")!;
    expect(b.enabled).toBe(false);
    expect(b.note).toContain("not available yet");
  });
  it("shows the api's own message for a site that cannot take the slot yet", () => {
    const b = publishButtons(caps).find((x) => x.channel === "wordpress" && x.slot === "page")!;
    expect(b.enabled).toBe(false);
    expect(b.note).toBe("Update the Peakhour plugin on acme.example to publish pages.");
    expect(b.reapprove).toBe(false);
  });
  it("shows the re-approve prompt for a missing grant, and keeps the button when the channel can be asked again", () => {
    const b = publishButtons(caps).find((x) => x.channel === "shopify" && x.slot === "legal_policy")!;
    expect(b.reapprove).toBe(true);
    expect(b.enabled).toBe(true);
    expect(b.note).toContain("Reconnect it and approve the permissions");
    const unrecheckable = publishButtons({ channels: [{ channel: "x", label: "X", connections: [{ id: "1", label: "x", slots: [{ slot: "page", allowed: false, reason: "grant_missing" }] }] }] })[0]!;
    expect(unrecheckable.enabled).toBe(false);
  });
  it("gives the FAQ slot its how-to-add help and promises no search result", () => {
    const b = publishButtons(caps).find((x) => x.slot === "faq")!;
    expect(b.help).toBe(FAQ_HELP);
    expect(FAQ_HELP).toContain("We do not promise any search-engine result");
    expect(FAQ_HELP).not.toMatch(/rich result/i);
  });
  it("offers a store-wide policy slot only for a policy of its types, for every market", () => {
    const slot = { slot: "legal_policy" as const, allowed: true, policyTypes: ["returns", "shipping"] };
    expect(slotFits(slot, { policyType: "returns", markets: [] })).toBe(true);
    expect(slotFits(slot, { policyType: "warranty", markets: [] })).toBe(false);
    expect(slotFits(slot, { policyType: "returns", markets: ["GB"] })).toBe(false);
    // an entry of unknown kind is offered it: the api refuses a non-policy in words
    expect(slotFits(slot, {})).toBe(true);
    expect(slotFits({ slot: "page", allowed: true }, { policyType: "warranty", markets: ["GB"] })).toBe(true);
  });
  it("the code under test names no channel", () => {
    const src = readFileSync(fileURLToPath(new URL("./policy-builder.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/word\s*press/i);
    const view = readFileSync(fileURLToPath(new URL("../components/commerce/policy-builder.tsx", import.meta.url)), "utf8");
    expect(view).not.toMatch(/word\s*press/i);
  });
});

describe("publish refusals in plain words", () => {
  it("words every code the api sends", () => {
    for (const code of ["GRANT_MISSING", "NOT_RELEASED", "NOT_SUPPORTED", "MARKET_SCOPED", "NOT_A_POLICY", "POLICY_TYPE_UNSUPPORTED", "CANNOT_REMOVE", "TARGET_TAKEN", "IMPORTED"]) {
      const l = publishErrorLine({ code, message: "" });
      expect(l.message.length, code).toBeGreaterThan(20);
      expect(l.message, code).not.toMatch(/[A-Z]{3,}_[A-Z]{3,}/);
    }
  });
  it("prompts a reconnect for a missing grant", () => {
    expect(publishErrorLine({ code: "GRANT_MISSING" }).reapprove).toBe(true);
    expect(publishErrorLine({ code: "MARKET_SCOPED" }).reapprove).toBe(false);
  });
  it("keeps the api's sentence where it names something (a plugin version, the other entry)", () => {
    expect(publishErrorLine({ code: "NOT_SUPPORTED", message: "Update the Peakhour plugin to 1.26.0." }).message).toBe("Update the Peakhour plugin to 1.26.0.");
    expect(publishErrorLine({ code: "TARGET_TAKEN", message: 'Another entry ("Returns") already publishes to that page.' }).message).toContain("Returns");
  });
  it("falls back to the api's message for a code it does not know, then a plain sentence", () => {
    expect(publishErrorLine({ code: "WHAT", message: "Odd." }).message).toBe("Odd.");
    expect(publishErrorLine({}).message).toBe("That did not publish. Please try again.");
  });
});

describe("publications", () => {
  const pub = (over: Partial<Publication> = {}): Publication => ({ id: "p", channel: "wordpress", slot: "page", store: "acme.example", state: "live", url: "https://acme.example/returns", publishedAt: null, checkedAt: null, error: null, outdated: false, entryStatus: "active", ...over });
  it("says live, out of date, changed on the site, failed and no-longer-live", () => {
    expect(publicationLine(pub(), "WordPress")).toEqual({ text: "Live on acme.example as a page.", tone: "ok" });
    expect(publicationLine(pub({ outdated: true }), "WordPress").text).toContain("your text has changed since");
    expect(publicationLine(pub({ state: "diverged" }), "WordPress").text).toContain("Changed on acme.example after Peakhour published it");
    expect(publicationLine(pub({ state: "failed", error: "Refused." }), "WordPress")).toMatchObject({ tone: "bad" });
    expect(publicationLine(pub({ entryStatus: "archived" }), "WordPress").text).toContain("no longer live in your assistant");
  });
  it("after keep mine on a store policy says it needs Write my policy again; on a page it does not", () => {
    expect(resolvedLine("theirs", "legal_policy")).toContain(KEEP_THEIRS_POLICY_NOTE);
    expect(KEEP_THEIRS_POLICY_NOTE).toContain("Write my policy");
    expect(resolvedLine("theirs", "page")).not.toContain("Write my policy");
    expect(resolvedLine("ours", "page")).toBe("Peakhour's text is back on your site.");
  });
});

describe("review round 1", () => {
  it("takes plain decimal digits only: 0x10 and 1e3 are not a number of days", () => {
    const days = { kind: "days", min: 0, max: 365 } as const;
    for (const bad of ["0x10", "1e2", "-1", "+5", ".5", "5."]) expect(parseAnswer(days, bad).ok, bad).toBe(false);
    expect(parseAnswer({ kind: "money", min: 0, max: 10_000_000 }, "12.50")).toEqual({ ok: true, value: 12.5 });
  });
  it("says a days bound with a plain number, not as Peaks", () => {
    const r = parseAnswer({ kind: "money", min: 0, max: 10_000_000 }, "99999999");
    expect(r).toEqual({ ok: false, error: "Enter a number from 0 to 10,000,000." });
  });
  it("a market set is one key whatever the order", () => {
    expect(marketsKey(["IN", "GB"])).toBe(marketsKey(["GB", "IN"]));
    expect(marketsKey([])).toBe("*");
  });
  it("two stores on one channel are told apart: a copy on A does not mark B as published or diverged", () => {
    const pubs = [{ channel: "site", slot: "page" as const, store: "a.example", state: "diverged" }];
    expect(publicationFor(pubs, { channel: "site", slot: "page", connectionLabel: "a.example" })?.state).toBe("diverged");
    expect(publicationFor(pubs, { channel: "site", slot: "page", connectionLabel: "b.example" })).toBeUndefined();
    expect(publicationFor([{ channel: "site", slot: "page" as const, store: null }], { channel: "site", slot: "page", connectionLabel: "a.example" })).toBeUndefined();
  });
  describe("the answers form follows the saved answers when they change, and never the merchant's edits", () => {
    const form = (raw: Record<string, string>, saved: Record<string, string>, server = saved) => ({ raw, saved, server, stale: false });
    it("takes a server change when nothing was edited (an upload landed), and calls it external", () => {
      const r = reconcileAnswers(form({ a: "1", b: "" }, { a: "1", b: "" }), { a: "1", b: "5" });
      expect(r.form).toEqual({ raw: { a: "1", b: "5" }, saved: { a: "1", b: "5" }, server: { a: "1", b: "5" }, stale: false });
      expect(r.external).toBe(true);
      expect(r.changed).toEqual(["b"]);
    });
    it("keeps an edited box, takes the untouched ones, and says the saved answers changed", () => {
      const r = reconcileAnswers(form({ a: "9", b: "" }, { a: "1", b: "" }), { a: "2", b: "5" });
      expect(r.form.raw).toEqual({ a: "9", b: "5" });
      expect(r.form.saved).toEqual({ a: "2", b: "5" });
      expect(r.form.stale).toBe(true);
    });
    it("does nothing while the server has not changed, however far the form moved ahead (a save is shown before its refetch lands)", () => {
      // the merchant saved 30: saved is 30 at once, the server still says 14 until the refetch
      const ahead = form({ w: "30" }, { w: "30" }, { w: "14" });
      const r = reconcileAnswers(ahead, { w: "14" });
      expect(r.form).toBe(ahead);
      expect(r.form.raw).toEqual({ w: "30" });
    });
    it("a refetch that confirms the merchant's own save is not external, and does not mark a draft out of date", () => {
      const r = reconcileAnswers(form({ w: "30" }, { w: "30" }, { w: "14" }), { w: "30" });
      expect(r.external).toBe(false);
      expect(r.form.raw).toEqual({ w: "30" });
      expect(r.form.server).toEqual({ w: "30" });
    });
    it("is the same object when nothing changed (no render loop)", () => {
      const f = form({ a: "1" }, { a: "1" });
      expect(reconcileAnswers(f, { a: "1" }).form).toBe(f);
    });
    it("starts equal to the server", () => {
      expect(newAnswersForm({ a: "1" })).toEqual({ raw: { a: "1" }, saved: { a: "1" }, server: { a: "1" }, stale: false });
    });
  });
  it("names why Approve is off after the answers changed", () => {
    expect(DRAFT_OUT_OF_DATE).toContain("write the policy again");
  });
});
