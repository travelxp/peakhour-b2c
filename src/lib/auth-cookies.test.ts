import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { b2cAccessCookieName, b2cRefreshCookieName } from "./auth-cookies";

/**
 * Must stay byte-identical to peakhour-api's resolution: unset → bare
 * names (production), AUTH_COOKIE_NS="dev" → dev_ prefix. If these drift
 * from the API, the coming-soon middleware's soft-session bypass reads a
 * cookie the API never wrote.
 */
describe("b2c auth cookie names", () => {
  const prev = process.env.AUTH_COOKIE_NS;
  beforeEach(() => {
    delete process.env.AUTH_COOKIE_NS;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.AUTH_COOKIE_NS;
    else process.env.AUTH_COOKIE_NS = prev;
  });

  it("UNSET → bare names", () => {
    expect(b2cAccessCookieName()).toBe("access_token");
    expect(b2cRefreshCookieName()).toBe("refresh_token");
  });

  it("empty / whitespace → bare names (no leading underscore)", () => {
    process.env.AUTH_COOKIE_NS = "";
    expect(b2cAccessCookieName()).toBe("access_token");
    process.env.AUTH_COOKIE_NS = "   ";
    expect(b2cAccessCookieName()).toBe("access_token");
  });

  it('"dev" → dev_-prefixed names', () => {
    process.env.AUTH_COOKIE_NS = "dev";
    expect(b2cAccessCookieName()).toBe("dev_access_token");
    expect(b2cRefreshCookieName()).toBe("dev_refresh_token");
  });
});
