import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ApiError } from "@/lib/api";
import type { GoogleWebsiteConversionAction, GoogleWebsiteTagSnippet } from "@/lib/api/google-ads";
import {
  GOOGLE_WEBSITE_TAG_HOW_TO,
  GOOGLE_WEBSITE_CONVERSION_GONE,
  GOOGLE_WEBSITE_CONVERSION_PRIMARY_WARNING,
  GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE,
  PEAKHOUR_WEBSITE_CONVERSION_LABEL,
  googleWebsiteConversionConfirmation,
  googleWebsiteConversionErrorMessage,
  googleWebsiteConversionGoalNote,
  googleWebsiteConversionNeedsReconnect,
  googleWebsiteConversionSavedSentence,
  googleWebsiteConversionState,
  googleWebsiteEventSnippetHowTo,
  googleWebsiteEventSnippetLabel,
  googleWebsiteSnippetKey,
  googleWebsiteSnippetLabel,
  orderedSnippets,
} from "./google-website-conversion-view";

/** G-14f — every sentence and decision of the "Website conversion tag" section. */

const snip = (type: string, pageFormat: string, tag = `<script>${type}/${pageFormat}</script>`): GoogleWebsiteTagSnippet => ({
  type,
  pageFormat,
  globalSiteTag: tag,
  eventSnippet: `<script>gtag('event', 'conversion', {'send_to': 'AW-1/x'});</script>\n<!-- ${type} -->`,
});
const action = (over: Partial<GoogleWebsiteConversionAction> = {}): GoogleWebsiteConversionAction => ({
  id: "888",
  name: "Peakhour website purchases",
  primaryForGoal: false,
  tagSnippets: [snip("WEBPAGE", "HTML")],
  ...over,
});
const idle = "idle" as const;
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("★★the double count: why it is secondary, said wherever the merchant meets it", () => {
  it("★the note says secondary, says why (the click upload), names the upload action, and leaves primary to the merchant", () => {
    expect(GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE).toContain("secondary conversion action");
    expect(GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE).toContain("doesn't bid on it");
    expect(GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE).toContain("by its ad click");
    // ★Conditional (review round 1): the upload runs only once Conversion tracking is set up.
    expect(GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE).toContain("Once Conversion tracking is set up, Peakhour reports each sale");
    expect(GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE).not.toContain("already reports");
    expect(GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE).toContain("“Peakhour offline purchases”");
    expect(GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE).toContain("Google would count it twice");
    expect(GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE).toContain("Making it primary is your call, in Google Ads.");
  });
  it("★the confirmation before the create carries it, and says it is a write that spends nothing", () => {
    const c = googleWebsiteConversionConfirmation("Linen Co");
    expect(c.title).toBe("Add a website conversion action to Linen Co?");
    expect(c.body).toContain(`“${PEAKHOUR_WEBSITE_CONVERSION_LABEL}”`);
    expect(c.body).toContain("This changes your Google Ads account, and it spends nothing.");
    expect(c.body).toContain(GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE);
  });
  it("★an action Google reads as primary gets the warning instead, never the 'secondary' claim", () => {
    expect(googleWebsiteConversionGoalNote(false)).toBe(GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE);
    expect(googleWebsiteConversionGoalNote(true)).toBe(GOOGLE_WEBSITE_CONVERSION_PRIMARY_WARNING);
    expect(GOOGLE_WEBSITE_CONVERSION_PRIMARY_WARNING).toContain("counted twice");
    expect(GOOGLE_WEBSITE_CONVERSION_PRIMARY_WARNING).not.toContain("secondary conversion action");
  });
  it("★the section renders the note at the button and under the tag (counted where shown)", () => {
    const section = read("../app/(site)/dashboard/ads/_components/google-website-conversion-section.tsx");
    expect(section.match(/\{GOOGLE_WEBSITE_CONVERSION_SECONDARY_NOTE\}/g)?.length).toBe(1);
    expect(section.match(/\{googleWebsiteConversionGoalNote\(state\.primaryForGoal\)\}|\{googleWebsiteConversionGoalNote\(primaryForGoal\)\}/g)?.length).toBe(2);
  });
  it("★the how-to never loads gtag.js twice on a site that already has it (review round 1)", () => {
    expect(GOOGLE_WEBSITE_TAG_HOW_TO).toContain("If your site already loads a Google tag (gtag.js), don't load it twice");
  });
  it("★the set-up writes its answer under the key it was started with, not the one current when it lands (review round 1)", () => {
    const section = read("../app/(site)/dashboard/ads/_components/google-website-conversion-section.tsx");
    expect(section).toContain("setUp.mutate(queryKey)");
    expect(section).toContain("setQueryData<GoogleWebsiteConversionState>(key,");
    expect(section).not.toContain("setQueryData<GoogleWebsiteConversionState>(queryKey");
  });
  it("★a failed re-read is said even while the last good read is shown (review round 1)", () => {
    const section = read("../app/(site)/dashboard/ads/_components/google-website-conversion-section.tsx");
    expect(section).toContain("{query.isError && query.data ? (");
  });
  it("★a copy attempt clears both the old 'Copied' and the old failure first (review round 1)", () => {
    const section = read("../app/(site)/dashboard/ads/_components/google-website-conversion-section.tsx");
    expect(section).toMatch(/setFailed\(null\);\s*setCopied\(null\);/);
  });
  it("the label is the api's name", () => {
    expect(PEAKHOUR_WEBSITE_CONVERSION_LABEL).toBe("Peakhour website purchases");
  });
});

