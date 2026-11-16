import { AISENSY } from "./aisensy";
import { INTERAKT } from "./interakt";
import { REP_AI } from "./rep-ai";
// CMP-A
import { GOKWIK } from "./gokwik";
import { WATI } from "./wati";
import { ZOKO } from "./zoko";
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

const BRIEFS = [
  AISENSY,
  INTERAKT,
  REP_AI,
  // CMP-A
  WATI,
  ZOKO,
  GOKWIK,
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
] satisfies readonly CompetitorBrief[];

export const COMPETITOR_BRIEFS: readonly CompetitorBrief[] = BRIEFS;

/** Every brief's slug, as a literal union keyed off the briefs themselves. */
export type CompetitorSlug = (typeof BRIEFS)[number]["slug"];

export function getBrief(slug: string): CompetitorBrief | undefined {
  return COMPETITOR_BRIEFS.find((b) => b.slug === slug);
}

export type { CompetitorBrief } from "./types";
