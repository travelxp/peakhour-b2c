import { AISENSY } from "./aisensy";
import { INTERAKT } from "./interakt";
import { REP_AI } from "./rep-ai";
import type { CompetitorBrief } from "./types";

export const COMPETITOR_BRIEFS: readonly CompetitorBrief[] = [AISENSY, INTERAKT, REP_AI];

export function getBrief(slug: string): CompetitorBrief | undefined {
  return COMPETITOR_BRIEFS.find((b) => b.slug === slug);
}

export type { CompetitorBrief } from "./types";
