/**
 * "Not now" with undo, as plain logic (no React, no timers), so the rules are tested in node.
 *
 * The dismissal is sent at once. Undo asks the api to take it back (`POST /v1/creative/post-ideas/undismiss`). Nothing is held back in the
 * page, so leaving the page, closing the tab or a flaky connection can never lose a dismissal.
 *
 * One rule matters: an Undo pressed while the dismissal is still on its way WAITS for it, so the two requests reach the api in order and
 * the idea cannot end up dismissed after the merchant undid it.
 */
export type HideOutcome = "hidden" | "gone" | "failed";
export type UndoOutcome = "restored" | "failed" | "nothing";

export interface Dismissals<T extends { id: string }> {
  /** Send the dismissal now. "gone" = the api says the idea no longer exists (nothing was dismissed, nothing to undo). */
  hide(item: T): Promise<HideOutcome>;
  /**
   * Take the dismissal back. "nothing" when this idea was never hidden here, did not end up dismissed, or was already taken back;
   * "failed" when the api could not take it back (the idea stays dismissed).
   */
  undo(item: T): Promise<UndoOutcome>;
}

export function createDismissals<T extends { id: string }>(opts: {
  dismiss: (item: T) => Promise<unknown>;
  undismiss: (item: T) => Promise<unknown>;
  isGone?: (error: unknown) => boolean;
}): Dismissals<T> {
  const sent = new Map<string, Promise<HideOutcome>>();
  return {
    hide(item) {
      const p = opts.dismiss(item).then(
        (): HideOutcome => "hidden",
        (e): HideOutcome => (opts.isGone?.(e) ? "gone" : "failed"),
      );
      sent.set(item.id, p);
      return p;
    },
    async undo(item) {
      const p = sent.get(item.id);
      if (!p) return "nothing";
      sent.delete(item.id);
      if ((await p) !== "hidden") return "nothing";
      try {
        await opts.undismiss(item);
        return "restored";
      } catch {
        return "failed";
      }
    },
  };
}
