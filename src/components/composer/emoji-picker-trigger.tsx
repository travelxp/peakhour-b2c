"use client";

/**
 * <EmojiPickerTrigger/> — thin wrapper around the shadcnblocks PRO
 * `<EmojiPicker/>` that adds:
 *
 *   - A caret-agnostic insertion contract: the trigger just hands the
 *     chosen glyph back via `onInsert`. The HOST owns where it goes —
 *     it splices the glyph at its tracked caret (the single source of
 *     truth, captured on blur so it survives the popover stealing
 *     focus) via `insertAtCaret`, and restores focus + selection.
 *
 *     This replaces the old contract that read `el.selectionStart`
 *     LIVE inside the trigger — unreliable, because opening the picker
 *     popover blurs the textarea, so the live read fell back to the
 *     end/0. Routing every insert (emoji + AI quote/disclosure)
 *     through the host's one caret source fixes that and pre-fixes the
 *     X composer (PR #4) for free.
 *   - The standard composer-toolbar Button styling (ghost / size-sm /
 *     h-7) so it slots into the AI compose toolbar or any host's
 *     formatting strip without per-host overrides.
 *
 * The shadcnblocks block ships with its own popover + search +
 * recents (stored under localStorage key "recent-emojis") + keyboard
 * navigation. We pass our styled trigger via its `trigger` prop and
 * an onEmojiSelect handler that forwards the glyph to `onInsert`.
 *
 * PR #4 (X composer rewrite) can swap to the full Apple-style picker
 * (`emoji-picker-react` npm) if we need glyph parity — same trigger
 * shape, different underlying picker.
 */

import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmojiPicker from "@/components/emoji-picker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface EmojiPickerTriggerProps {
  /** Called with the chosen emoji glyph. The host splices it at its
   *  tracked caret (via `insertAtCaret`) and handles focus restore —
   *  the trigger stays caret-agnostic so the same primitive drops into
   *  any composer (LinkedIn, X, …) without per-host wiring. */
  onInsert: (emoji: string) => void;
  /** Compact variant — icon-only, no label. Default true since the
   *  primitive is almost always used in a tight composer strip. */
  compact?: boolean;
  className?: string;
}

export function EmojiPickerTrigger({
  onInsert,
  compact = true,
  className,
}: EmojiPickerTriggerProps) {
  function handleEmojiSelect(emoji: string) {
    onInsert(emoji);
  }

  return (
    <EmojiPicker
      onEmojiSelect={handleEmojiSelect}
      trigger={
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn("h-7 gap-1.5 px-2 text-xs", className)}
                aria-label="Insert emoji"
              >
                <Smile className="size-3.5" />
                {compact ? null : <span>Emoji</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert emoji</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    />
  );
}
