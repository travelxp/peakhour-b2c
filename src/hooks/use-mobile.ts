import * as React from "react"

const MOBILE_BREAKPOINT = 768

/** The one definition of "mobile": a viewport narrower than 768px, asked of
 *  matchMedia (never `innerWidth`, which rounds, so the two disagreed at
 *  fractional widths under browser zoom). */
export const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function subscribeMobile(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export const mobileSnapshot = () => window.matchMedia(MOBILE_QUERY).matches

/** Read synchronously from the first client render (useSyncExternalStore), so a
 *  phone never paints the desktop layout first and then flips. The server, and
 *  hydration, see `false`, as before. */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false)
}
