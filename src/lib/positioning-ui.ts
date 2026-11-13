import type { CorrectableFieldSpec, EvidenceTier, Positioning, PositioningOptions } from "@/lib/api/audiences";

/**
 * "How you're positioned" (PL-0): the words and the choices, extracted so they can be tested (this repo has no DOM test
 * environment). The api sends what each value IS (`readPositioning`) and what a merchant may pick from
 * (`positioningOptions`, the business category's sub-categories and styles); this file says how each is put to a person.
 * No list is kept here for sub-categories or styles: they come from the server, so the team's edits reach the page.
 */

export const PRICE_TIER_LABEL: Record<string, string> = {
  budget: "Budget",
  mid: "Mid-range",
  premium: "Premium",
  luxury: "Luxury",
};
export const BUYING_PATTERN_LABEL: Record<string, string> = {
  one_off: "One-off purchases",
  repeat: "Customers come back",
  subscription: "Subscriptions",
};
export const SALES_CHANNEL_LABEL: Record<string, string> = {
  own_site: "Your own website",
  marketplace: "Marketplaces",
  physical_store: "Physical stores",
  social: "Social media",
  whatsapp: "WhatsApp",
  other: "Somewhere else",
};
export const AGE_BAND_LABEL: Record<string, string> = {
  "18_24": "18 to 24",
  "25_34": "25 to 34",
  "35_44": "35 to 44",
  "45_54": "45 to 54",
  "55_plus": "55 and over",
};
export const GENDER_LEAN_LABEL: Record<string, string> = {
  women: "Mostly women",
  men: "Mostly men",
  all: "Everyone",
};
export const SPENDING_POWER_LABEL: Record<string, string> = {
  value: "Value-conscious",
  mid: "Mid-range budgets",
  affluent: "Affluent",
};

/** Plain labels for the fields a merchant corrects here (the panel's FIELD_LABEL has the older ones). */
export const POSITIONING_FIELD_LABEL: Record<string, string> = {
  "classification.subIndustry": "What you sell",
  "classification.styles": "Your style",
  "classification.priceTier": "Price level",
  "classification.buyingPattern": "How people buy",
  "classification.salesChannels": "Where you sell",
  "classification.shopper.ageBands": "Shopper age",
  "classification.shopper.genderLean": "Who shops",
  "classification.shopper.spendingPower": "What they spend",
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
  "classification.priceTier": PRICE_TIER_LABEL,
  "classification.buyingPattern": BUYING_PATTERN_LABEL,
  "classification.salesChannels": SALES_CHANNEL_LABEL,
  "classification.shopper.ageBands": AGE_BAND_LABEL,
  "classification.shopper.genderLean": GENDER_LEAN_LABEL,
  "classification.shopper.spendingPower": SPENDING_POWER_LABEL,
};

/** The words for one value of a closed-vocabulary field, or the value itself. */
export function valueLabel(field: string, value: string): string {
  return VALUE_LABELS[field]?.[value] ?? value;
}

/**
 * Where a value came from, in plain words. Observed means different things by field: a buying pattern is read from
 * orders, the channels from the connected store, so the words say which.
 */
export function sourceWords(tier: EvidenceTier, field: string): string {
  if (tier === "stated") return "You told us";
  if (tier === "inferred") return "Our best guess";
  if (field === "classification.buyingPattern") return "Measured from your orders";
  if (field === "classification.salesChannels") return "Measured from your store and orders";
  return "Measured from your data";
}

export interface Choice {
  value: string;
  label: string;
}

/**
 * What a correction can be picked from, or null for a free-text field.
 *   - an enum field: its values, from the spec the server sent;
 *   - a sub-category or style: the category's list, and the merchant may type something the list lacks ("unlisted");
 *     with no list for the category, null (type it in).
 * A style is offered under the business's current sub-category when it is a listed one, else every style once.
 */
