import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { XDmStatus } from "@/lib/x-dm";

// The view is pure; the api client is replaced so nothing here reaches the network.
vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() }, API_BASE_URL: "https://api.example" }));

const { XDmConnectView, xMessagesAuthorizeUrl } = await import("./x-dm-connect");
const { priceLine, usageLine, capReachedLine, parseCap, xDmErrorMessage, isNotReleased, LOAD_FAILED, REFRESH_FAILED, X_DM_COPY, CAP_RANGE_ERROR } = await import("@/lib/x-dm");

const status = (over: Partial<XDmStatus> = {}): XDmStatus => ({
  connected: true,
  connectionId: "c1",
  state: "off",
  pricePerMessage: 5,
  monthlyCap: 1000,
  usedThisMonth: 0,
  resumesAt: null,
  ...over,
});
const html = (s: XDmStatus, over: { busy?: boolean; error?: string | null } = {}) =>
  renderToStaticMarkup(<XDmConnectView status={s} busy={over.busy ?? false} error={over.error ?? null} onGrant={() => {}} onSwitch={() => {}} onCap={() => {}} />);

describe("the cost is shown before it is turned on, from the api's price", () => {
  it("says what each X message uses, in the rate card's number", () => {
    const out = html(status());
    expect(out).toContain("Each X message uses 5 AI credits. A customer&#x27;s message and each reply (yours or Peakhour&#x27;s) are one each.");
    expect(out).toContain(X_DM_COPY.turnOn);
  });
  it("follows the rate card: another price reads as that price, and 1 is singular", () => {
    expect(html(status({ pricePerMessage: 8 }))).toContain("Each X message uses 8 AI credits.");
    expect(priceLine(1)).toContain("uses 1 AI credit.");
  });
  it("with no price the switch cannot be turned on and the panel says why", () => {
    const out = html(status({ pricePerMessage: null }));
    expect(out).toContain(X_DM_COPY.noPrice);
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Turn on X messages<\/button>/);
    expect(priceLine(null)).toBeNull();
  });
  it("tells the merchant what happens at zero credits", () => {
    expect(html(status())).toContain("When your AI credits run out, Peakhour stops answering X messages and they wait in your Inbox marked Needs you.");
  });
});

describe("the states", () => {
  it("not connected: connect X first, no switch", () => {
    const out = html(status({ connected: false, connectionId: null }));
    expect(out).toContain(X_DM_COPY.connectFirst);
    expect(out).not.toContain("x-dm-switch");
    expect(out).not.toContain("x-dm-cap-form");
  });
  it("connected before messages existed: Grant message access, in words, and no switch yet", () => {
    const out = html(status({ state: "needs_reconnect" }));
    expect(out).toContain(X_DM_COPY.grant);
    expect(out).toContain("Peakhour needs permission to read and send direct messages on your X account.");
    expect(out).not.toContain("x-dm-switch");
  });
  it("the grant link asks for message access and returns to the same page", () => {
    expect(xMessagesAuthorizeUrl()).toBe("https://api.example/v1/integrations/x/authorize?dm=1&returnTo=%2Fdashboard%2Fintegrations");
  });
  it("on: reads On with Turn off, and shows the month's use against the limit", () => {
    const out = html(status({ state: "on", usedThisMonth: 12, monthlyCap: 1000 }));
    expect(out).toContain(">On<");
    expect(out).toContain(X_DM_COPY.turnOff);
    expect(out).toContain("12 of 1,000 X messages used this month.");
    expect(out).not.toContain(X_DM_COPY.turnOn);
  });
  it("off still shows the month's use (a turned-off account keeps the count the limit is judged against); needs-reconnect does not", () => {
    expect(html(status({ usedThisMonth: 40 }))).toContain("40 of 1,000 X messages used this month.");
    expect(html(status({ state: "needs_reconnect" }))).not.toContain("used this month");
  });
  it("limit reached: the merchant is told, with the date it starts again and how to carry on now", () => {
    const out = html(status({ state: "cap_reached", usedThisMonth: 1000, resumesAt: "2026-12-01T00:00:00.000Z" }));
    expect(out).toContain("x-dm-cap-reached");
    expect(out).toContain("You reached your limit of 1,000 X messages this month, so Peakhour has stopped reading them. It starts again on December 1, 2026. Raise the limit to carry on now.");
    expect(out).toContain("1,000 of 1,000 X messages used this month.");
  });
  it("the reset date is read in UTC, so no time zone moves it to the wrong day", () => {
    expect(capReachedLine({ monthlyCap: 5, resumesAt: "2026-12-01T00:00:00.000Z" })).toContain("December 1, 2026");
    expect(capReachedLine({ monthlyCap: 5, resumesAt: null })).toContain("the start of next month");
    expect(capReachedLine({ monthlyCap: 5, resumesAt: "not a date" })).toContain("the start of next month");
    expect(capReachedLine({ monthlyCap: 5, resumesAt: "not a date" })).not.toContain("Invalid");
  });
  it("a control in flight disables EVERY control until the status is re-read", () => {
    const out = html(status(), { busy: true });
    for (const b of out.match(/<button[^>]*>[^<]*<\/button>/g) ?? []) expect(b).toContain('disabled=""');
    expect(out).toMatch(/<input[^>]*disabled=""/);
    const idle = html(status());
    expect(idle.match(/<button[^>]*>Turn on X messages<\/button>/)![0]).not.toContain('disabled=""');
  });
});

