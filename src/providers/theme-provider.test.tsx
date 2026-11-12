// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

import { ThemeProvider } from "./theme-provider";

/** The server HTML: next-themes' pre-paint <script> is what applies the theme. */
function render(at: string, nonce?: string) {
  path = at;
  return renderToString(
    <ThemeProvider nonce={nonce}>
      <p>page</p>
    </ThemeProvider>,
  );
}

describe("ThemeProvider", () => {
  it("passes the forced light theme into the pre-paint script on a public page", () => {
    const html = render("/shopify");
    // The script's 4th argument is the forced theme.
    expect(html).toMatch(/\("class","theme","system","light",/);
  });

  it("forces nothing in the signed-in app, so the device setting applies", () => {
    const html = render("/dashboard/ask");
    expect(html).toMatch(/\("class","theme","system",null,/);
  });

  it("stamps the CSP nonce on the pre-paint script", () => {
    const html = render("/", "abc123");
    expect(html).toMatch(/<script[^>]*nonce="abc123"/);
  });
});