export function choicesFor(
  spec: CorrectableFieldSpec,
  options: PositioningOptions | null,
  currentSubCategory?: string,
): { choices: Choice[]; allowUnlisted: boolean } | null {
  // Only the positioning enums: market type keeps its own labelled select in the panel.
  if (spec.values && spec.field in VALUE_LABELS) return { choices: spec.values.map((v) => ({ value: v, label: valueLabel(spec.field, v) })), allowUnlisted: false };
  if (!options) return null;
  if (spec.field === "classification.subIndustry") {
    return { choices: options.subCategories.map((s) => ({ value: s.slug, label: s.label })), allowUnlisted: true };
  }
  if (spec.field === "classification.styles") {
    const under = options.subCategories.filter((s) => s.slug === currentSubCategory);
    const pool = under.length > 0 ? under : options.subCategories;
    const seen = new Set<string>();
    const choices: Choice[] = [];
    for (const sub of pool) {
      for (const style of sub.styles) {
        if (seen.has(style.slug)) continue;
        seen.add(style.slug);
        choices.push({ value: style.slug, label: style.label });
      }
    }
    return { choices, allowUnlisted: true };
  }
  return null;
}

/** The label of a sub-category or style value: the list's own, else the words as typed. */
export function listedLabel(choices: Choice[] | undefined, value: string): string {
  return choices?.find((c) => c.value === value)?.label ?? value;
}

export interface PositioningRow {
  field: string;
  label: string;
  /** Empty means not known yet. */
  values: Array<{ text: string; tier: EvidenceTier }>;
}

/** The block's rows, from the reader's answer. A row with no value is still a row: absent is stated, not hidden. */
export function positioningRows(p: Positioning): PositioningRow[] {
  const L = POSITIONING_FIELD_LABEL;
  const one = (field: string, value: string | undefined, tier: EvidenceTier | undefined) => ({
    field,
    label: L[field]!,
    values: value && tier ? [{ text: valueLabel(field, value), tier }] : [],
  });
  return [
    { field: "classification.subIndustry", label: L["classification.subIndustry"]!, values: p.subCategory ? [{ text: p.subCategory.label, tier: p.subCategory.tier }] : [] },
    { field: "classification.styles", label: L["classification.styles"]!, values: p.styles.map((s) => ({ text: s.label, tier: s.tier })) },
    one("classification.priceTier", p.priceTier?.value, p.priceTier?.tier),
    one("classification.buyingPattern", p.buyingPattern?.value, p.buyingPattern?.tier),
    { field: "classification.salesChannels", label: L["classification.salesChannels"]!, values: p.salesChannels.map((c) => ({ text: valueLabel("classification.salesChannels", c.value), tier: c.tier })) },
    { field: "classification.shopper.ageBands", label: L["classification.shopper.ageBands"]!, values: (p.shopper?.ageBands ?? []).map((b) => ({ text: valueLabel("classification.shopper.ageBands", b.value), tier: b.tier })) },
    one("classification.shopper.genderLean", p.shopper?.genderLean?.value, p.shopper?.genderLean?.tier),
    one("classification.shopper.spendingPower", p.shopper?.spendingPower?.value, p.shopper?.spendingPower?.tier),
  ];
}

/** One line of what a measured value rests on ("42 of 130 customers bought more than once in the last year"), or undefined. */
export function basisLine(field: string, basis: { customers?: number; repeatCustomerShare?: number; ownMedianPrice?: number; currency?: string; sampleSize?: number } | undefined): string | undefined {
  if (!basis) return undefined;
  if (field === "classification.buyingPattern" && basis.customers !== undefined && basis.repeatCustomerShare !== undefined) {
    const repeat = Math.round(basis.repeatCustomerShare * basis.customers);
    return `${repeat} of ${basis.customers} customers bought more than once in the last year.`;
  }
  if (field === "classification.priceTier" && basis.ownMedianPrice !== undefined && basis.sampleSize) {
    return `Your ${basis.sampleSize} active products have a median price of ${basis.ownMedianPrice}${basis.currency ? ` ${basis.currency}` : ""}.`;
  }
  return undefined;
}
