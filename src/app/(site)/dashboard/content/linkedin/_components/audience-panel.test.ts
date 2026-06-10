import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import { engageErrorMessage, buildEngageAsOptions } from "./audience-panel";

const identity = (over: Partial<{ scopes: string[]; name: string | null; pages: Array<{ id: string; name: string }> }> = {}) => ({
  scopes: over.scopes ?? ["w_member_social", "w_organization_social"],
  person: { name: over.name ?? "Jane" } as { name: string | null },
  pages: over.pages ?? [{ id: "555", name: "Acme" }, { id: "777", name: "Beta" }],
});

describe("buildEngageAsOptions", () => {
  it("offers person-only when identity is undefined", () => {
    const { options, defaultKey } = buildEngageAsOptions(undefined, "urn:li:organization:555");
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ key: "person", author: { type: "person" } });
    expect(defaultKey).toBe("person");
  });

  it("adds managed pages and defaults to the brand page that authored the post", () => {
    const { options, defaultKey } = buildEngageAsOptions(identity(), "urn:li:organization:555");
    expect(options.map((o) => o.key)).toEqual(["person", "org:555", "org:777"]);
    expect(defaultKey).toBe("org:555");
    expect(options.find((o) => o.key === "org:555")?.author).toEqual({ type: "org", pageId: "555" });
  });

  it("labels the person option with the member name", () => {
    expect(buildEngageAsOptions(identity({ name: "Jane" }), "").options[0].label).toBe("You (Jane)");
    const noName = { scopes: ["w_member_social"], person: { name: null }, pages: [] };
    expect(buildEngageAsOptions(noName, "").options[0].label).toBe("You");
  });

  it("omits pages (and defaults to person) without the org-social scope", () => {
    const { options, defaultKey } = buildEngageAsOptions(
      identity({ scopes: ["w_member_social"] }),
      "urn:li:organization:555",
    );
    expect(options).toHaveLength(1);
    expect(defaultKey).toBe("person");
  });

  it("defaults to person when the post author is an UNMANAGED org", () => {
    expect(buildEngageAsOptions(identity(), "urn:li:organization:999").defaultKey).toBe("person");
  });

  it("defaults to person for a personal-post author or empty author", () => {
    expect(buildEngageAsOptions(identity(), "urn:li:person:abc").defaultKey).toBe("person");
    expect(buildEngageAsOptions(identity(), "").defaultKey).toBe("person");
  });
});

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

  it("nudges reconnect on NOT_CONNECTED (expired token on the write path)", () => {
    expect(engageErrorMessage(new ApiError("NOT_CONNECTED", "raw", 400))).toMatch(
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
