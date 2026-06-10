import type { LinkedInCommentarySegment } from "@/lib/api/linkedin-content";

/** An org mention the user inserted via the @-typeahead. `name` is the org's
 *  display name (the visible token, which LinkedIn requires to match exactly);
 *  `urn` is its `urn:li:organization:{id}`. */
export interface ResolvedMention {
  name: string;
  urn: string;
}

// LinkedIn hashtag chars: letters, digits, underscore (no spaces).
const HASHTAG_RE = /^[A-Za-z0-9_]+/;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9_]/.test(ch);
}

/**
 * Convert composer text + the org mentions the user inserted into LinkedIn
 * "little"-format commentary segments (CMA D4). Returns `null` when no recorded
 * mention actually appears in the text — the caller should then send the raw
 * `commentary` string instead (which lets LinkedIn auto-link plain #hashtags,
 * and avoids needlessly escaping a post that has no mentions).
 *
 * Matching rules:
 *   - A mention is the literal token `@<name>` at a left boundary (start or a
 *     non-word char before the `@`) and a right boundary (end or a non-word
 *     char after the name) — so `email@Acme` and `@Acme` inside `@Acmexyz`
 *     don't match. Longer names are matched first so `@Acme Corp` wins over
 *     `@Acme`.
 *   - A hashtag is `#<word>` at a left boundary → a hashtag segment, so it
 *     survives the little-format escaping the server applies to text segments.
 *   - Everything else accumulates into text segments.
 */
export function buildCommentarySegments(
  text: string,
  mentions: ResolvedMention[],
): LinkedInCommentarySegment[] | null {
  // Longest token first so a longer name isn't shadowed by a shorter prefix.
  const tokens = mentions
    .map((m) => ({ token: `@${m.name}`, name: m.name, urn: m.urn }))
    .filter((t) => t.name.trim().length > 0)
    .sort((a, b) => b.token.length - a.token.length);

  const segments: LinkedInCommentarySegment[] = [];
  let buf = "";
  let matchedAnyMention = false;
  const flush = () => {
    if (buf) {
      segments.push({ type: "text", value: buf });
      buf = "";
    }
  };

  let i = 0;
  while (i < text.length) {
    const prev = i > 0 ? text[i - 1] : undefined;
    const atBoundary = !isWordChar(prev);

    // Mention?
    if (text[i] === "@" && atBoundary) {
      let matched = false;
      for (const t of tokens) {
        if (text.startsWith(t.token, i) && !isWordChar(text[i + t.token.length])) {
          flush();
          segments.push({ type: "mention", urn: t.urn, name: t.name });
          i += t.token.length;
          matched = true;
          matchedAnyMention = true;
          break;
        }
      }
      if (matched) continue;
    }

    // Hashtag?
    if (text[i] === "#" && atBoundary) {
      const m = HASHTAG_RE.exec(text.slice(i + 1));
      if (m) {
        flush();
        segments.push({ type: "hashtag", value: m[0] });
        i += 1 + m[0].length;
        continue;
      }
    }

    buf += text[i];
    i++;
  }
  flush();

  // No mention actually landed → let the caller use the raw-commentary path.
  if (!matchedAnyMention) return null;
  return segments;
}
