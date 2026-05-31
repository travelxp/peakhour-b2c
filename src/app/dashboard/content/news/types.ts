/**
 * News Desk (N5) — the autonomous newsroom's approval queue. Shows corroborated,
 * brand-voice news drafts (cnt_ideas source="trending", status="review") with the
 * sources that back each story. Read-only v1 (1-tap approve is a follow-up).
 *
 * Shapes mirror GET /v1/content/ideas (peakhour-api content route).
 */

export interface NewsSourceProvenance {
  sourceId?: string;
  externalUrl?: string;
  sourceType: "trusted" | "general" | "web_search" | "internal_library";
  contribution: "primary" | "supporting" | "validation";
  snippet?: string;
  capturedAt?: string;
  trustScoreAtTime?: number;
}

export interface NewsIdea {
  _id: string;
  title: string;
  description?: string;
  status: string;
  source: string;
  channels?: string[];
  content?: { subject?: string; plainText?: string; wordCount?: number };
  sourceProvenance?: NewsSourceProvenance[];
  recommendationTags?: string[];
  recommendationStrength?: number;
  createdAt?: string;
}
