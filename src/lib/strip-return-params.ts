/**
 * The query string with the named params removed and everything else kept.
 * A returnTo carrying its own query (e.g. /dashboard/ads?channel=linkedin)
 * must survive, or the page reloads onto a different channel than the user
 * left. Shared by every surface that consumes an OAuth return.
 */
export function stripReturnParams(
  searchParams: { toString(): string } | null | undefined,
  keys: readonly string[],
): string {
  const next = new URLSearchParams(searchParams?.toString() ?? "");
  for (const k of keys) next.delete(k);
  return next.toString();
}
