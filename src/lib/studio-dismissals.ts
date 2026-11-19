/**
 * "Not now" with undo, as plain logic (no React, no timers of its own beyond setTimeout), so the rules are tested in node.
 *
 * The api cannot take a dismissal back, so an idea is held in a pending list for `windowMs`. Undo inside the window cancels it and the
 * api never hears of it. When the window closes the dismissal is sent. `flush()` sends every pending one at once (the page was left).
 */
export interface DismissalQueue<T extends { id: string }> {
  /** Start the undo window for an idea. Replacing a pending one for the same id restarts it. */
  hide(item: T): void;
  /** Cancel a pending dismissal. Returns false when there is none (the window already closed). */
  undo(id: string): boolean;
  /** Send every pending dismissal now and clear the list. */
  flush(): void;
  /** Ids waiting inside their undo window. */
  pendingIds(): string[];
}

export function createDismissalQueue<T extends { id: string }>(opts: {
  windowMs: number;
  send: (item: T) => void | Promise<void>;
}): DismissalQueue<T> {
  const pending = new Map<string, { item: T; timer: ReturnType<typeof setTimeout> }>();
  const fire = (id: string) => {
    const p = pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(id);
    void opts.send(p.item);
  };
  return {
    hide(item) {
      const old = pending.get(item.id);
      if (old) clearTimeout(old.timer);
      pending.set(item.id, { item, timer: setTimeout(() => fire(item.id), opts.windowMs) });
    },
    undo(id) {
      const p = pending.get(id);
      if (!p) return false;
      clearTimeout(p.timer);
      pending.delete(id);
      return true;
    },
    flush() {
      for (const id of [...pending.keys()]) fire(id);
    },
    pendingIds: () => [...pending.keys()],
  };
}
