/**
 * Internal helpers shared across the composer primitives.
 * Not part of the public barrel — primitives import from `./_helpers`.
 */

import type { RefObject } from "react";

/** Radix's `PopperAnchor.virtualRef` is typed `RefObject<Measurable>`
 *  where `Measurable = { getBoundingClientRect(): DOMRect }`.
 *  `HTMLElement` satisfies that structurally (verified against
 *  @radix-ui/rect d.ts), so passing a host-provided container ref
 *  works at runtime — but TypeScript can't see the structural match
 *  through the `RefObject<T>` wrapper. This helper centralises the
 *  cast so the rationale lives in one place and both typeaheads can
 *  reuse it without re-deriving the type.
 *
 *  Safe by inspection: every HTMLElement has getBoundingClientRect;
 *  every Element does too. We accept null-ish refs because hosts
 *  often initialise refs to null on first render.
 */
export function asMeasurableRef<T extends Element>(
  ref: RefObject<T | null>,
): RefObject<{ getBoundingClientRect(): DOMRect }> {
  // The double-cast through `unknown` avoids the false-positive
  // "type comparability" complaint while preserving the structural
  // promise above.
  return ref as unknown as RefObject<{ getBoundingClientRect(): DOMRect }>;
}

/** Reasonable default for what counts as a "valid" hashtag the
 *  composer's "Create #{query}" affordance should surface. Two or
 *  more Unicode letters/digits/underscores. Platforms have their own
 *  stricter rules (X strips non-ASCII; Mastodon requires alphanumeric
 *  start; LinkedIn rejects punctuation) — hosts that need platform
 *  parity pass their own `validateTag` to `<HashtagSuggest/>`. */
export function defaultValidHashtag(query: string): boolean {
  return /^[\p{L}\p{N}_]{2,}$/u.test(query);
}
