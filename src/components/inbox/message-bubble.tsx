/**
 * One line of a conversation, and the day separator between days (Inbox phase 1).
 *
 * ★THEME TOKENS ONLY. The bubbles used to be painted with hard-coded hex colours (a pale green, white, on a beige pane): readable in
 * light mode and a white slab on a dark page. `bg-success/15` (the business's and the assistant's lines), `bg-card` (the shopper's)
 * and `bg-muted/40` (the pane) are defined for both themes, so text stays `text-foreground` on every one.
 * `inbox-ui.test.tsx` fails on a hard-coded colour in this file and in the pane that lays them out.
 */

export function Bubble({ role, content, sender, time }: { role: string; content: string; sender: string; time?: string }) {
  const mine = role === "assistant" || role === "merchant";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] min-w-0 rounded-lg p-2.5 text-sm sm:max-w-[80%] ${
          mine ? "rounded-tr-none bg-success/15 text-foreground" : "rounded-tl-none border bg-card text-card-foreground shadow-sm"
        }`}
      >
        {/* ✅WA T4: every line says who wrote it: the shopper, the AI, the business phone, or a named team member from the Inbox. */}
        <p className="mb-0.5 text-[11px] font-medium opacity-70">{sender}</p>
        <p className="whitespace-pre-wrap wrap-break-word">{content}</p>
        {time ? <p className="mt-1 text-right text-[10px] text-muted-foreground">{time}</p> : null}
      </div>
    </div>
  );
}

export function DaySeparator({ label }: { label: string }) {
  if (!label) return null;
  return (
    <div className="flex justify-center py-1" role="separator" aria-label={label}>
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
