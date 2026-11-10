"use client";



export interface ContentStats {
  total: number;
  tagged: number;
  taggedPercent: number;
  /** Drafts at status="partial_tagged" — landed but a critical field
   *  (audienceRelevance / contentType) was missing. The targeted
   *  "Re-analyse N incomplete" button re-processes these. */
  partialTagged?: number;
  /** Drafts with errorClass=transient unprocessable stamp (AI infra
   *  blip; permanent stamps stay since they need manual intervention). */
  transientUnprocessable?: number;
  /** partialTagged + transientUnprocessable — the re-eligible count
   *  the targeted re-analyse button targets. */
  incomplete?: number;
  highPotential: number;
  avgAdScore: number;
  evergreenPercent: number;
  sectorDiversity: number;
  contentReadinessScore: number;
  shelfLifeDistribution: Record<string, number>;
  sentimentDistribution: Record<string, number>;
}

export interface GapAnalysis {
  sectorCoverage: { _id: string; count: number; avgWeight: number }[];
  audienceCoverage: { _id: string; count: number; avgRelevance: number }[];
  highPotentialUnused: {
    contentId: string;
    contentTitle: string;
    adPotential: { score: number; bestAngle?: string; bestHook?: string };
    sectors: { name: string; weight: number }[];
  }[];
  keywordFrequency: { _id: string; count: number }[];
  contentTypeDistribution: { _id: string; count: number }[];
  shelfLifeDistribution: { _id: string; count: number }[];
  recommendations: string[];
}

// ── Constants ────────────────────────────────────────────────────

export const CONTENT_FETCH_LIMIT = 500;

// ── Main Page ────────────────────────────────────────────────────
