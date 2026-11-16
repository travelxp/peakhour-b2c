import { AISENSY } from "./aisensy";
import { INTERAKT } from "./interakt";
import { REP_AI } from "./rep-ai";
// CMP-C1 (Shopify) and CMP-C2 (global) imports.
import { BIRDEYE } from "./birdeye";
import { BUFFER } from "./buffer";
import { HOOTSUITE } from "./hootsuite";
import { JASPER } from "./jasper";
import { LIMESPOT } from "./limespot";
import { NOSTO } from "./nosto";
import { REBUY } from "./rebuy";
import { SEARCHPIE } from "./searchpie";
import { SEOWILL } from "./seowill";
import { TINYIMG } from "./tinyimg";
import type { CompetitorBrief } from "./types";

export const COMPETITOR_BRIEFS: readonly CompetitorBrief[] = [
  AISENSY,
  INTERAKT,
  REP_AI,
  // CMP-C1: Shopify
  REBUY,
  LIMESPOT,
  NOSTO,
  TINYIMG,
  SEARCHPIE,
  SEOWILL,
  // CMP-C2: global
  HOOTSUITE,
  BUFFER,
  JASPER,
  BIRDEYE,
];

export function getBrief(slug: string): CompetitorBrief | undefined {
  return COMPETITOR_BRIEFS.find((b) => b.slug === slug);
}

export type { CompetitorBrief } from "./types";
