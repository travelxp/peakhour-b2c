import { expect, it } from "vitest";
import { stripReturnParams } from "@/lib/strip-return-params";

it("keeps a returnTo's own query when stripping the connect params", () => {
  const sp = new URLSearchParams("integration=connected&provider=x&meta_notice=n&channel=linkedin");
  expect(stripReturnParams(sp, ["integration", "provider", "meta_notice"])).toBe("channel=linkedin");
  expect(stripReturnParams(null, ["a"])).toBe("");
});
