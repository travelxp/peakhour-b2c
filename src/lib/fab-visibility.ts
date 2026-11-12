/** Pixels of travel in one event before a direction counts; ignores jitter. */
export const FAB_SCROLL_THRESHOLD = 8;
/** Idle time after the last scroll before a hidden FAB comes back. */
export const FAB_IDLE_MS = 600;

/**
 * Whether the floating Ask button should be hidden after a scroll event.
 * Hides on scrolling down, shows on scrolling up or at the very top, keeps the
 * previous state for sub-threshold movement, and is never hidden while its
 * panel is open.
 */
export function fabHiddenAfterScroll(
  prevTop: number,
  top: number,
  hidden: boolean,
  panelOpen: boolean,
  threshold = FAB_SCROLL_THRESHOLD,
): boolean {
  if (panelOpen || top <= 0) return false;
  const delta = top - prevTop;
  if (delta >= threshold) return true;
  if (delta <= -threshold) return false;
  return hidden;
}