describe("the monthly limit", () => {
  it("is a box with the current limit, a Save limit button and the allowed range", () => {
    const out = html(status({ monthlyCap: 250 }));
    expect(out).toContain('value="250"');
    expect(out).toContain(X_DM_COPY.saveLimit);
    expect(out).toContain(CAP_RANGE_ERROR);
  });
  it("accepts whole numbers from 1 to 100,000 (commas allowed) and nothing else", () => {
    expect(parseCap("1")).toBe(1);
    expect(parseCap(" 1,500 ")).toBe(1500);
    expect(parseCap("100000")).toBe(100000);
    for (const bad of ["", "0", "-5", "100001", "12.5", "abc", "1e3", "1000000"]) expect(parseCap(bad)).toBeNull();
    // a comma is a thousands separator or a typo: a typo is refused, never saved as another number
    for (const typo of ["1,00", "1,0,0,0", "1,5", ",100", "1,5000", "10,00"]) expect(parseCap(typo)).toBeNull();
    expect(parseCap("12,345")).toBe(12345);
  });
  it("the range sentence matches the api's", () => {
    expect(CAP_RANGE_ERROR).toBe("Enter a whole number from 1 to 100,000.");
  });
  it("usage reads in plain words", () => {
    expect(usageLine({ usedThisMonth: 1, monthlyCap: 2 })).toBe("1 of 2 X messages used this month.");
  });
});

describe("a status that could not be read", () => {
  it("only a 404 means not released; any other failure is a failure", () => {
    expect(isNotReleased({ status: 404 })).toBe(true);
    for (const e of [{ status: 500 }, { status: 0 }, new Error("network"), null, undefined]) expect(isNotReleased(e)).toBe(false);
    expect(LOAD_FAILED).toBe("X messages could not be loaded.");
    expect(REFRESH_FAILED).toMatch(/Reload it/);
  });
});

describe("errors", () => {
  it("shows the api's sentence, or a next step, never a bare code", () => {
    expect(html(status(), { error: "Grant message access to your X account first, then turn X messages on." })).toContain("Grant message access to your X account first");
    expect(xDmErrorMessage(new Error("X did not accept the request, so X messages are still off. Try again in a moment."))).toMatch(/still off/);
    expect(xDmErrorMessage(null)).toMatch(/try again/);
    expect(html(status())).not.toContain("x-dm-error");
  });
});
