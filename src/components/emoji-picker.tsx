"use client";

/**
 * <EmojiPicker/> — a Popover-wrapped emoji picker built on the
 * `emoji-picker-react` library (ealush.com/emoji-picker-react).
 *
 * History: this used to be a shadcnblocks demo STUB whose `emojis`
 * array contained only 3 hardcoded glyphs, AND whose trigger wiring was
 * broken — the host passed a `<TooltipProvider><Tooltip>…</>` tree as
 * `trigger`, and `<PopoverTrigger asChild>` tried to Slot the popover's
 * onClick/ref onto `TooltipProvider` (a context provider, not a DOM
 * node), which dropped them → clicking the icon opened NOTHING. Both
 * bugs are fixed here: a real full-Unicode picker, and a Slot-friendly
 * trigger (a plain `<Button>` — see EmojiPickerTrigger).
 *
 * Contract is unchanged for hosts: `onEmojiSelect(glyph)` fires with
 * the chosen emoji character; the host splices it at its tracked caret
 * (via `insertAtCaret`). `trigger` is the clickable element (must be a
 * single Slot-compatible element — a DOM node or a forwardRef
 * component like our `<Button>`, NOT a context provider).
 */

import { useState } from "react";
import EmojiPickerReact, {
  EmojiStyle,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";
import { useTheme } from "next-themes";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmojiPickerProps {
  /** Fired with the chosen emoji glyph (the character itself). */
  onEmojiSelect: (emoji: string) => void;
  /** Clickable trigger. MUST be a single Slot-compatible element
   *  (forwardRef component or DOM node) — `<PopoverTrigger asChild>`
   *  merges onClick/ref onto it. A context-provider wrapper (e.g.
   *  TooltipProvider) would swallow those and the popover would never
   *  open. */
  trigger?: React.ReactNode;
}

export default function EmojiPicker({
  onEmojiSelect,
  trigger,
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-8 w-8 bg-transparent p-0">
            <Smile className="h-4 w-4" />
            <span className="sr-only">Open emoji picker</span>
          </Button>
        )}
      </PopoverTrigger>
      {/* p-0 + w-auto so the library panel sizes itself. */}
      <PopoverContent align="end" className="w-auto border-0 p-0 shadow-none">
        <EmojiPickerReact
          onEmojiClick={(data: EmojiClickData) => {
            onEmojiSelect(data.emoji);
            setOpen(false);
          }}
          theme={resolvedTheme === "dark" ? Theme.DARK : Theme.LIGHT}
          // Native glyphs (no CDN sprite fetch) — fastest + matches how
          // the inserted character renders in the textarea.
          emojiStyle={EmojiStyle.NATIVE}
          lazyLoadEmojis
          width={320}
          height={400}
          previewConfig={{ showPreview: false }}
        />
      </PopoverContent>
    </Popover>
  );
}
