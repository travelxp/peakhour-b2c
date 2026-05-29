"use client";

/**
 * <VoiceCardPreview/> — pill chip that summarises the brand voice the
 * composer's AI will follow. Sits in any composer's header row next
 * to the platform label. Clicking expands to a popover with the
 * card's signature phrases (keep) + avoid phrases (drop) so the
 * writer can mentally check the AI is targeting the right voice
 * before firing a Compose / Redraft.
 *
 * Stateless / controlled — caller fetches the card and passes it in.
 * Foundation makes no network call (consumer composers wire
 * `GET /v1/content/voice-cards` and pass `voiceCard` here).
 *
 * Empty state: when `voiceCard` is null/undefined, renders nothing
 * (so a host with no voice card configured doesn't accidentally
 * surface "no brand voice" as a negative signal — that belongs in a
 * dedicated empty-state surface, not the composer chrome).
 */

import { Mic, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import type { VoiceCardSummary } from "./types";

export interface VoiceCardPreviewProps {
  /** The summary from GET /v1/content/voice-cards. When null, the
   *  component renders nothing (see header comment). */
  voiceCard?: VoiceCardSummary | null;
  /** Compact mode — drops the leading icon + uses smaller padding.
   *  For surfaces where the chip needs to live inline with a heading. */
  compact?: boolean;
  className?: string;
}

export function VoiceCardPreview({
  voiceCard,
  compact,
  className,
}: VoiceCardPreviewProps) {
  if (!voiceCard) return null;
  // Empty card (zero adjectives + zero phrases) carries no useful
  // signal — render nothing rather than a generic "Voice card" pill
  // that links to a popover with no content.
  if (
    voiceCard.toneAdjectives.length === 0 &&
    voiceCard.signaturePhrases.length === 0 &&
    voiceCard.avoidPhrases.length === 0
  ) {
    return null;
  }

  const toneStr =
    voiceCard.toneAdjectives.length > 0
      ? voiceCard.toneAdjectives.slice(0, 3).join(" · ")
      : "Brand voice";

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs transition-colors",
            "hover:border-primary/40 hover:bg-primary/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            compact && "px-2 py-0",
            className,
          )}
          aria-label={`Brand voice card: ${toneStr}. Focus or hover to see signature and avoid phrases.`}
        >
          {!compact && <Mic className="size-3 text-muted-foreground group-hover:text-primary" />}
          <span className="truncate font-medium text-muted-foreground group-hover:text-foreground">
            {toneStr}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="bottom"
        className="w-80 p-0"
      >
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" />
            Brand voice
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            What the AI will sound like.
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {voiceCard.toneAdjectives.map((t) => (
              <Badge key={t} variant="secondary" className="font-normal">
                {t}
              </Badge>
            ))}
          </div>
        </div>

        {voiceCard.signaturePhrases.length > 0 && (
          <div className="px-4 py-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Signature — keep
            </div>
            <ul className="mt-1.5 space-y-1 text-sm">
              {voiceCard.signaturePhrases.slice(0, 6).map((p) => (
                <li
                  key={p}
                  className="rounded-sm bg-emerald-500/10 px-2 py-1 text-emerald-800 dark:text-emerald-300"
                >
                  {/* SR-only prefix so screen readers announce intent
                      — visual users get the colour cue, SR users get
                      "Keep: phrase". Mirrors the Avoid: pattern. */}
                  <span className="sr-only">Keep: </span>
                  {p}
                </li>
              ))}
              {voiceCard.signaturePhrases.length > 6 && (
                <li className="px-2 text-xs text-muted-foreground">
                  +{voiceCard.signaturePhrases.length - 6} more
                </li>
              )}
            </ul>
          </div>
        )}

        {voiceCard.avoidPhrases.length > 0 && (
          <div className="border-t px-4 py-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Avoid — drop
            </div>
            <ul className="mt-1.5 space-y-1 text-sm">
              {voiceCard.avoidPhrases.slice(0, 6).map((p) => (
                <li
                  key={p}
                  className="rounded-sm bg-destructive/10 px-2 py-1 text-destructive line-through"
                >
                  <span className="sr-only">Avoid: </span>
                  {p}
                </li>
              ))}
              {voiceCard.avoidPhrases.length > 6 && (
                <li className="px-2 text-xs text-muted-foreground">
                  +{voiceCard.avoidPhrases.length - 6} more
                </li>
              )}
            </ul>
          </div>
        )}

        {voiceCard.refreshedAt && (
          <div className="border-t px-4 py-2 text-[10px] text-muted-foreground">
            Last refreshed{" "}
            {new Date(voiceCard.refreshedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