describe("the section's state", () => {
  it("★loading, offline and error are never 'not set up'", () => {
    expect(googleWebsiteConversionState({ data: undefined, isError: false, fetchStatus: "fetching" })).toEqual({ kind: "loading" });
    expect(googleWebsiteConversionState({ data: undefined, isError: false, fetchStatus: "paused" })).toEqual({ kind: "offline" });
    expect(googleWebsiteConversionState({ data: undefined, isError: true, fetchStatus: idle })).toEqual({ kind: "error" });
  });
  it("nothing stored is not set up; a stored action Google no longer has is 'gone'", () => {
    expect(googleWebsiteConversionState({ data: { conversionCustomerId: "1", action: null, storedNotLive: false }, isError: false, fetchStatus: idle })).toEqual({ kind: "not_set_up" });
    expect(googleWebsiteConversionState({ data: { conversionCustomerId: "1", action: null, storedNotLive: true }, isError: false, fetchStatus: idle })).toEqual({ kind: "gone" });
  });
  it("★'gone' names both causes the api folds into it: removed or disabled, or another conversion customer (review round 1)", () => {
    expect(GOOGLE_WEBSITE_CONVERSION_GONE).toContain("removed or disabled in Google Ads");
    expect(GOOGLE_WEBSITE_CONVERSION_GONE).toContain("managed by another Google Ads account");
    expect(GOOGLE_WEBSITE_CONVERSION_GONE).toContain("replace the old tag");
  });
  it("★an action with snippets is ready, carrying Google's text untouched; data wins over a failed refetch", () => {
    const a = action({ primaryForGoal: true });
    const s = googleWebsiteConversionState({ data: { conversionCustomerId: "1", action: a, storedNotLive: false }, isError: true, fetchStatus: idle });
    expect(s).toEqual({ kind: "ready", name: a.name, primaryForGoal: true, snippets: a.tagSnippets });
    if (s.kind === "ready") expect(s.snippets[0]).toBe(a.tagSnippets[0]);
  });
  it("an action with no snippets yet says so, not 'ready'", () => {
    expect(googleWebsiteConversionState({ data: { conversionCustomerId: "1", action: action({ tagSnippets: [] }), storedNotLive: false }, isError: false, fetchStatus: idle })).toEqual({
      kind: "no_snippet",
      name: "Peakhour website purchases",
      primaryForGoal: false,
    });
  });
});

