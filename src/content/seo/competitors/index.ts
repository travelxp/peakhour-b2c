import { AISENSY } from "./aisensy";
import { INTERAKT } from "./interakt";
import { REP_AI } from "./rep-ai";
// CMP-A
import { GOKWIK } from "./gokwik";
import { WATI } from "./wati";
import { ZOKO } from "./zoko";
import type { CompetitorBrief } from "./types";

export const COMPETITOR_BRIEFS: readonly CompetitorBrief[] = [AISENSY, INTERAKT, REP_AI, WATI, ZOKO, GOKWIK];

export function getBrief(slug: string): CompetitorBrief | undefined {
  return COMPETITOR_BRIEFS.find((b) => b.slug === slug);
}

export type { CompetitorBrief } from "./types";
