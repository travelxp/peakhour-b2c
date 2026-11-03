import { initialsOf, timerView, type DeskTag, type ResponseTimer, type ThreadAssignee } from "@/lib/inbox-desk";

/** The team desk's small labels on a conversation, shared by the list row and the thread header (I3a). */

/** Who has the conversation: their initials in a circle, the name on hover. Nothing when it is unassigned. */
export function AssigneeBadge({ assignee }: { assignee: ThreadAssignee | null | undefined }) {
  if (!assignee) return null;
  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
      title={`Assigned to ${assignee.name}`}
      aria-label={`Assigned to ${assignee.name}`}
      data-testid="assignee-badge"
    >
      {initialsOf(assignee.name)}
    </span>
  );
}

/** The first-reply timer. The api decides its state; this only words it. Nothing when the conversation has none. */
export function TimerChip({ timer }: { timer: ResponseTimer | null | undefined }) {
  const v = timerView(timer);
  if (!v) return null;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${v.className}`} data-testid="timer-chip" data-tone={v.tone}>
      {v.label}
    </span>
  );
}

/** A conversation's tags, by name. A tag the business has since deleted is not shown. */
export function TagChips({ tagIds, tags, max }: { tagIds: readonly string[] | undefined; tags: readonly DeskTag[] | undefined; max?: number }) {
  const known = (tagIds ?? []).map((id) => tags?.find((t) => t.id === id)).filter((t): t is DeskTag => Boolean(t));
  if (known.length === 0) return null;
  const shown = max ? known.slice(0, max) : known;
  const more = known.length - shown.length;
  return (
    <>
      {shown.map((t) => (
        <span key={t.id} className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground" data-testid="tag-chip">
          {t.name}
        </span>
      ))}
      {more > 0 && <span className="shrink-0 text-[11px] text-muted-foreground">+{more}</span>}
    </>
  );
}
