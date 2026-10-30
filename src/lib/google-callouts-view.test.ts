import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "@/lib/api";
import type { GoogleCallout } from "@/lib/api/google-ads";
import {
  GOOGLE_CALLOUTS_ACCOUNT_LEVEL_NOTE,
  GOOGLE_CALLOUTS_INTRO,
  GOOGLE_CALLOUT_CHECK_NOTE,
  GOOGLE_CALLOUT_MAX,
  googleCalloutAddedByGoogle,
  googleCalloutAddedSentence,
  googleCalloutErrorMessage,
  googleCalloutLength,
  googleCalloutMayHaveBeenAdded,
  googleCalloutNeedsReconnect,
  googleCalloutPolicyWarning,
  googleCalloutRemoveConfirmation,
  googleCalloutStatusIsProblem,
  googleCalloutStatusLabel,
  googleCalloutWidth,
  googleCalloutsState,
} from "@/lib/google-callouts-view";

const callout = (over: Partial<GoogleCallout> = {}): GoogleCallout => ({
  resourceName: "customers/1234567890/customerAssets/501~CALLOUT",
  assetId: "501",
  text: "Free UK delivery",
  status: "ENABLED",
  primaryStatus: "ELIGIBLE",
  source: "ADVERTISER",
  ...over,
});
const apiError = (code: string, message = `msg for ${code}`, requestId?: string) => {
  const e = new ApiError(code, message, 409);
  if (requestId) (e as { requestId?: string }).requestId = requestId;
  return e;
};

describe("★★G-14e — account level only, said where the merchant would expect campaign callouts", () => {
  it("★the note says callouts are added to the whole account, where campaign ones live, and that those win", () => {
    expect(GOOGLE_CALLOUTS_ACCOUNT_LEVEL_NOTE).toContain("whole account only");
    expect(GOOGLE_CALLOUTS_ACCOUNT_LEVEL_NOTE).toContain("add them in Google Ads");
    expect(GOOGLE_CALLOUTS_ACCOUNT_LEVEL_NOTE).toMatch(/Google shows those instead of these/);
  });
  it("★the section renders the note, the intro and the check note — counted where shown, never only imported", () => {
    const section = readFileSync(fileURLToPath(new URL("../app/(site)/dashboard/ads/_components/google-callouts-section.tsx", import.meta.url)), "utf8");
    for (const name of ["GOOGLE_CALLOUTS_ACCOUNT_LEVEL_NOTE", "GOOGLE_CALLOUTS_INTRO", "GOOGLE_CALLOUT_CHECK_NOTE"]) {
      expect(section.match(new RegExp(`\\{${name}\\}`, "g"))?.length, name).toBe(1);
    }
    // Every add is "Check and add": the merchant is never told it was added before the check.
    expect(section).toContain("Check and add");
  });
  it("the intro names Search ads, and the check note says it costs nothing", () => {
    expect(GOOGLE_CALLOUTS_INTRO).toContain("Search ads");
    expect(GOOGLE_CALLOUT_CHECK_NOTE).toMatch(/costs nothing/);
  });
});

describe("★★G-14e — the counter agrees with the api's limit", () => {
  it("25 fits, 26 is over; double-width counts two; trimmed", () => {
    expect(GOOGLE_CALLOUT_MAX).toBe(25);
    expect(googleCalloutLength("a".repeat(25))).toEqual({ label: "25/25", over: false, empty: false, multiline: false });
    expect(googleCalloutLength("a".repeat(26)).over).toBe(true);
    expect(googleCalloutWidth("送料無料")).toBe(8);
    expect(googleCalloutLength("あ".repeat(13))).toEqual({ label: "26/25", over: true, empty: false, multiline: false });
    expect(googleCalloutLength("  x  ").label).toBe("1/25");
    expect(googleCalloutLength("   ").empty).toBe(true);
    // ★The api refuses a tab or line break (review round 1): said before the round trip; a trailing newline is trimmed, as the api trims.
    expect(googleCalloutLength("Free\tdelivery").multiline).toBe(true);
    expect(googleCalloutLength("Free\ndelivery").multiline).toBe(true);
    expect(googleCalloutLength("Free delivery\n").multiline).toBe(false);
  });
});

describe("★★G-14e — each callout's words", () => {
  it.each([
    [{ primaryStatus: "ELIGIBLE" }, "Can show", false],
    [{ primaryStatus: "LIMITED" }, "Showing in a limited way", true],
    [{ primaryStatus: "NOT_ELIGIBLE" }, "Not showing", true],
    [{ primaryStatus: "PENDING" }, "Waiting for Google", false],
    [{ primaryStatus: "UNSPECIFIED" }, "Google hasn't said yet", false],
    [{ status: "PAUSED" as const, primaryStatus: "PAUSED" }, "Paused in Google Ads", false],
    [{ primaryStatus: "SOMETHING_NEW" }, "SOMETHING_NEW", false],
  ])("%o reads %s", (over, label, problem) => {
    expect(googleCalloutStatusLabel(callout(over))).toBe(label);
    expect(googleCalloutStatusIsProblem(callout(over))).toBe(problem);
  });
  it("Google's own are labelled as Google's", () => {
    expect(googleCalloutAddedByGoogle(callout({ source: "AUTOMATICALLY_CREATED" }))).toBe(true);
    expect(googleCalloutAddedByGoogle(callout())).toBe(false);
  });
  it("★the remove confirmation says it stops showing, and that Google keeps the asset", () => {
    const c = googleCalloutRemoveConfirmation("Free UK delivery");
    expect(c.title).toBe("Remove “Free UK delivery”?");
    expect(c.body).toContain("stops showing");
    expect(c.body).toContain("Google doesn't let assets be deleted");
  });
});

