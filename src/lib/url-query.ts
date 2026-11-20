/**
 * Set one query parameter on a path or absolute URL, keeping the rest of its
 * query and any fragment. Sets rather than appends, so a repeat never
 * duplicates the key.
 */
export function setQueryParam(
  path: string,
  key: string,
  value: string,
): string {
  const hashAt = path.indexOf("#");
  const hash = hashAt >= 0 ? path.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? path.slice(0, hashAt) : path;
  const queryAt = beforeHash.indexOf("?");
  const base = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const params = new URLSearchParams(
    queryAt >= 0 ? beforeHash.slice(queryAt + 1) : "",
  );
  params.set(key, value);
  return `${base}?${params.toString()}${hash}`;
}
