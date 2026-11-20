import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { b2cAccessCookieName, b2cRefreshCookieName } from "./auth-cookies";

/**
 * Must stay byte-identical to peakhour-api's resolution: not preview → bare
 * names (production), VERCEL_ENV="preview" → dev_ prefix. If these drift
 * from the API, the coming-soon middleware's soft-session bypass reads a
 * cookie the API never wrote.
 */
describe("b2c auth cookie names", () => {
  const prev = process.env.VERCEL_ENV;
  beforeEach(() => {
    delete process.env.VERCEL_ENV;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prev;
  });

  it("no VERCEL_ENV (local) → bare names", () => {
    expect(b2cAccessCookieName()).toBe("access_token");
    expect(b2cRefreshCookieName()).toBe("refresh_token");
  });

  it("production and development → bare names", () => {
    process.env.VERCEL_ENV = "production";
    expect(b2cAccessCookieName()).toBe("access_token");
    process.env.VERCEL_ENV = "development";
    expect(b2cAccessCookieName()).toBe("access_token");
  });

  it('preview (every dev deployment) → dev_-prefixed names', () => {
    process.env.VERCEL_ENV = "preview";
    expect(b2cAccessCookieName()).toBe("dev_access_token");
    expect(b2cRefreshCookieName()).toBe("dev_refresh_token");
  });
});
