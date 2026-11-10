"use client";

import EmojiPickerReact, {
  EmojiStyle,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";

/** The emoji-picker-react panel, split out so the library loads only when a
 *  picker popover first opens (see emoji-picker.tsx). */
export default function EmojiPickerPanel({
  dark,
  onPick,
}: {
  dark: boolean;
  onPick: (emoji: string) => void;
}) {
  return (
    <EmojiPickerReact
      onEmojiClick={(data: EmojiClickData) => onPick(data.emoji)}
      theme={dark ? Theme.DARK : Theme.LIGHT}
      // Native glyphs (no CDN sprite fetch) — fastest + matches how
      // the inserted character renders in the textarea.
      emojiStyle={EmojiStyle.NATIVE}
      lazyLoadEmojis
      width={320}
      height={400}
      previewConfig={{ showPreview: false }}
    />
  );
}