describe("★★G-14e — adding: the policy check's answers", () => {
  it("★a warning is recognised as one, with the api's sentence (shown with Add anyway)", () => {
    expect(googleCalloutPolicyWarning(apiError("CALLOUT_POLICY_WARNING", "“Nike” is another brand's trademark."))).toBe("“Nike” is another brand's trademark.");
    expect(googleCalloutPolicyWarning(apiError("CALLOUT_POLICY_BLOCKED"))).toBeNull();
    expect(googleCalloutPolicyWarning(new Error("x"))).toBeNull();
  });
  it("★a block says it is Google's policies, with the check's reason", () => {
    expect(googleCalloutErrorMessage(apiError("CALLOUT_POLICY_BLOCKED", "“!!!” draws attention."), "f")).toBe("“!!!” draws attention.");
    expect(googleCalloutErrorMessage(apiError("CALLOUT_POLICY_BLOCKED", "Google's ad policies would not allow this callout."), "f")).toBe(
      "Google's ad policies would not allow this callout.",
    );
  });
  it.each(["CALLOUT_REPEATS", "BLOCKED_TERM", "CALLOUT_UNCONFIRMED", "POLICY_CHECK_UNAVAILABLE", "VALIDATION_ERROR", "PLATFORM_REFUSED", "CALLOUT_REFUSED", "CHANNEL_DENIED", "QUIET_HOURS", "BLACKOUT", "AD_ACCOUNT_NOT_ON_CONNECTION"])(
    "%s shows the api's merchant sentence",
    (code) => expect(googleCalloutErrorMessage(apiError(code), "fallback")).toBe(`msg for ${code}`),
  );
  it("★PASS: anything else, and the zod 'Invalid body', show the fallback with the reference", () => {
    expect(googleCalloutErrorMessage(apiError("INTERNAL", "stack", "req-1"), "Try again.")).toBe("Try again. (reference req-1)");
    expect(googleCalloutErrorMessage(apiError("VALIDATION_ERROR", "Invalid body", "req-2"), "Try again.")).toBe("Try again. (reference req-2)");
    expect(googleCalloutErrorMessage(new Error("x"), "Try again.")).toBe("Try again.");
  });
  it("an unconfirmed add may exist; a reconnect is asked for a dead connection only", () => {
    expect(googleCalloutMayHaveBeenAdded(apiError("CALLOUT_UNCONFIRMED"))).toBe(true);
    expect(googleCalloutMayHaveBeenAdded(apiError("PLATFORM_FAILED"))).toBe(false);
    expect(googleCalloutNeedsReconnect(apiError("NEEDS_REAUTH"))).toBe(true);
    expect(googleCalloutNeedsReconnect(apiError("RATE_LIMITED"))).toBe(false);
  });
  it("★the toast says the same text twice was not added twice, and says when the check could not run", () => {
    expect(googleCalloutAddedSentence({ created: false, callout: callout(), policy: null })).toBe("Your account already has “Free UK delivery”.");
    expect(googleCalloutAddedSentence({ created: false, callout: callout({ status: "PAUSED", primaryStatus: "PAUSED" }), policy: null })).toBe(
      "Your account already has “Free UK delivery”, paused in Google Ads, so it isn't showing. Enable it there to show it.",
    );
    expect(googleCalloutAddedSentence({ created: true, callout: callout(), policy: { checked: true, verdict: "ok" } })).toBe("Added “Free UK delivery”. Google reviews it before it shows.");
    expect(googleCalloutAddedSentence({ created: true, callout: callout(), policy: { checked: false, verdict: "ok" } })).toMatch(/policy check couldn't run/);
  });
});

describe("the section's state", () => {
  it("★loading, offline and error are never 'none'; data wins", () => {
    expect(googleCalloutsState({ data: undefined, isError: false, fetchStatus: "fetching" })).toEqual({ kind: "loading" });
    expect(googleCalloutsState({ data: undefined, isError: false, fetchStatus: "paused" })).toEqual({ kind: "offline" });
    expect(googleCalloutsState({ data: undefined, isError: true, fetchStatus: "idle" })).toEqual({ kind: "error" });
    expect(googleCalloutsState({ data: { callouts: [] }, isError: true, fetchStatus: "idle" })).toEqual({ kind: "none" });
    expect(googleCalloutsState({ data: { callouts: [callout()] }, isError: false, fetchStatus: "idle" })).toEqual({ kind: "list", callouts: [callout()] });
  });
});

describe("★★the counter's width rule is the api's, character for character (review round 1)", () => {
  // The sibling checkout, or the one PEAKHOUR_API_ROOT names (google-ads-surface.test.ts's rule): a missing checkout skips,
  // a missing FILE inside a present one fails.
  const SIBLING = process.env.PEAKHOUR_API_ROOT ?? fileURLToPath(new URL("../../../peakhour-api", import.meta.url));
  const present = existsSync(SIBLING);
  const ranges = (source: string): string | null => /const DOUBLE_WIDTH =\s*(\/.+\/u);/.exec(source)?.[1] ?? null;
  it.skipIf(!present)("★DOUBLE_WIDTH here equals DOUBLE_WIDTH in the api's google-callouts.ts", () => {
    const apiFile = join(SIBLING, "src", "v1", "services", "ads", "google-callouts.ts");
    if (!existsSync(apiFile)) throw new Error(`peakhour-api is checked out but ${apiFile} is missing — the callout service moved.`);
    const theirs = ranges(readFileSync(apiFile, "utf8"));
    const ours = ranges(readFileSync(fileURLToPath(new URL("./google-callouts-view.ts", import.meta.url)), "utf8"));
    expect(theirs).not.toBeNull();
    expect(ours).toBe(theirs);
  });
});
