"use client";

import { type LinkedInVoiceCard } from "@/lib/api/linkedin-content";
import { type RewriteOp, type VoiceCardSummary } from "@/components/composer";

export function isProbablyUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Map the LinkedIn-specific voice card to the shared
 *  <VoiceCardPreview/> summary shape. Returns null when no card has
 *  been synthesised yet (the preview renders nothing for null). */
export function mapVoiceCardSummary(card: LinkedInVoiceCard | undefined): VoiceCardSummary | null {
  if (!card) return null;
  return {
    id: `linkedin-post-v${card.version}`,
    channel: "linkedin",
    category: "post",
    toneAdjectives: card.voice.tone ?? [],
    signaturePhrases: card.voice.signaturePhrases ?? [],
    avoidPhrases: card.voice.avoidPhrases ?? [],
    refreshedAt: card.lastGeneratedAt,
  };
}

/**
 * Toast copy per AI op, and how loudly to say it.
 *
 * ★The two length ops carry their numbers, and the numbers decide the tone.
 * Their whole promise is a change the user is supposed to SEE, so a bare
 * "Draft shortened." is unfalsifiable — it reads identically whether 40%
 * came off or nothing did. "412 → 268 characters (−35%)" is checkable
 * against the box in front of them, and a Shorten that came back LONGER is
 * not a success to be congratulated in green.
 *
 * Message and level are derived from the same measurement here rather than
 * decided by the caller, which is what stopped them contradicting each other.
 */
export function aiOpToast(
  op: RewriteOp,
  before?: string,
  after?: string,
): { message: string; success: boolean } {
  switch (op) {
    case "compose":
      return { message: "Draft composed.", success: true };
    case "redraft":
      return { message: "Draft rewritten.", success: true };
    case "shorten":
    case "lengthen": {
      const from = before?.trim().length ?? 0;
      const to = after?.trim().length ?? 0;
      // No measurement to report — fall back to the plain claim rather than
      // render "0 → 0 characters".
      if (from === 0 || to === 0) {
        return {
          message: op === "shorten" ? "Draft shortened." : "Draft expanded.",
          success: true,
        };
      }
      if (to === from) {
        return { message: `Draft rewritten — still ${to} characters.`, success: false };
      }
      const grew = to > from;
      const pct = Math.round((Math.abs(to - from) / from) * 100);
      const delta = `${from} → ${to} characters (${grew ? "+" : "−"}${pct}%)`;
      // ★The verb follows the MEASUREMENT, not the button that was pressed.
      // When both attempts miss the length band the api returns the closer
      // one rather than failing, so a Shorten can legitimately come back
      // longer — and "Draft shortened … (+30%)" is a sentence that argues
      // with the number beside it.
      const didWhatWasAsked = op === "shorten" ? !grew : grew;
      if (didWhatWasAsked) {
        return {
          message: `${grew ? "Draft expanded" : "Draft shortened"} — ${delta}.`,
          success: true,
        };
      }
      return {
        message: `${
          op === "shorten" ? "Shorten" : "Lengthen"
        } came back the wrong way — ${delta}. Try again.`,
        success: false,
      };
    }
    case "tone":
      return { message: "Tone updated.", success: true };
    case "quote":
      return { message: "Pull-quote added.", success: true };
    case "disclosure":
      return { message: "Disclosure added.", success: true };
  }
}

/** What we say when a replace op returned the draft it was handed. Neutral
 *  (`toast.message`), not success and not an error: the call worked, the
 *  model just produced nothing worth applying. */
export function aiOpNoChangeMessage(op: RewriteOp): string {
  switch (op) {
    case "shorten":
      return "Shorten returned the same draft — nothing changed. Try again, or trim it yourself.";
    case "lengthen":
      return "Lengthen returned the same draft — nothing changed. Try again, or add the detail yourself.";
    default:
      return "That returned the same draft — nothing changed. Try again.";
  }
}

// ── Content-policy advisory pre-check ────────────────────────────────
