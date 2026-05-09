import type { SourceType } from "../types";

/**
 * Auto-detect a source type from a single line of user input.
 *
 * Heuristics, applied in order — first match wins:
 *   • bare `@handle`                                     → x_handle
 *   • URL-host check against (twitter|x).com excluding /status/ → x_handle
 *   • URL-host check against instagram.com               → instagram_handle
 *   • URL-host check against youtube.com / youtu.be / m.youtube.com / music.youtube.com
 *                                                        → youtube_channel
 *   • path ends in .xml/.rss/.atom OR has a feed/rss/atom segment
 *                                                        → rss
 *   • URL-host matches known newsletter platforms (substack/beehiiv/kit) → newsletter
 *   • URL-host matches known podcast platforms (apple/spotify/anchor)    → podcast
 *   • otherwise                                          → website
 *
 * Why heuristics + not a full parser: bulk-paste users are pasting
 * URLs they already know. Wrong-type detections are correctable on
 * the preview screen before submit. The list is intentionally
 * conservative (a misclassification falls through to "website",
 * which works for almost everything via the normal HTTP fetcher).
 *
 * `uploaded_doc` is never auto-detected — it's a CMS-only flow that
 * implies a separately-uploaded file blob, which isn't a thing
 * bulk-paste callers can provide.
 */
// Segment-anchored: matches `/feed`, `/rss`, `/atom` only as a
// distinct path segment (not inside `feedback`, `feed-back`, etc.),
// or as the basename of a `.xml`/`.rss`/`.atom` file. Tested against
// example.com/feedback (no match), example.com/feed (match),
// example.com/blog/feed.xml (match), example.com/posts/feed-back (no
// match), example.com/atom (match).
const FEED_PATH_RE = /(?:^|\/)(feed|rss|atom)(?:\/|\.xml|\.rss|\.atom|$)/;

export function detectSourceType(raw: string): SourceType {
  const trimmed = raw.trim();
  if (!trimmed) return "website";

  // Bare handle.
  if (trimmed.startsWith("@")) return "x_handle";

  // Try URL parsing for everything else; fall back to "website".
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Not a parseable URL and doesn't start with @ — treat as a
    // domain-style website. The backend's normaliseIdentifier will
    // fall back to the raw trimmed form for this case.
    return "website";
  }

  const host = url.host.toLowerCase();
  const path = url.pathname.toLowerCase();

  // Social handles — tighter check on hosts so a substack.com
  // article about Twitter doesn't fall into x_handle.
  if (host === "twitter.com" || host === "x.com" || host === "www.twitter.com" || host === "www.x.com") {
    // Don't classify a tweet permalink (twitter.com/{handle}/status/...)
    // as a handle — that's a single post, not a feed worth subscribing to.
    if (path.includes("/status/")) return "website";
    return "x_handle";
  }
  if (host === "instagram.com" || host === "www.instagram.com") {
    return "instagram_handle";
  }
  // youtube.com / www.youtube.com / m.youtube.com / music.youtube.com
  // / youtu.be — `endsWith` keeps subdomain coverage open without
  // letting `notyoutube.com` slip through (host has the leading
  // dot).
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
    return "youtube_channel";
  }

  // RSS — segment-anchored regex, plus extension fallback for the
  // edge case where the path has no segment but ends in a feed
  // file directly (e.g. `https://example.com/feed.xml` parses with
  // pathname `/feed.xml`, which the regex covers; this kept as a
  // belt-and-braces guard for future regex tweaks).
  if (FEED_PATH_RE.test(path) || path.endsWith(".xml") || path.endsWith(".rss") || path.endsWith(".atom")) {
    return "rss";
  }

  // Newsletter platforms — substack/beehiiv/kit/convertkit. The
  // backend doesn't distinguish "newsletter from a known platform"
  // vs a generic newsletter site, but the type keeps the UI label
  // honest.
  if (host.endsWith("substack.com") || host.endsWith("beehiiv.com") || host.endsWith("kit.com") || host.endsWith("convertkit.com")) {
    return "newsletter";
  }

  // Podcast platforms — Apple show pages (both bare and the m.
  // mobile variant), Spotify shows, Anchor RSS.
  if (host === "podcasts.apple.com" || host === "www.podcasts.apple.com") return "podcast";
  if (host.endsWith("apple.com") && path.includes("/podcast/")) return "podcast";
  if (host.endsWith("spotify.com") && path.includes("/show/")) return "podcast";
  if (host.endsWith("anchor.fm")) return "podcast";

  return "website";
}

/**
 * Best-effort display name from a single line. Used as a fallback
 * when bulk-paste callers don't supply a name. The drawer's preview
 * lets the user override before submit.
 *
 *   @handle           → "@handle"
 *   https://example.com/blog → "example.com/blog"
 *   https://example.com      → "example.com"
 *   https://example.com/feed → "example.com" (strip the /feed suffix
 *                              so the row reads as the parent site)
 */
export function defaultDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("@")) return trimmed;
  try {
    const u = new URL(trimmed);
    let path = u.pathname;
    // Strip trailing slash and the common feed paths so the name
    // reads as the publication, not the feed file. The trailing
    // `.atom` covers the third common feed extension; the segment
    // matcher must be anchored to end-of-string to avoid eating
    // `feedback` (cf. FEED_PATH_RE in detectSourceType).
    path = path.replace(/\/$/, "");
    path = path.replace(/\/(feed|rss|atom)(\.xml|\.rss|\.atom)?$/i, "");
    if (path === "" || path === "/") return u.host;
    return `${u.host}${path}`;
  } catch {
    return trimmed;
  }
}
