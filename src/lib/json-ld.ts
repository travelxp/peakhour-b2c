/**
 * Escape a JSON string for safe embedding inside a <script> element. JSON.stringify
 * does NOT escape "<", so a value containing "</script>" would break out of the
 * ld+json block — the classic JSON-LD XSS. Escaping "<", ">", "&" closes it.
 *
 * Shared by every page that writes a JSON-LD block (the CMS catch-all and
 * /shopify), so the escape cannot be forgotten on one of them.
 */
export function safeJsonLd(obj: Record<string, unknown>): string {
  // Escape "<" (plus ">" and "&") so a value containing "</script>" cannot
  // break out of the <script type="application/ld+json"> element (JSON-LD XSS).
  return JSON.stringify(obj).replace(
    /[<>&]/g,
    (ch) => String.fromCharCode(92) + "u00" + ch.charCodeAt(0).toString(16),
  );
}
