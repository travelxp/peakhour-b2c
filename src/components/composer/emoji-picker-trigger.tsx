"use client";

/**
 * <EmojiPickerTrigger/> — thin wrapper around the shadcnblocks PRO
 * `<EmojiPicker/>` that adds:
 *
 *   - A caret-aware insertion contract: caller passes the controlled
 *     `<Textarea/>` ref, the picker inserts at the current selection,
 *     restores focus, and bumps the caret past the new character so
 *     the user can keep typing.
 *   - The standard composer-toolbar Button styling (ghost / size-sm /
 *     h-7) so it slots into the AI compose toolbar or any host's
 *     formatting strip without per-host overrides.
 *
 * The shadcnblocks block ships with its own popover + search +
 * recents (stored under localStorage key "recent-emojis") + keyboard
 * navigation. We pass our styled trigger via its `trigger` prop and
 * an onEmojiSelect handler that does the caret-aware insertion.
 *
 * PR #4 (X composer rewrite) can swap to the full Apple-style picker
 * (`emoji-picker-react` npm) if we need glyph parity — same trigger
 * shape, different underlying picker.
 */

import type { RefObject } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmojiPicker from "@/components/emoji-picker";
import { cn } from "@/lib/utils";

export interface EmojiPickerTriggerProps {
  /** Controlled ref to the host's `<Textarea/>` (or `<Input/>`).
   *  Required — the trigger needs it to read selection + dispatch
   *  the input event after insertion. */
  targetRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  /** Caller's setText so React state stays in sync after the picker
   *  mutates the DOM value. */
  onChange: (next: string) => void;
  /** Compact variant — icon-only, no label. Default true since the
   *  primitive is almost always used in a tight composer strip. */
  compact?: boolean;
  className?: string;
}

export function EmojiPickerTrigger({
  targetRef,
  onChange,
  compact = true,
  className,
}: EmojiPickerTriggerProps) {
  function handleEmojiSelect(emoji: string) {
    const el = targetRef.current;
    if (!el) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const next = before + emoji + after;

    // Notify React (controlled) first, then sync the DOM selection so
    // the caret lands past the inserted glyph. The order matters:
    // doing DOM-first would race with the controlled re-render and
    // visibly twitch the caret.
    onChange(next);

    // Schedule the caret restore for after React's re-render. Using
    // requestAnimationFrame here (not setTimeout) so we land in the
    // same paint frame as the controlled value update — no visible
    // flash.
    requestAnimationFrame(() => {
      const elNow = targetRef.current;
      if (!elNow) return;
      const caret = start + emoji.length;
      elNow.setSelectionRange(caret, caret);
      elNow.focus();
    });
  }

  return (
    <EmojiPicker
      onEmojiSelect={handleEmojiSelect}
      trigger={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn("h-7 gap-1.5 px-2 text-xs", className)}
          aria-label="Insert emoji"
          title="Insert emoji"
        >
          <Smile className="size-3.5" />
          {compact ? null : <span>Emoji</span>}
        </Button>
      }
    />
  );
}
