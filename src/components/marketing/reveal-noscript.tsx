/**
 * The `<noscript>` escape hatch for pages that use <Reveal>. Without it, a
 * visitor with JavaScript disabled gets a page of invisible sections — the
 * observer never runs, so `.reveal` stays at opacity 0 forever.
 *
 * Two deliberate details:
 *
 *  • It lives in its own file, NOT in reveal.tsx. That module is marked
 *    "use client", and everything exported from it is therefore a client
 *    component — including this one. A `<noscript>` rendered by a client
 *    component is a hydration hazard: with scripting ENABLED the browser
 *    parses noscript content as a single text node, so React hydrates against
 *    a text node where it rendered an element. Server-only sidesteps it.
 *  • `suppressHydrationWarning` belts-and-braces the same point for the RSC
 *    reconciliation pass. Either outcome is correct here — the rule is static
 *    and applies (or doesn't) identically — so a console warning would be pure
 *    noise.
 *
 * Rendered per page rather than from the root layout, so the rule only ships
 * on pages that actually hide something.
 */
export function RevealNoScript() {
  return (
    <noscript suppressHydrationWarning>
      <style
        dangerouslySetInnerHTML={{
          __html: ".reveal{opacity:1!important;transform:none!important}",
        }}
      />
    </noscript>
  );
}
