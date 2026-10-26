import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ApiError } from "@/lib/api";
import type { GoogleConversionActionState } from "@/lib/api/google-ads";
import {
  GOOGLE_CONVERSION_CONSENT_NOTE,
  GOOGLE_CONVERSION_NOT_SET_UP,
  GOOGLE_CONVERSION_PRIMARY_NOTE,
  googleConversionCanUse,
  googleConversionCardState,
  googleConversionCreateConfirmation,
  googleConversionDefaultChoice,
  googleConversionErrorMessage,
  googleConversionErrorSelection,
  googleConversionMayHaveBeenCreated,
  googleConversionNeedsReconnect,
  googleConversionSavedSentence,
  googleConversionStateSentence,
} from "./google-conversion-view";

/** G-17b — every sentence and decision of the "Conversion tracking" section. */

const act = (id: string, name = `Action ${id}`) => ({ id, name });
const data = (over: Partial<GoogleConversionActionState> = {}): GoogleConversionActionState => ({
  conversionCustomerId: "1234567890",
  actions: [act("11"), act("22")],
  selected: null,
  selectedIsLive: null,
  ...over,
});
const sel = (id: string, name?: string) => ({
  adAccountId: "1234567890",
  conversionActionId: id,
  conversionCustomerId: "1234567890",
  ...(name ? { name } : {}),
});
const apiErr = (code: string, message = `api says ${code}`, details?: unknown, requestId?: string) =>
  new ApiError(code, message, 409, requestId, details);

describe("the card state", () => {
  it("★nothing selected is 'not set up', and says what that costs", () => {
    const s = googleConversionCardState({ data: data(), isError: false, fetchStatus: "idle" });
    expect(s).toEqual({ kind: "not_set_up" });
    expect(googleConversionStateSentence(s)).toBe(GOOGLE_CONVERSION_NOT_SET_UP);
    expect(GOOGLE_CONVERSION_NOT_SET_UP).toContain("Peakhour can't report sales to Google yet");
  });
  it("★a live selection names itself", () => {
    const s = googleConversionCardState({ data: data({ selected: sel("11", "Web sales"), selectedIsLive: true }), isError: false, fetchStatus: "idle" });
    expect(s).toEqual({ kind: "chosen", name: "Web sales" });
    expect(googleConversionStateSentence(s)).toContain("“Web sales”");
  });
  it("★a selection Google no longer accepts is not shown as working", () => {
    const s = googleConversionCardState({ data: data({ selected: sel("11", "Web sales"), selectedIsLive: false }), isError: false, fetchStatus: "idle" });
    expect(s.kind).toBe("chosen_not_live");
    expect(googleConversionStateSentence(s)).toContain("can't report sales to Google");
  });
  it("a selection with no stored name falls back to its id, and a null verdict is not read as live", () => {
    const s = googleConversionCardState({ data: data({ selected: sel("11"), selectedIsLive: null }), isError: false, fetchStatus: "idle" });
    expect(s).toEqual({ kind: "chosen_not_live", name: "Conversion action 11" });
  });
  it("★★loading, offline and error are never 'not set up'", () => {
    expect(googleConversionCardState({ data: undefined, isError: false, fetchStatus: "fetching" })).toEqual({ kind: "loading" });
    expect(googleConversionCardState({ data: undefined, isError: false, fetchStatus: "paused" })).toEqual({ kind: "offline" });
    expect(googleConversionCardState({ data: undefined, isError: true, fetchStatus: "idle" })).toEqual({ kind: "error" });
    for (const k of ["loading", "offline", "error"] as const) {
      expect(googleConversionStateSentence({ kind: k })).not.toContain("Not set up");
    }
  });
  it("PASS: an error with data from earlier keeps the data (a failed background refetch)", () => {
    const s = googleConversionCardState({ data: data({ selected: sel("11", "Web sales"), selectedIsLive: true }), isError: true, fetchStatus: "idle" });
    expect(s.kind).toBe("chosen");
  });
  it("PASS: an idle query with no data and no error reads as loading, not as an empty state", () => {
    expect(googleConversionCardState({ data: undefined, isError: false, fetchStatus: "idle" })).toEqual({ kind: "loading" });
  });
});

describe("the choice", () => {
  it("defaults to the stored choice only when it is still offered", () => {
    expect(googleConversionDefaultChoice(data({ selected: sel("22"), selectedIsLive: true }))).toBe("22");
    expect(googleConversionDefaultChoice(data({ selected: sel("99"), selectedIsLive: false }))).toBeUndefined();
    expect(googleConversionDefaultChoice(data())).toBeUndefined();
    expect(googleConversionDefaultChoice(undefined)).toBeUndefined();
  });
  it("★'Use this one' needs an offered action that is not already the live choice", () => {
    const live = data({ selected: sel("11"), selectedIsLive: true });
    expect(googleConversionCanUse(live, "22")).toBe(true);
    expect(googleConversionCanUse(live, "11")).toBe(false);
    expect(googleConversionCanUse(live, undefined)).toBe(false);
    expect(googleConversionCanUse(live, "99")).toBe(false);
    expect(googleConversionCanUse(undefined, "11")).toBe(false);
  });
  it("PASS: re-choosing the stored action when it is no longer live is allowed", () => {
    expect(googleConversionCanUse(data({ selected: sel("11"), selectedIsLive: false }), "11")).toBe(true);
  });
});

