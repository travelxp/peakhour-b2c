import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

/**
 * Drive uploads PUT each part straight to an R2 presigned URL. The page's CSP `connect-src` must allow that host, or the browser blocks
 * the request before it leaves and the uploader says "The connection dropped" (status 0, no response).
 */
describe("the page's Content-Security-Policy", () => {
  it("lets the browser send upload parts to R2", () => {
    const res = middleware(new NextRequest("http://localhost:3000/dashboard/drive"));
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    const connect = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src")) ?? "";
    expect(connect).toContain("https://*.r2.cloudflarestorage.com");
  });
});
