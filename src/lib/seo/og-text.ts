import { SITE } from "@/lib/utils";
import type { PageFamily, PageRecord, Pillar } from "./types";

const PILLAR: Record<Pillar, string> = {
  commerce: "Commerce",
  content: "Content",
  growth: "Growth",
  support: "Support",
  presence: "Presence",
};

const FAMILY: Partial<Record<PageFamily, string>> = {
  feature: "Feature",
  solution: "Solution",
  industry: "Industry",
  platform: "Platform",
  integration: "Integration",
  compare: "Comparison",
  guide: "Guide",
  tool: "Tool",
  "case-study": "Case study",
  "shopify-feature": "Peakhour for Shopify",
  "shopify-solution": "Peakhour for Shopify",
  "shopify-compare": "Peakhour for Shopify",
  "shopify-alternatives": "Peakhour for Shopify",
  "shopify-guide": "Peakhour for Shopify",
  "shopify-tool": "Peakhour for Shopify",
};

/** The small line above the title: the family, else the pillar, else the site. */
export function eyebrowFor(page: Pick<PageRecord, "family" | "scope" | "primaryPillar" | "surface">): string {
  const fam = FAMILY[page.family];
  if (fam) return fam;
  if (page.surface === "shopify") return "Peakhour for Shopify";
  if (page.primaryPillar) return `${PILLAR[page.primaryPillar]} · ${SITE.name}`;
  return SITE.name;
}

/** The H1 as the card shows it: a trailing "| Peakhour.ai" or "- Peakhour.ai" is dropped, the logo already says it. */
export function ogTitleFor(page: Pick<PageRecord, "h1">): string {
  return page.h1.replace(/\s+[|–—-]\s+Peakhour(\.ai)?$/i, "").trim();
}