describe("the words", () => {
  it("★the create confirmation says it changes their Google Ads account and spends nothing", () => {
    const c = googleConversionCreateConfirmation("Acme Shop");
    expect(c.title).toContain("Acme Shop");
    expect(c.body).toContain("Peakhour offline purchases");
    expect(c.body).toContain("changes your Google Ads account");
    expect(c.body).toContain("spends nothing");
  });
  it("★primary: it is a bidding goal with a value, and the merchant is told so before it is created", () => {
    expect(GOOGLE_CONVERSION_PRIMARY_NOTE).toContain("primary conversion action with a value");
    expect(GOOGLE_CONVERSION_PRIMARY_NOTE).not.toContain("secondary");
    expect(GOOGLE_CONVERSION_PRIMARY_NOTE).toContain("Smart Bidding can bid on it");
    expect(googleConversionCreateConfirmation("A").body).toContain(GOOGLE_CONVERSION_PRIMARY_NOTE);
  });
  it("★the consent note names the audience and the path", () => {
    expect(GOOGLE_CONVERSION_CONSENT_NOTE).toContain("EEA");
    expect(GOOGLE_CONVERSION_CONSENT_NOTE).toContain("UK");
    expect(GOOGLE_CONVERSION_CONSENT_NOTE).toContain("Tools → Data Manager → Consent settings");
  });
  it("the saved toast tells an add from an adoption", () => {
    expect(googleConversionSavedSentence(true, "X")).toContain("Added “X” to your Google Ads account");
    expect(googleConversionSavedSentence(false, "X")).toBe("Peakhour will report sales to “X”.");
    expect(googleConversionSavedSentence(false, undefined)).toContain("the conversion action");
  });
});

describe("refusals, each with its reason", () => {
  const refused = (reason: string, message = "api sentence") => apiErr("CONVERSION_ACTION_REFUSED", message, { reason, adAccountId: "1" });
  it("★wrong manager (cross-account tracking the connection does not reach)", () => {
    const m = googleConversionErrorMessage(refused("validation_conversion_customer_unreachable"), "fb");
    expect(m).toContain("managed by a different manager account");
    expect(m).toContain("Reconnect Google Ads");
  });
  it("★Google's answer about who manages conversions was unreadable", () => {
    expect(googleConversionErrorMessage(refused("validation_conversion_customer"), "fb")).toContain("won't guess");
  });
  it("★every Peakhour name is taken", () => {
    expect(googleConversionErrorMessage(refused("validation_conversion_action_name_taken"), "fb")).toContain("choose an existing import-from-clicks action");
  });
  it("★account not on the connection", () => {
    const m = googleConversionErrorMessage(apiErr("AD_ACCOUNT_NOT_ALLOWED"), "fb");
    expect(m).toContain("isn't on your Peakhour connection");
    expect(googleConversionNeedsReconnect(apiErr("AD_ACCOUNT_NOT_ALLOWED"))).toBe(true);
  });
  it("★the chosen action vanished between the list and the save", () => {
    expect(googleConversionErrorMessage(apiErr("CONVERSION_ACTION_NOT_FOUND"), "fb")).toContain("any more");
  });
  it("★a create whose answer was lost says wait, and that a second one is not made", () => {
    const e = apiErr("CONVERSION_ACTION_UNCONFIRMED");
    expect(googleConversionErrorMessage(e, "fb")).toContain("not add a second");
    expect(googleConversionMayHaveBeenCreated(e)).toBe(true);
    expect(googleConversionMayHaveBeenCreated(apiErr("CONVERSION_ACTION_REFUSED"))).toBe(false);
    expect(googleConversionMayHaveBeenCreated(new Error("x"))).toBe(false);
  });
  it("★an unlisted refusal reason shows the fallback with the reference, never the api's text", () => {
    const e = new ApiError("CONVERSION_ACTION_REFUSED", "raw provider words", 409, "req-4", { reason: "validation_something_new" });
    expect(googleConversionErrorMessage(e, "fb")).toBe("fb (reference req-4)");
  });
  it("a prototype key is not a reason", () => {
    const e = new ApiError("CONVERSION_ACTION_REFUSED", "raw", 409, undefined, { reason: "toString" });
    expect(googleConversionErrorMessage(e, "fb")).toBe("fb");
  });
  it("api messages for the connection and the rail are shown; unknown codes and non-api errors are not", () => {
    expect(googleConversionErrorMessage(apiErr("NEEDS_REAUTH", "Google Ads needs to be reconnected."), "fb")).toBe("Google Ads needs to be reconnected.");
    expect(googleConversionErrorMessage(apiErr("PLATFORM_FAILED", "Google Ads couldn't set up conversion tracking just now — try again shortly."), "fb")).toContain("just now");
    expect(googleConversionErrorMessage(apiErr("SOMETHING_ELSE", "raw provider text", undefined, "req-9"), "fb")).toBe("fb (reference req-9)");
    expect(googleConversionErrorMessage(new TypeError("Failed to fetch"), "fb")).toBe("fb");
  });
  it("only connection-level codes ask for a reconnect", () => {
    expect(googleConversionNeedsReconnect(apiErr("NEEDS_REAUTH"))).toBe(true);
    expect(googleConversionNeedsReconnect(apiErr("AD_ACCOUNT_NOT_AUTHORIZED"))).toBe(true);
    expect(googleConversionNeedsReconnect(apiErr("AD_ACCOUNT_FORBIDDEN"))).toBe(false);
    expect(googleConversionNeedsReconnect(apiErr("CONNECTION_GONE"))).toBe(true);
    expect(googleConversionNeedsReconnect(apiErr("CONVERSION_ACTION_REFUSED"))).toBe(false);
    expect(googleConversionNeedsReconnect(new Error("x"))).toBe(false);
  });
  it("a refused read carries the stored choice, by name or by id", () => {
    expect(googleConversionErrorSelection(apiErr("CONVERSION_ACTION_REFUSED", "m", { selected: sel("11", "Web sales") }))).toBe("Web sales");
    expect(googleConversionErrorSelection(apiErr("CONVERSION_ACTION_REFUSED", "m", { selected: sel("11") }))).toBe("Conversion action 11");
    expect(googleConversionErrorSelection(apiErr("CONVERSION_ACTION_REFUSED", "m", { selected: null }))).toBeNull();
    expect(googleConversionErrorSelection(apiErr("PLATFORM_FAILED", "m"))).toBeNull();
    expect(googleConversionErrorSelection(undefined)).toBeNull();
  });
});

