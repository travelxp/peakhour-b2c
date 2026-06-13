/**
 * Country-to-locale config for marketing copy localisation.
 *
 * Covers the Top 10 Shopify markets. Every field drives visible copy on
 * the public site: the WhatsApp mockup store name + price, and the
 * assistant language examples on the commerce pages.
 *
 * Actual plan pricing comes from the API via lib/pricing.ts — this file
 * is copy-only, no monetary decisions are made here.
 */

import { headers } from "next/headers";

export interface MarketingLocale {
  country: string;
  currency: string;
  symbol: string;
  exampleStore: string;
  exampleInitials: string;
  examplePrice: string;
  /** Top languages spoken by shoppers in this market. */
  languages: [string, string, string, string];
}

const LOCALE_MAP: Record<string, MarketingLocale> = {
  US: {
    country: "US", currency: "USD", symbol: "$",
    exampleStore: "Brooklyn Kicks", exampleInitials: "BK", examplePrice: "$189",
    languages: ["Spanish", "French", "Mandarin", "Portuguese"],
  },
  GB: {
    country: "GB", currency: "GBP", symbol: "£",
    exampleStore: "East End Kicks", exampleInitials: "EK", examplePrice: "£149",
    languages: ["French", "Polish", "Urdu", "Welsh"],
  },
  AU: {
    country: "AU", currency: "AUD", symbol: "A$",
    exampleStore: "Bondi Threads", exampleInitials: "BT", examplePrice: "A$279",
    languages: ["Mandarin", "Arabic", "Vietnamese", "Cantonese"],
  },
  CA: {
    country: "CA", currency: "CAD", symbol: "CA$",
    exampleStore: "Maple Street Kicks", exampleInitials: "MK", examplePrice: "CA$249",
    languages: ["French", "Mandarin", "Punjabi", "Spanish"],
  },
  DE: {
    country: "DE", currency: "EUR", symbol: "€",
    exampleStore: "Berliner Kicks", exampleInitials: "BK", examplePrice: "€169",
    languages: ["Turkish", "Arabic", "Polish", "Russian"],
  },
  FR: {
    country: "FR", currency: "EUR", symbol: "€",
    exampleStore: "Marais Kicks", exampleInitials: "MK", examplePrice: "€169",
    languages: ["Arabic", "Spanish", "Portuguese", "Italian"],
  },
  NL: {
    country: "NL", currency: "EUR", symbol: "€",
    exampleStore: "Amsterdam Kicks", exampleInitials: "AK", examplePrice: "€169",
    languages: ["Turkish", "Arabic", "Spanish", "English"],
  },
  BR: {
    country: "BR", currency: "BRL", symbol: "R$",
    exampleStore: "São Paulo Kicks", exampleInitials: "SP", examplePrice: "R$999",
    languages: ["Spanish", "English", "Italian", "German"],
  },
  IN: {
    country: "IN", currency: "INR", symbol: "₹",
    exampleStore: "Mumbai Kicks", exampleInitials: "MK", examplePrice: "₹15,999",
    languages: ["Hindi", "Tamil", "Bengali", "Marathi"],
  },
  ES: {
    country: "ES", currency: "EUR", symbol: "€",
    exampleStore: "Barcelona Kicks", exampleInitials: "BC", examplePrice: "€169",
    languages: ["Catalan", "French", "Portuguese", "Arabic"],
  },
};

const DEFAULT: MarketingLocale = LOCALE_MAP.US;

export function getMarketingLocale(country: string): MarketingLocale {
  return LOCALE_MAP[country.toUpperCase()] ?? DEFAULT;
}

/**
 * Reads x-vercel-ip-country from the incoming request headers and returns
 * the matching marketing locale. Falls back to US when the header is absent
 * (local dev) or the country is not in the supported map.
 *
 * Safe to call from any server component in the (site) route group — the
 * root layout already forces dynamic rendering via `await connection()`.
 */
export async function resolveMarketingLocale(): Promise<MarketingLocale> {
  const h = await headers();
  const raw = h.get("x-vercel-ip-country");
  const country = raw && /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : "US";
  return getMarketingLocale(country);
}
