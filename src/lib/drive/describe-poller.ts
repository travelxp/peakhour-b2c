import { getDescribeState, type DescribeStateRow } from "@/lib/api/media";

/**
 * The describing poll (Drive D4). While any tile on screen (or any row in the upload tray) is waiting for Peakhour to name it, ask the api
 * how those files are getting on, and hand back what the describer wrote so the tile can swap its name and tags in without a refresh.
 * WHEN NOTHING IS WAITING THERE IS NO TIMER AT ALL: the poller sleeps until something is watched, and stops again the moment the last
 * watched file is settled. A page full of finished files makes no request.
 *
 * One poller for the whole app (the grid and the tray both watch through it), a request for at most 100 ids, a wait that grows once a file
 * has taken a while, and no request while the tab is hidden. A request that fails is simply tried again next tick: the tile keeps
 * shimmering and the page stays usable.
 */

export interface PollerDeps {
  fetchStates: (ids: string[]) => Promise<DescribeStateRow[]>;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (t: unknown) => void;
  hidden: () => boolean;
  /** Wait before the next ask: short at first, longer the more asks a watched file has had. */
  waitMs: (asks: number) => number;
}

export const MAX_IDS_PER_ASK = 100;
/** 3 s for the first minute of asks, then 8 s: a describer that is busy is not helped by being asked more. */
export const defaultWaitMs = (asks: number): number => (asks < 20 ? 3000 : 8000);

export const isWaiting = (s: DescribeStateRow["describeState"]): boolean => s === "pending" || s === "describing";

export class DescribePoller {
  private watched = new Map<string, number>(); // id -> asks so far
  private timer: unknown = null;
  private inFlight = false;
  private listeners = new Set<(rows: DescribeStateRow[]) => void>();

  constructor(private deps: PollerDeps) {}

  /** Rows come back here every time the api answers (all of them: the tile merges what changed). */
  subscribe(fn: (rows: DescribeStateRow[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Replace what one watcher cares about. The poller asks about the union; an empty union is no timer. */
  private owners = new Map<string, Set<string>>();
  watch(owner: string, ids: string[]): void {
    this.owners.set(owner, new Set(ids));
    this.sync();
  }
  unwatch(owner: string): void {
    this.owners.delete(owner);
    this.sync();
  }

  get isRunning(): boolean {
    return this.timer !== null || this.inFlight;
  }
  get watchedCount(): number {
    return this.watched.size;
  }

  private sync(): void {
    const union = new Set<string>();
    for (const set of this.owners.values()) for (const id of set) union.add(id);
    for (const id of [...this.watched.keys()]) if (!union.has(id)) this.watched.delete(id);
    for (const id of union) if (!this.watched.has(id)) this.watched.set(id, 0);
    if (this.watched.size === 0) {
      this.stopTimer();
      return;
    }
    if (this.timer === null && !this.inFlight) this.schedule(0);
  }

  private stopTimer(): void {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
  }

  private schedule(ms: number): void {
    this.stopTimer();
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      void this.tick();
    }, ms);
  }

  private nextWait(): number {
    const asks = Math.max(0, ...this.watched.values());
    return this.deps.waitMs(asks);
  }

  private async tick(): Promise<void> {
    if (this.watched.size === 0) return;
    if (this.deps.hidden()) {
      this.schedule(this.nextWait());
      return;
    }
    this.inFlight = true;
    const ids = [...this.watched.keys()].slice(0, MAX_IDS_PER_ASK);
    try {
      const rows = await this.deps.fetchStates(ids);
      for (const id of ids) if (this.watched.has(id)) this.watched.set(id, (this.watched.get(id) ?? 0) + 1);
      // A file the answer settles, or no longer returns (trashed, moved), is no longer waited for.
      const answered = new Map(rows.map((r) => [r.id, r]));
      for (const id of ids) {
        const r = answered.get(id);
        if (!r || !isWaiting(r.describeState)) this.watched.delete(id);
      }
      for (const l of this.listeners) l(rows);
    } catch {
      for (const id of ids) if (this.watched.has(id)) this.watched.set(id, (this.watched.get(id) ?? 0) + 1);
    } finally {
      this.inFlight = false;
    }
    if (this.watched.size > 0) this.schedule(this.nextWait());
    // The settled files are dropped from `watched` here, but their owners still list them: a later `watch` with the same ids brings them back
    // for one more look, which is what a re-render does and is harmless (the answer settles them again in one ask).
  }
}

export const describePoller = new DescribePoller({
  fetchStates: getDescribeState,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  hidden: () => typeof document !== "undefined" && document.hidden,
  waitMs: defaultWaitMs,
});
