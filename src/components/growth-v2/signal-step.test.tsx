import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError } from "@/lib/api";
import { SignalStepView, effectiveAccount, signalErrorMessage, type SignalStepViewProps } from "./signal-step";
import {
  UNTRACKED_BADGE_LABEL,
  UNTRACKED_EXPLANATION,
  canContinue,
  continueBlockedReason,
  needsAChoice,
  platformsNeedingAChoice,
  signalStateSentence,
  type SignalReadiness,
} from "@/lib/growth-v2-signal";

/**
 * C3: First-run's signal step blocks continuing without a choice, and an
 * accepted "untracked" shows the measurement badge with its explanation.
 */

const readiness = (meta: SignalReadiness["platforms"][number]["state"], google: SignalReadiness["platforms"][number]["state"], complete: boolean): SignalReadiness => ({
  platforms: [
    { platform: "meta", state: meta, ...(meta === "ready" ? { chosen: { id: "1", name: "Acme dataset" } } : {}) },
    { platform: "google_ads", state: google, ...(google === "needs_primary_goal" ? { chosen: { id: "7", name: "Store sales" } } : {}) },
  ],
  complete,
});

const noop = vi.fn();
const props = (r: SignalReadiness | undefined, over: Partial<SignalStepViewProps> = {}): SignalStepViewProps => ({
  readiness: r,
  accounts: { meta: [{ id: "act_1", name: "Acme Meta" }], google_ads: [{ id: "123", name: "Acme Google" }] },
  chosenAccount: { meta: undefined, google_ads: undefined },
  onChooseAccount: noop,
  onSetUp: noop,
  onAcceptUntracked: noop,
  onContinue: noop,
  ...over,
});
const html = (p: SignalStepViewProps) => renderToStaticMarkup(<SignalStepView {...p} />);
// ★The class list carries `disabled:` variants, so the ATTRIBUTE is what is looked for.
const isOff = (button: string) => /\sdisabled=""/.test(button);
const continueButton = (out: string) => out.match(/<button[^>]*>Continue<\/button>/)![0];

describe("the signal step", () => {
  it("★★blocks continuing while a connected platform has no signal and no acceptance", () => {
    const out = html(props(readiness("needed", "ready", false)));
    expect(isOff(continueButton(out))).toBe(true);
    expect(out).toContain("Choose a signal for Meta");
    expect(out).toContain("Pick or create my dataset");
    expect(out).toContain("Run without a signal");
  });

  it("blocks while the readiness is still loading, and says so", () => {
    const out = html(props(undefined));
    expect(isOff(continueButton(out))).toBe(true);
    expect(out).toContain("Checking your");
  });

  it("★blocks when nothing is connected, and says to connect first", () => {
    const out = html(props(readiness("not_connected", "not_connected", false)));
    expect(isOff(continueButton(out))).toBe(true);
    expect(out).toContain("Connect Meta or Google Ads first.");
  });

  it("★the button follows the api's complete flag and nothing local", () => {
    // complete says no even though every row looks fine: the api decides
    expect(canContinue({ ...readiness("ready", "ready", false) })).toBe(false);
    expect(isOff(continueButton(html(props(readiness("ready", "ready", false)))))).toBe(true);
    expect(isOff(continueButton(html(props(readiness("ready", "ready", true)))))).toBe(false);
  });

  it("★an accepted untracked platform shows the Not tracked badge and says what it means; Continue is on", () => {
    const out = html(props(readiness("untracked_accepted", "ready", true)));
    expect(out).toContain(UNTRACKED_BADGE_LABEL);
    expect(UNTRACKED_BADGE_LABEL).toBe("Not tracked");
    expect(out).toContain(UNTRACKED_EXPLANATION.slice(0, 40));
    expect(out).toContain("runs without a signal. You accepted this.");
    expect(isOff(continueButton(out))).toBe(false);
  });

  it("a platform that is on says which dataset it uses, with no choice buttons", () => {
    const out = html(props(readiness("ready", "not_connected", true)));
    expect(out).toContain("through “Acme dataset”");
    expect(out).not.toContain("Pick or create my dataset");
    expect(out).toContain("Google Ads is not connected.");
  });

  it("★a Google action that is not a primary goal blocks and offers the fix", () => {
    const r = readiness("not_connected", "needs_primary_goal", false);
    const out = html(props(r));
    expect(out).toContain("is not a primary goal in Google Ads");
    expect(out).toContain("Set up my conversion action");
    expect(isOff(continueButton(out))).toBe(true);
    expect(platformsNeedingAChoice(r)).toEqual(["google_ads"]);
    expect(["needed", "needs_primary_goal"].map((x) => needsAChoice(x as never))).toEqual([true, true]);
    expect(["ready", "untracked_accepted", "not_connected"].map((x) => needsAChoice(x as never))).toEqual([false, false, false]);
  });

  it("with several ad accounts it offers a picker; with one it does not", () => {
    const many = html(props(readiness("needed", "not_connected", false), { accounts: { meta: [{ id: "act_1", name: "A" }, { id: "act_2", name: "B" }], google_ads: [] } }));
    expect(many).toContain('aria-label="Meta account"');
    expect(html(props(readiness("needed", "not_connected", false)))).not.toContain("Meta account");
  });

  it("the set-up button is off with no ad account to set up on", () => {
    const out = html(props(readiness("needed", "not_connected", false), { accounts: { meta: [], google_ads: [] } }));
    expect(out).toMatch(/<button[^>]* disabled=""[^>]*>Pick or create my dataset/);
  });

  it("names the focus, so the merchant knows what the platforms are told", () => {
    expect(html(props(readiness("ready", "ready", true), { focusLabel: "Flight sales" }))).toContain("Only Flight sales is reported");
    expect(html(props(readiness("ready", "ready", true)))).not.toContain("is reported to the platforms");
  });

  it("shows an error as an alert", () => {
    expect(html(props(readiness("needed", "ready", false), { error: "Meta said no." }))).toContain('role="alert"');
  });
});

