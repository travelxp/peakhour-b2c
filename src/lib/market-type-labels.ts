/**
 * The words for "who you sell to", in one place so onboarding's "Is this you?" and the audience profile ("Your business")
 * say the same thing. The keys are the api's `classification.marketType` values.
 */
export const MARKET_TYPE_LABEL: Record<string, string> = {
  b2b: "Businesses (B2B)",
  b2c: "People (B2C)",
  b2b2c: "Both — you serve people, businesses pay (B2B2C)",
  unknown: "Not sure yet",
};

/** What a merchant can pick at onboarding, in the order shown. "unknown" is the api's own guess, never a choice. */
export const MARKET_TYPE_CHOICES = ["b2b", "b2c", "b2b2c"] as const;
export type MarketTypeChoice = (typeof MARKET_TYPE_CHOICES)[number];

export function isMarketTypeChoice(v: unknown): v is MarketTypeChoice {
  return typeof v === "string" && (MARKET_TYPE_CHOICES as readonly string[]).includes(v);
}
