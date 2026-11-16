import { AISENSY } from "./aisensy";
import { INTERAKT } from "./interakt";
import { REP_AI } from "./rep-ai";
// CMP-A
import { GOKWIK } from "./gokwik";
import { WATI } from "./wati";
import { ZOKO } from "./zoko";
// CMP-B
import { GORGIAS } from "./gorgias";
import { MANIFEST_AI } from "./manifest-ai";
import { SHOPIFY_INBOX } from "./shopify-inbox";
import { SIDEKICK } from "./sidekick";
import { TIDIO } from "./tidio";
import type { CompetitorBrief } from "./types";

export const COMPETITOR_BRIEFS: readonly CompetitorBrief[] = [
  AISENSY, INTERAKT, REP_AI,
  WATI, ZOKO, GOKWIK,
  GORGIAS, TIDIO, MANIFEST_AI, SHOPIFY_INBOX, SIDEKICK,
];

export function getBrief(slug: string): CompetitorBrief | undefined {
  return COMPETITOR_BRIEFS.find((b) => b.slug === slug);
}

export type { CompetitorBrief } from "./types";
