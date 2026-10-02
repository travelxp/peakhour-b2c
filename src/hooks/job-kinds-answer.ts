/**
 * `GET /v1/cms/jobs/kinds` answers `{ kinds, complete }` (api#1442).
 * `complete: false` is a fallback: the api could not read `bg_jobs`, and
 * offered its registered kinds plus what that instance last read in full.
 * ⚠️A copy of peakhour-cms's `src/hooks/job-kinds-answer.ts` (cms#175): a
 * fix to either is a fix to make in both.
 */
export type RawKindsAnswer = { kinds: string[]; complete?: boolean };
export type KindsAnswer = { kinds: string[]; complete: boolean };

/**
 * The answer with `complete` decided once (cms#175 round 3): an absent flag —
 * an api before api#1442 — is complete. Everything after reads a boolean.
 */
export function normalizeKindsAnswer(raw: RawKindsAnswer): KindsAnswer {
  return { kinds: raw.kinds, complete: raw.complete !== false };
}

/**
 * The answer to keep. ★AN INCOMPLETE ANSWER NEVER DROPS A KIND ALREADY HELD
 * (cms#175): the api's memory is per instance, so a refetch that lands on a
 * cold one mid-outage would otherwise take a chosen kind out of the filter.
 * A complete answer replaces the list outright (a kind can leave it).
 */
export function mergeKindsAnswer(prev: KindsAnswer | undefined, next: KindsAnswer): KindsAnswer {
  if (next.complete || !prev) return next;
  return { kinds: [...new Set([...prev.kinds, ...next.kinds])].sort(), complete: false };
}

/**
 * Poll every minute (the api keeps a fallback 10s, a complete answer 60s)
 * while the answer is incomplete, or while there is none because the query
 * failed. Only while the tab is in view (react-query's default).
 */
export function kindsRefetchInterval(answer: KindsAnswer | undefined, failed: boolean): number | false {
  if (!answer) return failed ? 60_000 : false;
  return answer.complete ? false : 60_000;
}
