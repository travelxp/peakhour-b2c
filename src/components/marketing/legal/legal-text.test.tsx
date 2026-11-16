import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import golden from "./legal-golden.json";

vi.mock("@/components/shared/header", () => ({ Header: () => null }));
vi.mock("@/components/shared/footer", () => ({ Footer: () => null }));

/**
 * The legal documents may be restyled, never reworded. `legal-golden.json` was captured from the five pages BEFORE the
 * Daylight redesign (DL-1): each document's title, its "Last updated" line, the text of the whole body (tags
 * stripped, entities as written) and every href in it. If a word, a link or the order of either changes, this fails.
 * Changing the legal text is a legal decision: edit the page AND regenerate the golden in the same reviewed change.
 */

type LegalEl = ReactElement<{ title: string; lastUpdated: string; children: unknown }>;

const PAGES = {
  privacy: () => import("@/app/(site)/privacy-policy/page"),
  terms: () => import("@/app/(site)/terms/page"),
  cookies: () => import("@/app/(site)/cookie-policy/page"),
  deletion: () => import("@/app/(site)/data-deletion/page"),
  retention: () => import("@/app/(site)/help/data-retention/page"),
} as const;

const textOf = (markup: string) => markup.replace(/<[^>]+>/g, "");
const hrefsOf = (markup: string) => [...markup.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

describe("legal text is byte-identical to the golden", () => {
  for (const [key, load] of Object.entries(PAGES)) {
    it(key, async () => {
      const mod = await load();
      const page = mod.default as unknown as (p: unknown) => unknown;
      const el = (await page({ searchParams: Promise.resolve({}) })) as LegalEl;
      const markup = renderToStaticMarkup(el.props.children as never);
      const want = golden[key as keyof typeof golden];
      expect(el.props.title).toBe(want.title);
      expect(`Last updated: ${el.props.lastUpdated}`).toBe(want.lastUpdated);
      expect(textOf(markup)).toBe(want.text);
      expect(hrefsOf(markup)).toEqual(want.hrefs);
    });
  }
});
