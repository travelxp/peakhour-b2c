/** Shared formatters for the CMS AI Operations pages. */

export function formatTokens(n: number | undefined | null): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatMs(ms: number | undefined | null): string {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatUsd(n: number | undefined | null): string {
  if (n == null) return "—";
  if (n < 0.01 && n > 0) return `<$0.01`;
  return `$${n.toFixed(2)}`;
}

export function formatPct(n: number | undefined | null, digits = 1): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatDateTime(d: string | Date | undefined | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}
