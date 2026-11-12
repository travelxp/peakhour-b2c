/** Which edges of a horizontally scrolling strip have more content beyond them. */
export interface EdgeFades {
  start: boolean;
  end: boolean;
}

/**
 * Edge-fade state from the three scroll metrics. A 1px tolerance absorbs the
 * fractional scrollLeft browsers report on zoomed or high-DPI screens, so a
 * strip resting at its end does not keep a fade it cannot scroll past.
 */
export function edgeFades(scrollLeft: number, scrollWidth: number, clientWidth: number, eps = 1): EdgeFades {
  if (scrollWidth - clientWidth <= eps) return { start: false, end: false };
  return {
    start: scrollLeft > eps,
    end: scrollLeft + clientWidth < scrollWidth - eps,
  };
}

/** CSS mask-image for the fades, or undefined when neither edge needs one. */
export function fadeMask(f: EdgeFades, size = 32): string | undefined {
  if (!f.start && !f.end) return undefined;
  const left = f.start ? `transparent, #000 ${size}px` : "#000, #000";
  const right = f.end ? `#000 calc(100% - ${size}px), transparent` : "#000, #000";
  return `linear-gradient(to right, ${left}, ${right})`;
}

/**
 * The scrollLeft that brings an item fully into view with `margin` px to spare
 * on its near edge, or the current scrollLeft if it already is. Clamped to the
 * scrollable range.
 */
export function scrollTargetFor(
  itemLeft: number,
  itemWidth: number,
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  margin = 48,
): number {
  const max = Math.max(0, scrollWidth - clientWidth);
  let target = scrollLeft;
  if (itemLeft - margin < scrollLeft) target = itemLeft - margin;
  else if (itemLeft + itemWidth + margin > scrollLeft + clientWidth) target = itemLeft + itemWidth + margin - clientWidth;
  return Math.min(max, Math.max(0, target));
}
