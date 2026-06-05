import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import { engageErrorMessage } from "./audience-panel";

describe("engageErrorMessage", () => {
  it("nudges reconnect on RECONNECT_REQUIRED", () => {
    expect(engageErrorMessage(new ApiError("RECONNECT_REQUIRED", "raw", 403))).toMatch(
      /reconnect linkedin/i,
    );
  });

  it("nudges reconnect on any 403", () => {
    expect(engageErrorMessage(new ApiError("FORBIDDEN", "raw transport", 403))).toMatch(
      /reconnect linkedin/i,
    );
  });

  it("surfaces a rate-limit message on 429", () => {
    expect(engageErrorMessage(new ApiError("RATE_LIMITED", "raw", 429))).toMatch(
      /rate-limit/i,
    );
  });

  it("never leaks the raw error string", () => {
    const msg = engageErrorMessage(new ApiError("PUBLISH_FAILED", "LinkedIn 500: secret-internal", 500));
    expect(msg).not.toContain("secret-internal");
    expect(msg).toMatch(/couldn't reach linkedin/i);
  });

  it("handles a non-ApiError throwable", () => {
    expect(engageErrorMessage(new Error("boom"))).toMatch(/couldn't reach linkedin/i);
    expect(engageErrorMessage("string error")).toMatch(/couldn't reach linkedin/i);
  });
});
