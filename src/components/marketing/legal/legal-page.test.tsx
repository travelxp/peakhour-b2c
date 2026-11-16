import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LegalPage } from "./legal-page";

vi.mock("@/components/shared/header", () => ({ Header: () => null }));
vi.mock("@/components/shared/footer", () => ({ Footer: () => null }));

const render = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("LegalPage contents", () => {
  const page = render(
    <LegalPage title="T" lastUpdated="Jan 1, 2026">
      <section><h2 id="intro">1. Intro</h2><p>a</p></section>
      <section><h2>2. Things We Collect &amp; Why</h2><h3>2.1 Sub</h3></section>
      <section><h2>2. Things We Collect &amp; Why</h2></section>
    </LegalPage>,
  );
  it("keeps an existing id and gives the others a clean, unique one", () => {
    expect(page).toContain('<h2 id="intro">');
    expect(page).toContain('<h2 id="things-we-collect-why">');
    expect(page).toContain('<h2 id="things-we-collect-why-2">');
  });
  it("lists every h2 in the contents, twice (phone and desktop)", () => {
    expect(page.match(/href="#intro"/g)).toHaveLength(2);
    expect(page.match(/href="#things-we-collect-why-2"/g)).toHaveLength(2);
  });
  it("shows the Last updated chip and no contents for a one-section page", () => {
    const one = render(<LegalPage title="T" lastUpdated="Jan 1, 2026"><section><h2>Only</h2></section></LegalPage>);
    expect(one).toContain("Last updated: Jan 1, 2026");
    expect(one).not.toContain("On this page");
  });
});
