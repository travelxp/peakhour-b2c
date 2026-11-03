import { CHANNEL_LABEL, type Channel } from "@/lib/inbox-view";

/** The small labels on a conversation, shared by the list row and the thread header (Inbox phase 1). */

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/15 text-success-on-tint" },
  resolved: { label: "Resolved", className: "bg-muted text-muted-foreground" },
  escalated: { label: "With a human", className: "bg-warning/15 text-warning-on-tint" },
};

/** "Needs you": the assistant handed the conversation to the team and nobody has picked it up. It outranks "With a human". */
export function StatusPill({ status, needsYou = false }: { status: string; needsYou?: boolean }) {
  const v = needsYou ? { label: "Needs you", className: "bg-destructive/15 text-destructive-on-tint" } : (STATUS_LABEL[status] ?? STATUS_LABEL.active)!;
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${v.className}`}>{v.label}</span>;
}

/** Which channel a conversation came in on. */
export function ChannelChip({ channel }: { channel: Channel }) {
  return (
    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground" data-channel={channel}>
      {CHANNEL_LABEL[channel]}
    </span>
  );
}

/** The dot on a conversation with something you have not opened. */
export function UnreadDot() {
  return <span role="img" aria-label="Unread" className="inline-block size-2 shrink-0 rounded-full bg-primary" />;
}