describe("snippets", () => {
  it("★page-load HTML first, then click, HTML before AMP; unknown types last in Google's order; none dropped or changed", () => {
    const amp = snip("WEBPAGE", "AMP");
    const click = snip("WEBPAGE_ONCLICK", "HTML");
    const page = snip("WEBPAGE", "HTML");
    const odd = snip("SOMETHING_NEW", "HTML");
    const out = orderedSnippets([odd, amp, click, page]);
    expect(out).toEqual([page, amp, click, odd]);
    expect(out[0]).toBe(page);
  });
  it("★two snippets with the same type and format still get different keys (review round 1)", () => {
    const a = snip("UNSPECIFIED", "UNSPECIFIED", "<script>a</script>");
    const b = snip("UNSPECIFIED", "UNSPECIFIED", "<script>b</script>");
    expect(googleWebsiteSnippetKey(a, 0)).not.toBe(googleWebsiteSnippetKey(b, 1));
  });
  it("★★a click snippet is placed by the button and called from its click, never on the confirmation page alone (review round 2)", () => {
    const click = snip("WEBPAGE_ONCLICK", "HTML");
    const page = snip("WEBPAGE", "HTML");
    expect(googleWebsiteEventSnippetLabel(page)).toBe("Event snippet — order confirmation page only");
    expect(googleWebsiteEventSnippetHowTo(page)).toBe("Paste the event snippet on your order confirmation page only.");
    expect(googleWebsiteEventSnippetLabel(click)).toBe("Event snippet — the page with the button");
    expect(googleWebsiteEventSnippetHowTo(click)).toContain("call gtag_report_conversion()");
    expect(googleWebsiteEventSnippetHowTo(click)).not.toContain("confirmation page");
    // The shared how-to no longer places the event snippet at all.
    expect(GOOGLE_WEBSITE_TAG_HOW_TO).not.toContain("event snippet");
  });
  it("labels from Google's enums, and an unknown value in Google's own word", () => {
    expect(googleWebsiteSnippetLabel(snip("WEBPAGE", "HTML"))).toBe("When the page loads (HTML page)");
    expect(googleWebsiteSnippetLabel(snip("WEBPAGE_ONCLICK", "AMP"))).toBe("When a button is clicked (AMP page)");
    expect(googleWebsiteSnippetLabel(snip("X", "Y"))).toBe("X (Y)");
  });
});

describe("errors and toasts", () => {
  it("★every name taken is said for the website action, not the import-from-clicks one", () => {
    const err = new ApiError("CONVERSION_ACTION_REFUSED", "raw", 409, undefined, { reason: "validation_conversion_action_name_taken" });
    const m = googleWebsiteConversionErrorMessage(err, "fallback");
    expect(m).toContain("website conversion action");
    expect(m).not.toContain("import-from-clicks");
    // ★Rename, never "remove": a removed action keeps its name (api review round 1).
    expect(m).toContain("rename one of them in Google Ads");
    expect(m).not.toMatch(/or remove/);
  });
  it("★an unreachable conversion customer is a reconnect, not a retry (review round 1)", () => {
    const unreachable = new ApiError("CONVERSION_ACTION_REFUSED", "raw", 409, undefined, { reason: "validation_conversion_customer_unreachable" });
    expect(googleWebsiteConversionNeedsReconnect(unreachable)).toBe(true);
    expect(googleWebsiteConversionNeedsReconnect(new ApiError("NEEDS_REAUTH", "raw", 409))).toBe(true);
    // PASS: another refusal, and a transient failure, are retries.
    expect(googleWebsiteConversionNeedsReconnect(new ApiError("CONVERSION_ACTION_REFUSED", "raw", 409, undefined, { reason: "validation_conversion_action_name_taken" }))).toBe(false);
    expect(googleWebsiteConversionNeedsReconnect(new ApiError("PLATFORM_FAILED", "raw", 502))).toBe(false);
  });
  it("other failures use G-17b's words", () => {
    expect(googleWebsiteConversionErrorMessage(new ApiError("CONVERSION_ACTION_UNCONFIRMED", "raw", 409), "fallback")).toContain("not add a second");
  });
  it("the toast says created, or shows the one that exists", () => {
    expect(googleWebsiteConversionSavedSentence(true, "Peakhour website purchases")).toBe("Added “Peakhour website purchases” to your Google Ads account. Copy its tag below.");
    expect(googleWebsiteConversionSavedSentence(false, "Web sales")).toBe("Here is the tag for “Web sales”.");
  });
});
