import type { AudienceSource, AudienceSetStatus } from "@/lib/api/audiences";

/**
 * The library's filter vocabulary — extracted from the page so it can be
 * asserted against the api's enums.
 *
 * ★THE SEAM NOTHING COVERED, AND WHERE A REAL DEFECT LIVED. `GET /sets` takes
 * ONE `source` value from a four-member enum, and a first cut offered three:
 * the `fallback` set every plan carries was badged identically to the rows the
 * filter returned and reachable from no option in any dropdown. A filter that
 * is accepted and then quietly excludes something is a list a customer reads as
 * "I have no audiences" — which is the exact failure the api's own strict enums
 * exist to prevent, one layer up.
 *
 * These live in a module of their own rather than in `page.tsx` because a
 * client component cannot be imported by a node-environment test.
 */

/** `all` rather than an empty string: a Radix Select item may not have an empty
 *  value, and the query simply omits the key. */
export const ALL = "all";

export const SOURCES: ReadonlyArray<{ value: AudienceSource; label: string }> = [
  { value: "generated", label: "Peakhour suggested" },
  // The deterministic geography × industry set every plan carries — the one the
  // strategist's ideas are MEASURED AGAINST. Its own label, because the api
  // takes one value and a shared one makes it unreachable.
  { value: "fallback", label: "Peakhour baseline" },
  { value: "imported", label: "From past campaigns" },
  { value: "user_defined", label: "You built" },
];

export const STATUSES: ReadonlyArray<{ value: AudienceSetStatus; label: string }> = [
  { value: "proposed", label: "Suggested" },
  { value: "applied", label: "On a campaign" },
  { value: "discarded", label: "Discarded" },
  { value: "superseded", label: "Replaced" },
];

export const PAGE_SIZE = 20;

/** The api's own `q` bound. A longer string is a 400, and a 400 on this route
 *  renders as an error state whose only action refetches the same invalid
 *  query — so the input refuses the character rather than the request. */
export const SEARCH_MAX = 80;

/** The api caps `offset` at 1000 and 400s past it, so the last page a customer
 *  can reach is the last one the server will serve. */
export const MAX_OFFSET = 1000;
