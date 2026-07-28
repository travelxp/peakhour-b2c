import { describe, it, expect, vi, beforeEach } from "vitest";

const errorToast = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => errorToast(...args) } }));

import { toastUnhandledApiError } from "./toast-errors";
import { ApiError } from "@/lib/api";

/** [title, description] of the single toast the call produced. */
function shown() {
  expect(errorToast).toHaveBeenCalledTimes(1);
  const [title, opts] = errorToast.mock.calls[0] as [string, { description?: string } | undefined];
  return { title, description: opts?.description ?? "" };
}

beforeEach(() => {
  errorToast.mockClear();
});

describe("toastUnhandledApiError — retryability comes from the CODE", () => {
  it("does NOT tell the user to retry a platform rejection, despite its 502", () => {
    // THE motivating case. PROVIDER_4XX_* ships with HTTP 502, so a
    // status-based split gets this exactly backwards — and "try again
    // in a moment" on a 100%-reproducible bug is what hid it for months.
    toastUnhandledApiError(
      new ApiError("PROVIDER_4XX_CREATE_CAMPAIGN_GROUP", "raw linkedin body", 502),
      "create the campaign",
    );
    const { title } = shown();
    expect(title).toBe("Couldn't create the campaign.");
    expect(title).not.toContain("Try again");
  });

  it("DOES tell the user to retry a genuine platform 5xx", () => {
    toastUnhandledApiError(
      new ApiError("PROVIDER_5XX_CREATE_CAMPAIGN", "upstream exploded", 502),
      "create the campaign",
    );
    expect(shown().title).toBe("Couldn't create the campaign. Try again in a moment.");
  });

  it("does not offer retry for our own misconfiguration", () => {
    // ADAPTER_MISSING / CONFIG_ERROR are ours to fix; retrying never helps.
    for (const code of ["ADAPTER_MISSING", "CONFIG_ERROR"]) {
      errorToast.mockClear();
      toastUnhandledApiError(new ApiError(code, "internal", 500), "create the campaign");
      expect(shown().title).not.toContain("Try again");
    }
  });

  it("retries a validation-shaped 400 never, a network kind always", () => {
    toastUnhandledApiError(new ApiError("VALIDATION_ERROR", "bad body", 400), "boost");
    expect(shown().title).not.toContain("Try again");
    errorToast.mockClear();
    toastUnhandledApiError(new ApiError("NETWORK_CREATE_CAMPAIGN", "socket", 502), "boost");
    expect(shown().title).toContain("Try again");
  });

  it("treats a thrown non-ApiError as a connectivity problem", () => {
    // fetch rejects with a plain TypeError when the request never lands.
    toastUnhandledApiError(new TypeError("Failed to fetch"), "apply the targeting");
    expect(shown().title).toBe("Couldn't apply the targeting. Check your connection and try again.");
  });
});

describe("toastUnhandledApiError — never leaks the raw provider message", () => {
  // Mirrors the engageErrorMessage convention (audience-panel.test.ts):
  // the api's message for these codes is LinkedIn's raw response body,
  // or an arbitrary exception string.
  const leaky = [
    new ApiError("PROVIDER_4XX_CREATE_CAMPAIGN", '{"serviceErrorCode":100,"message":"secret-internal"}', 502),
    new ApiError("BOOST_FAILED", "LINKEDIN_CLIENT_ID is not set", 502),
    new ApiError("INTERNAL_ERROR", "E11000 duplicate key on secret-internal", 500),
    new ApiError("VALIDATION_AD_ACCOUNT_ID", 'got "secret-internal"', 400),
  ];

  for (const err of leaky) {
    it(`keeps ${err.code}'s raw text out of the toast`, () => {
      toastUnhandledApiError(err, "create the campaign");
      const { title, description } = shown();
      expect(`${title} ${description}`).not.toContain("secret-internal");
      expect(`${title} ${description}`).not.toContain("LINKEDIN_CLIENT_ID");
      expect(`${title} ${description}`).not.toContain("E11000");
    });
  }
});

describe("toastUnhandledApiError — request id is the support handle", () => {
  it("includes the request id when the envelope carried one", () => {
    toastUnhandledApiError(
      new ApiError("PROVIDER_4XX_CREATE_CAMPAIGN", "raw", 502, "bc662f49-6c8a-41cb-9e40-5156925f6202"),
      "create the campaign",
    );
    expect(shown().description).toContain("Reference: bc662f49-6c8a-41cb-9e40-5156925f6202");
  });

  it("still points at support when there is no request id", () => {
    toastUnhandledApiError(new ApiError("PROVIDER_4XX_X", "raw", 502), "create the campaign");
    expect(shown().description).toContain("contact support");
  });

  it("adds no description at all for a plain retryable blip", () => {
    // "Try again in a moment" is complete on its own — a support
    // reference would be noise on something that self-heals.
    toastUnhandledApiError(new ApiError("PROVIDER_5XX_X", "raw", 502), "refresh the metrics");
    expect(shown().description).toBe("");
  });
});
