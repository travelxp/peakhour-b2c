import { safeHref } from "@/lib/demand-insights";

/**
 * The one way this app hands a file to the browser as a download: make an anchor, click it, remove it. Nothing is uploaded and nothing is fetched here; the caller
 * brings a link (the api's signed one) or the bytes it fetched.
 *
 * ★A LINK THE API GAVE IS CHECKED, NOT TRUSTED. `downloadLink` sets an `href` from data, so it goes through `safeHref` (only http and https become a link: React and
 * the DOM do not stop a `javascript:` address, and the SAST scan flags an `href` built from data). It answers `false` when the link is not one, so the caller can
 * say so instead of a click that does nothing. A blob's own object URL is made here and is never data.
 */

function click(href: string, filename: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    // also when the click throws: the anchor must not stay in the page
    a.remove();
  }
}

/** Download a link (the api's, and short-lived). False, with nothing done, when it is not an http or https address. */
export function downloadLink(url: string | null | undefined, filename: string): boolean {
  const href = safeHref(url);
  if (!href) return false;
  click(href, filename);
  return true;
}

/** How long the object URL lives: some browsers start the download after the click handler returns, and revoking at once would cancel it. */
const REVOKE_AFTER_MS = 10_000;

/** Download bytes already in hand (a fetched file, or text the page made). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    click(url, filename);
  } finally {
    // also when the click throws (a CSP, an extension): a large export must not stay held until the page unloads
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  }
}

/** Download text the page made (an export) as a file of this type. */
export function downloadText(body: string, filename: string, type: string): void {
  downloadBlob(new Blob([body], { type }), filename);
}
