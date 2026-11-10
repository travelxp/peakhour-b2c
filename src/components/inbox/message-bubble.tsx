/**
 * One line of a conversation, and the day separator between days (Inbox phase 1).
 *
 * ★THEME TOKENS ONLY. The bubbles used to be painted with hard-coded hex colours (a pale green, white, on a beige pane): readable in
 * light mode and a white slab on a dark page. `bg-success/15` (the business's and the assistant's lines), `bg-card` (the shopper's)
 * and `bg-muted/40` (the pane) are defined for both themes, so text stays `text-foreground` on every one.
 * `inbox-ui.test.tsx` fails on a hard-coded colour in this file and in the pane that lays them out.
 */

import { BubbleMedia } from "@/components/inbox/inbox-media-view";
import type { MessageMedia } from "@/lib/inbox-media";

export function Bubble({
  role,
  content,
  sender,
  time,
  media,
  threadId,
}: {
  role: string;
  content: string;
  sender: string;
  time?: string;
  /** Inbox rich messages: the attachment on this line, opened on a press (`BubbleMedia`). Needs the thread it belongs to. */
  media?: MessageMedia | null;
  threadId?: string;
}) {
  const mine = role === "assistant" || role === "merchant";
  // a placeholder line ("[Photo]") only stands in for an attachment with no words; once the attachment is shown it would say it twice
  const placeholderOnly = Boolean(media) && /^\[(Photo|Voice note|Audio|Video|Document|Sticker)\]$/.test(content);
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] min-w-0 rounded-lg p-2.5 text-sm sm:max-w-[80%] ${
          mine ? "rounded-tr-none bg-success/15 text-foreground" : "rounded-tl-none border bg-card text-card-foreground shadow-sm"
        }`}
      >
        {/* ✅WA T4: every line says who wrote it: the shopper, the AI, the business phone, or a named team member from the Inbox. */}
        <p className="mb-0.5 text-micro font-medium opacity-70">{sender}</p>
        {media && threadId ? <BubbleMedia threadId={threadId} media={media} /> : null}
        {placeholderOnly && media && threadId ? null : <p className="whitespace-pre-wrap wrap-break-word">{content}</p>}
        {time ? <p className="mt-1 text-right text-micro text-muted-foreground">{time}</p> : null}
      </div>
    </div>
  );
}

export function DaySeparator({ label }: { label: string }) {
  if (!label) return null;
  return (
    <div className="flex justify-center py-1" role="separator" aria-label={label}>
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-micro font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
