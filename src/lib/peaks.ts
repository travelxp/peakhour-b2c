/**
 * Server-side helper for fetching country-resolved Peaks top-up packs from the
 * peakhour-api `GET /v1/platform/peaks` endpoint. Powers the marketing /peaks
 * page. Mirrors lib/pricing.ts: the API resolves the caller's country (query →
 * Vercel `x-vercel-ip-country` header → DEFAULT) and returns the publicly
 * priced packs in the matching currency.
 *
 * The list is EMPTY until ops prices + publishes a pack — the page renders a
 * "Peaks are managed with your plan" fallback in that case, never a broken table.
 */

import { unstable_cache as cache } from "next/cache";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface PeakPack {
  key: string;
  name: string;
  tagline?: string;
  description?: string;
  /** Peaks this pack adds. */
  credits: number;
  /** One-time price as a decimal string (e.g. "5.00"). */
  amount: string;
  currency: string;
  displayPrefix?: string;
  // The api also sends `highlight` (cfg_addons.display.highlight). It is left
  // off this type on purpose: "Best value" is derived from the unit prices
  // (`lib/peaks-pack-unit-price`), because the stored flag sat on a pack that
  // was not the cheapest per 1,000 Peaks.
}

export interface PeaksResponse {
  country: string;
  packs: PeakPack[];
}

async function fetchPeaks(country: string): Promise<PeaksResponse | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(
      `${API_URL}/v1/platform/peaks?country=${encodeURIComponent(country)}`,
      { next: { revalidate: 300, tags: ["platform-peaks"] } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: PeaksResponse };
    if (!json.ok || !json.data) return null;
    return { country: json.data.country, packs: json.data.packs ?? [] };
  } catch {
    return null;
  }
}

export const getPeaks = cache(fetchPeaks, ["platform-peaks"], {
  // Tag-based revalidate — a future CMS addon supersede can invalidate via
  // revalidateTag("platform-peaks"), same pattern as platform-pricing.
  revalidate: 300,
  tags: ["platform-peaks"],
});

/** "$5" / "₹399" — drops trailing .00 but keeps real cents. */
export function formatPackPrice(p: PeakPack): string {
  const n = Number(p.amount);
  const num = Number.isNaN(n)
    ? p.amount
    : n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${p.displayPrefix ?? ""}${num}`;
}

/**
 * A unit price (per 1,000 Peaks) in this pack's money: "$0.90" / "₹74.95".
 * Same locale as `formatPackPrice` so the two lines on a card match, but always
 * two decimals ("$0.9" reads as a typo on a price). With no `displayPrefix` it
 * falls back to the currency code, never a bare number.
 */
export function formatPackUnitPrice(p: Pick<PeakPack, "currency" | "displayPrefix">, unit: number): string {
  const num = unit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return p.displayPrefix ? `${p.displayPrefix}${num}` : `${p.currency} ${num}`;
}
