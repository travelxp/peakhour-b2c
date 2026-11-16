import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import { footerGroups, FooterView } from "./footer";
import { findPageByPath, getPage } from "@/lib/seo/pages";
import { isPublishable } from "@/lib/seo/publish";

const tr = (ns: string) => createTranslator({ locale: "en", messages: en, namespace: ns as never }) as never;
const t = tr("Footer");
// Public routes that are not registry pages.
const FIXED = new Set(["/pricing", "/peaks", "/how-it-works", "/contact", "/privacy-policy", "/terms", "/cookie-policy", "/data-deletion", "/commerce", "/content", "/growth", "/support", "/presence", "/shopify", "/features"]);

describe("footer links", () => {
  const hrefs = footerGroups(t).flatMap((g) => g.links.flatMap((l) => (l.href ? [l.href] : [])));

  it("every href is a publishable registry page or a known public route", () => {
    for (const h of hrefs) {
      const page = findPageByPath(h);
      expect(page ? isPublishable(page) : FIXED.has(h), h).toBe(true);
    }
  });

  it("the section links are registry pages, so the publish guard covers them", () => {
    for (const h of ["/features", "/features/peakhour-summit", "/shopify", "/shopify/features", "/integrations", "/about"]) expect(findPageByPath(h), h).toBeDefined();
    for (const h of hrefs.filter((x) => /^\/(shopify\/|integrations)/.test(x))) expect(findPageByPath(h), h).toBeDefined();
  });

  it("carries the new sections, from the registry", () => {
    for (const h of ["/features", "/features/peakhour-summit", "/shopify/features", "/integrations"]) expect(hrefs).toContain(h);
    expect(hrefs.some((h) => h.startsWith("/shopify/features/"))).toBe(true);
    expect(hrefs.some((h) => h.startsWith("/integrations/"))).toBe(true);
  });

  it("leaves out /about while it is a draft", () => {
    const about = getPage("about");
    expect(isPublishable(about)).toBe(false); // when this flips, About appears and this test should flip with it
    expect(hrefs).not.toContain("/about");
    expect(renderToStaticMarkup(<FooterView t={t} commonT={tr("Common")} />)).not.toContain('href="/about"');
  });

  it("WordPress is plain text, never a link", () => {
    const html = renderToStaticMarkup(<FooterView t={t} commonT={tr("Common")} />);
    expect(html).toContain("WordPress (coming soon)");
    expect(html).not.toMatch(/<a[^>]*>WordPress/);
  });
});
