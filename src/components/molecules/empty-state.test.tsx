import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Store } from "lucide-react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("titles itself with an h2, so a page with only an h1 above it does not skip a heading level", () => {
    const html = renderToStaticMarkup(
      <EmptyState icon={Store} title="Connect a store to get started" description="Link your store." />,
    );
    expect(html).toContain('<h2 class="mt-4 text-lg font-semibold">Connect a store to get started</h2>');
    expect(html).not.toContain("<h3");
  });
});
