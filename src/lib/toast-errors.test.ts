import { describe, it, expect, vi, beforeEach } from "vitest";

const errorToast = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => errorToast(...args) } }));

import { toastUnhandledApiError } from "./toast-errors";
import { ApiError } from "@/lib/api";

const REQ = "bc662f49-6c8a-41cb-9e40-5156925f6202";

/** The single toast the call produced. */
function shown() {
  expect(errorToast).toHaveBeenCalledTimes(1);
  const [title, opts] = errorToast.mock.calls[0] as [
    string,
    { description?: string; duration?: number } | undefined,
  ];
  return { title, description: opts?.description ?? "", duration: opts?.duration };
}

/** Every real failure has a request id — the api stamps meta.request_id
 *  on every envelope — so fixtures carry one unless testing its absence. */
function apiError(code: string, status: number, message = "raw provider text") {
  return new ApiError(code, message, status, REQ);
}

beforeEach(() => {
  errorToast.mockClear();
});

describe("retryability comes from the CODE, not the status", () => {
  it("does NOT tell the user to retry a platform rejection, despite its 502", () => {
    // THE motivating case. PROVIDER_4XX_* ships with HTTP 502, so a
    // status-based split gets this exactly backwards — and "try again in
    // a moment" on a 100%-reproducible bug is what hid it for months.
    toastUnhandledApiError(
      apiError("PROVIDER_4XX_CREATE_CAMPAIGN_GROUP", 502),
      "create the campaign",
      "LinkedIn",
    );
    const { title } = shown();
    expect(title).toBe("Couldn't create the campaign.");
    expect(title).not.toContain("Try again");
  });

  it("DOES tell the user to retry a genuine platform 5xx", () => {
    toastUnhandledApiError(apiError("PROVIDER_5XX_CREATE_CAMPAIGN", 502), "create the campaign");
    expect(shown().title).toBe("Couldn't create the campaign. Try again in a moment.");
  });

  it("does NOT retry a 2xx-with-no-id — a retry mints another orphan", () => {
    // provider_5xx_group_id_missing means LinkedIn 2xx'd the create and
    // omitted the id header: the group exists, we can't dedupe it, and
    // every retry leaves a fresh orphan in the customer's account.
    toastUnhandledApiError(apiError("PROVIDER_5XX_GROUP_ID_MISSING", 502), "create the campaign");
    expect(shown().title).not.toContain("Try again");
  });

  it("does NOT retry a route catch-all — those are config/programming faults", () => {
    // BOOST_FAILED etc. wrap a non-AdsOpError throw, e.g.
    // "LINKEDIN_CLIENT_ID is not set". Retrying is retrying forever.
    for (const code of ["BOOST_FAILED", "TARGETING_FAILED", "INTERNAL_ERROR", "ADAPTER_MISSING"]) {
      errorToast.mockClear();
      toastUnhandledApiError(apiError(code, 500), "create the campaign");
      expect(shown().title, code).not.toContain("Try again");
    }
  });

  it("treats a thrown non-ApiError as a connectivity problem", () => {
    // fetch rejects with a plain TypeError when the request never lands.
    toastUnhandledApiError(new TypeError("Failed to fetch"), "apply the targeting");
    expect(shown().title).toBe(
      "Couldn't apply the targeting. Check your connection and try again.",
    );
  });
});

describe("user-fixable codes keep their own advice", () => {
  // These must never collapse into "contact support" — they're reachable
  // unhandled on the X and optimizer surfaces, where there is no branch
  // above the helper.
  const cases: Array<[string, number, RegExp]> = [
    ["RATE_LIMITED", 429, /rate-limiting/i],
    ["NEEDS_REAUTH", 409, /reconnect/i],
    ["NOT_CONNECTED", 400, /Integrations/],
    ["NO_AD_ACCOUNT", 400, /ad account/i],
    ["FORBIDDEN", 403, /business/i],
    ["INVALID_TRANSITION", 409, /current state/i],
  ];

  for (const [code, status, expected] of cases) {
    it(`${code} gets actionable copy, not a support pointer`, () => {
      toastUnhandledApiError(apiError(code, status), "update the campaign");
      const { description } = shown();
      expect(description).toMatch(expected);
      expect(description).not.toMatch(/contact support/i);
    });
  }
});

describe("permanent failures point at support, and survive being read", () => {
  it("quotes the request id and does not auto-dismiss", () => {
    toastUnhandledApiError(apiError("PROVIDER_4XX_CREATE_CAMPAIGN", 502), "create the campaign", "LinkedIn");
    const { description, duration } = shown();
    expect(description).toContain(`reference ${REQ}`);
    expect(description).toContain("LinkedIn rejected the request.");
    // A 4s auto-dismiss makes a 36-char uuid untranscribable.
    expect(duration).toBe(Infinity);
  });

  it("stays platform-neutral when the caller didn't name one", () => {
    // The optimizer board and X surfaces share this helper — naming the
    // wrong platform is worse than naming none.
    toastUnhandledApiError(apiError("PROVIDER_4XX_X", 502), "record the decision");
    const { description } = shown();
    expect(description).toContain("The request was rejected.");
    expect(description).not.toContain("LinkedIn");
  });

  it("names the platform the caller passed", () => {
    toastUnhandledApiError(apiError("PROVIDER_4XX_X", 502), "update the campaign status", "X");
    expect(shown().description).toContain("X rejected the request.");
  });

  it("still points at support with no request id to quote", () => {
    toastUnhandledApiError(
      new ApiError("PROVIDER_4XX_X", "raw", 502),
      "create the campaign",
    );
    const { description } = shown();
    expect(description).toMatch(/contact support\.$/);
    expect(description).not.toContain("reference");
  });
});

describe("retryable toasts stay a single sentence", () => {
  it("adds no description — a support reference is noise on a self-healing blip", () => {
    // Fixture carries a request id, which is the production case: this
    // must hold BECAUSE of the disposition, not because the id is absent.
    toastUnhandledApiError(apiError("PROVIDER_5XX_X", 502), "refresh the metrics");
    const { description, duration } = shown();
    expect(description).toBe("");
    expect(duration).toBeUndefined();
  });
});

describe("never leaks the raw provider message", () => {
  // Mirrors the engageErrorMessage convention (audience-panel.test.ts):
  // the api's message for these codes is LinkedIn's raw response body,
  // or an arbitrary exception string.
  const leaky = [
    apiError("PROVIDER_4XX_CREATE_CAMPAIGN", 502, '{"serviceErrorCode":100,"message":"secret-internal"}'),
    apiError("BOOST_FAILED", 502, "LINKEDIN_CLIENT_ID is not set"),
    apiError("INTERNAL_ERROR", 500, "E11000 duplicate key on secret-internal"),
    apiError("VALIDATION_AD_ACCOUNT_ID", 400, 'got "secret-internal"'),
    apiError("RATE_LIMITED", 429, "LinkedIn API 429: secret-internal"),
  ];

  for (const err of leaky) {
    it(`keeps ${err.code}'s raw text out of the toast`, () => {
      toastUnhandledApiError(err, "create the campaign", "LinkedIn");
      const { title, description } = shown();
      const rendered = `${title} ${description}`;
      // Guard against passing on empty output.
      expect(title.length).toBeGreaterThan(10);
      expect(rendered).not.toContain("secret-internal");
      expect(rendered).not.toContain("LINKEDIN_CLIENT_ID");
      expect(rendered).not.toContain("E11000");
    });
  }
});
