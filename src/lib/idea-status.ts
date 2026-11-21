/**
 * What a content idea's status is called on screen. The api stores raw values
 * (`brainstorm`, `in_progress`); no screen should print one. ONE map, so the
 * board, the idea page and any list agree.
 */
export const IDEA_STATUS_LABEL: Record<string, string> = {
  brainstorm: "New idea",
  planned: "Planned",
  brief_ready: "Brief ready",
  writing: "Being written",
  in_progress: "Being written",
  review: "Ready for you to check",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

/** The merchant label for a status; an unknown value reads as words, never as `snake_case`. */
export function ideaStatusLabel(status: string): string {
  const known = IDEA_STATUS_LABEL[status];
  if (known) return known;
  const words = status.replaceAll("_", " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "New idea";
}
