/**
 * ★ONE PRESS OF PAY AT A TIME (owner answer 4, 2026-10-21: a double click on
 * Pay must never charge twice, "anyhow"). A button's `disabled` only takes
 * effect once React re-renders, so a second click landing in the same frame
 * still runs its handler. The handler asks this latch first: `take()` answers
 * true once, and false until `release()`. Hold it in a `useRef` so it lives
 * as long as the component. The api refuses a concurrent checkout as well
 * (409 CHECKOUT_IN_PROGRESS); this keeps the second request from being sent.
 */
export interface OnePress {
  /** True when this press may go ahead (and takes the latch); false while
   *  another is in flight. */
  take(): boolean;
  /** The press has finished, whatever the outcome: the next one may go. */
  release(): void;
  /** Whether a press is in flight. */
  readonly busy: boolean;
}

export function onePress(): OnePress {
  let busy = false;
  return {
    take() {
      if (busy) return false;
      busy = true;
      return true;
    },
    release() {
      busy = false;
    },
    get busy() {
      return busy;
    },
  };
}
