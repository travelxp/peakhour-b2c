/**
 * Deterministic source-text fingerprint for the scheduler's
 * `source.sourceTextHash`.
 *
 * The scheduler commit route (`peakhour-api` /v1/scheduler/plans)
 * validates this field against `^[a-f0-9]{40}$` — a 40-char lowercase
 * hex string (SHA-1 shape). The server STORES it verbatim and later
 * compares a client-provided value against the stored one to detect
 * payload staleness; it never recomputes a SHA-1 server-side. So we
 * only need a deterministic 40-char lowercase-hex value derived from
 * the content — not a cryptographic digest.
 *
 * We avoid `crypto.subtle.digest` (async — would force the callers'
 * synchronous `useMemo` source objects to become async/stateful) and
 * instead compute five independent FNV-1a-style 32-bit passes (each
 * seeded from a different offset basis) and concatenate them as
 * 5 × 8 = 40 lowercase hex chars. Non-cryptographic but well-
 * distributed enough for dedup/staleness, and synchronous.
 */

const SEED_BASES = [0x811c9dc5, 0x01000193, 0xdeadbeef, 0x9e3779b1, 0x85ebca77];
const FNV_PRIME = 0x01000193;

export function sourceTextHash(input: string): string {
  let out = "";
  for (const base of SEED_BASES) {
    let h = base >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, FNV_PRIME) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  // 5 × 8 = 40 lowercase hex chars — satisfies /^[a-f0-9]{40}$/.
  return out;
}
