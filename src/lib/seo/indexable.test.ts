import { describe, it, expect } from "vitest";
import { isIndexableDeployment } from "./indexable";

describe("isIndexableDeployment", () => {
  it("is true only on the Vercel Production deployment", () => {
    expect(isIndexableDeployment({ VERCEL_ENV: "production" })).toBe(true);
  });

  it("is false on preview (dev.peakhour.ai), development and a local build", () => {
    expect(isIndexableDeployment({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isIndexableDeployment({ VERCEL_ENV: "development" })).toBe(false);
    expect(isIndexableDeployment({})).toBe(false);
  });

  it("SITE_INDEXABLE=false forces false even on production", () => {
    expect(isIndexableDeployment({ VERCEL_ENV: "production", SITE_INDEXABLE: "false" })).toBe(false);
  });

  it("nothing forces true: SITE_INDEXABLE=true does not open a preview or a local build", () => {
    for (const v of ["true", "1", "yes", "TRUE"]) {
      expect(isIndexableDeployment({ VERCEL_ENV: "preview", SITE_INDEXABLE: v })).toBe(false);
      expect(isIndexableDeployment({ SITE_INDEXABLE: v })).toBe(false);
    }
  });

  it("production without SITE_INDEXABLE set stays indexable (no opt-in variable to forget)", () => {
    expect(isIndexableDeployment({ VERCEL_ENV: "production", SITE_INDEXABLE: undefined })).toBe(true);
    expect(isIndexableDeployment({ VERCEL_ENV: "production", SITE_INDEXABLE: "true" })).toBe(true);
  });
});