describe("growth-v2-signal copy", () => {
  it("every state has a sentence, and a blocked reason is null only when complete", () => {
    for (const s of ["ready", "untracked_accepted", "needed", "needs_primary_goal", "not_connected"] as const) {
      expect(signalStateSentence({ platform: "meta", state: s }).length).toBeGreaterThan(10);
    }
    expect(continueBlockedReason(readiness("ready", "ready", true))).toBeNull();
    // the api says incomplete, but no row needs a choice (or there are no rows): never "Choose a signal for ."
    expect(continueBlockedReason(readiness("ready", "not_connected", false))).toBe("Your signal is not ready yet.");
    expect(continueBlockedReason({ platforms: [], complete: false })).toBe("Connect Meta or Google Ads first.");
    expect(continueBlockedReason(readiness("needed", "needed", false))).toBe("Choose a signal for Meta and Google Ads, or accept running without one.");
  });
});

describe("signalErrorMessage", () => {
  it("★an api code written for the merchant shows its sentence; anything else is the fallback with its reference, never raw text", () => {
    expect(signalErrorMessage("meta", new ApiError("DATASET_NOT_FOUND", "That Meta ad account has no datasets.", 400), "We couldn't.")).toBe("That Meta ad account has no datasets.");
    expect(signalErrorMessage("meta", new ApiError("INTERNAL", "mongo: E11000 duplicate key at host-3", 500, "req-9"), "We couldn't.")).toBe("We couldn't. (reference req-9)");
    expect(signalErrorMessage("meta", new ApiError("INTERNAL", "raw", 502), "We couldn't.")).toBe("We couldn't.");
    expect(signalErrorMessage("untracked", new ApiError("NOT_CONNECTED", "That platform is not connected for this business.", 409), "We couldn't.")).toBe("That platform is not connected for this business.");
  });

  it("★a transport or auth failure is never shown raw, even though it is below 500", () => {
    expect(signalErrorMessage("meta", new ApiError("NETWORK_ERROR", "Failed to fetch", 0), "We couldn't.")).toBe("We couldn't.");
    expect(signalErrorMessage("meta", new ApiError("UNAUTHORIZED", "jwt expired at 2026-10-26", 401, "req-2"), "We couldn't.")).toBe("We couldn't. (reference req-2)");
    expect(signalErrorMessage("untracked", new ApiError("RATE_LIMITED", "429 Too Many Requests", 429), "We couldn't.")).toBe("We couldn't.");
  });

  it("Google goes through the Ads panel's own table", () => {
    expect(signalErrorMessage("google_ads", new ApiError("CONVERSION_ACTION_UNCONFIRMED", "x", 409), "We couldn't.")).toContain("may have added the conversion action");
    expect(signalErrorMessage("google_ads", new ApiError("INTERNAL", "raw", 500), "We couldn't.")).not.toContain("raw");
  });

  it("an error this app threw is ours to show; anything else is the fallback", () => {
    expect(signalErrorMessage("google_ads", new Error("We don't know this account's currency."), "We couldn't.")).toBe("We don't know this account's currency.");
    expect(signalErrorMessage("meta", "boom", "We couldn't.")).toBe("We couldn't.");
  });
});

describe("effectiveAccount", () => {
  const list = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  it("★what is shown is what is used: a pick that left the list falls back to the first", () => {
    expect(effectiveAccount(list, "b")).toBe("b");
    expect(effectiveAccount(list, "gone")).toBe("a");
    expect(effectiveAccount(list, undefined)).toBe("a");
    expect(effectiveAccount([], "b")).toBeUndefined();
  });
});

describe("a failed ad-account list", () => {
  it("★is said on the row, not blamed on the merchant", () => {
    const out = html(props(readiness("needed", "not_connected", false), { accounts: { meta: [], google_ads: [] }, accountsFailed: { meta: true } }));
    expect(out).toContain("We couldn&#x27;t load your Meta ad accounts.");
    expect(html(props(readiness("needed", "not_connected", false), { accounts: { meta: [], google_ads: [] } }))).not.toContain("load your Meta ad accounts");
  });
});
