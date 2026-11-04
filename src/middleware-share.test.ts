import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

/**
 * A Drive share link lands on /share/<token> for a person with no account. While the coming-soon gate is on, every route is rewritten
 * to the teaser except the public allowlist, so `/share` must be on it or no visitor could ever open a shared file.
 */
const original = process.env.COMING_SOON;
afterEach(() => {
  if (original === undefined) delete process.env.COMING_SOON;
  else process.env.COMING_SOON = original;
});

const rewrittenTo = (path: string) => {
  process.env.COMING_SOON = "true";
  return middleware(new NextRequest(`http://localhost:3000${path}`)).headers.get("x-middleware-rewrite");
};

describe("the coming-soon gate", () => {
  it("lets the share page through", () => {
    expect(rewrittenTo(`/share/${"t".repeat(43)}`)).toBeNull();
  });

  it("still gates an ordinary page, so the check above is not vacuous", () => {
    expect(rewrittenTo("/dashboard/drive")).toContain("/coming-soon");
    expect(rewrittenTo("/some-private-page")).toContain("/coming-soon");
  });

  it("does not let a look-alike prefix through", () => {
    expect(rewrittenTo("/shared")).toContain("/coming-soon");
    expect(rewrittenTo("/share-me")).toContain("/coming-soon");
  });
});