/** The panel wires the module: the create is only reachable through the confirmation. */
describe("the panel", () => {
  const panel = readFileSync(
    fileURLToPath(new URL("../app/(site)/dashboard/ads/_components/google-ads-panel.tsx", import.meta.url)),
    "utf8",
  );
  const section = panel.slice(panel.indexOf("function ConversionTrackingSection"), panel.indexOf("function CampaignsSection"));
  it("★the section was found", () => expect(section.length).toBeGreaterThan(1000));
  it("★★a create (no id) is sent from one place only — the confirmation's button", () => {
    const creates = [...section.matchAll(/choose\.mutate\(undefined\)/g)];
    expect(creates.length).toBe(1);
    const at = section.indexOf("choose.mutate(undefined)");
    expect(section.slice(section.lastIndexOf("<AlertDialogAction", at), at)).toContain("setConfirmingCreate(false)");
    // The visible button only opens the dialog.
    expect(section).toContain("onClick={() => setConfirmingCreate(true)}");
  });
  it("the query key carries the business and the account", () => {
    expect(section).toMatch(/queryKey = \["google-conversion-action", business\?\._id \?\? "none", account\.id\]/);
  });
  it("a stale pick falls back to the stored default, and the select is always controlled", () => {
    expect(section).toContain("picked && query.data?.actions.some((a) => a.id === picked) ? picked : googleConversionDefaultChoice(query.data)");
    expect(section).toContain('value={choice ?? ""}');
  });
  it("a saved choice is shown at once, as live", () => {
    expect(section).toMatch(/setQueryData<GoogleConversionActionState>\(queryKey[\s\S]*selected: res\.selected,\s*selectedIsLive: true/);
  });
  it("a created action is offered at once, and the query waits for the business", () => {
    expect(section).toContain("actions: old.actions.some((a) => a.id === res.selected!.conversionActionId)");
    expect(section).toContain("enabled: !!business,");
  });
  it("a failed background refetch does not print an error over the last good read", () => {
    expect(section).toContain("query.isError && !query.data ? (");
  });
  it("the section is mounted per account", () => {
    expect(panel).toMatch(/<ConversionTrackingSection key=\{`conv-\$\{account\.id\}`\} account=\{account\} \/>/);
  });
  it("the consent and secondary notes are shown", () => {
    expect(section).toContain("GOOGLE_CONVERSION_CONSENT_NOTE");
    expect(section).toContain("GOOGLE_CONVERSION_PRIMARY_NOTE");
  });
});
