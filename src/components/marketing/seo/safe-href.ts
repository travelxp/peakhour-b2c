/**
 * Every link in the kit takes its href from content data, so each goes through here: only a site path, a fragment,
 * an http(s) URL or mailto survives. Anything else (`javascript:`, `data:`) becomes "#", so a mis-authored or
 * hostile content object cannot put script behind a link.
 */
export function safeHref(href: string): string {
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (h.startsWith("#")) return h;
  if (/^(https?:|mailto:)/i.test(h)) return h;
  return "#";
}
