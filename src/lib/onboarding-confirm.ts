import { isMarketTypeChoice, type MarketTypeChoice } from "@/lib/market-type-labels";

/** The longest "What you sell" the api accepts (the confirm body's `businessType`). */
export const BUSINESS_TYPE_MAX = 128;

interface ProfileLike {
  displayName: string;
  businessCategory: string;
  description: string;
  businessType?: string;
}

export interface ConfirmEdits {
  displayName: string;
  businessCategory: string;
  description: string;
  businessType: string;
}

/**
 * The body of `POST /v1/onboarding/confirm` (PL-5b): the merchant confirms their own type of business and who they sell to.
 * ★`businessType` is sent only when it has words in it (a blank box means "no answer", never an empty type), trimmed and cut at
 * the api's limit. `marketType` (answered on the page whether or not the details were edited) is sent only when one of the three was chosen: none chosen sends nothing and the api keeps its guess.
 */
export function buildConfirmBody<P extends ProfileLike>(
  url: string,
  profile: P,
  edits: ConfirmEdits | null,
  marketType: MarketTypeChoice | "",
): { url: string; profile: P; marketType?: MarketTypeChoice; notifyByEmail: false } {
  const base = edits ? { ...profile, displayName: edits.displayName, businessCategory: edits.businessCategory, description: edits.description } : profile;
  const rawType = edits ? edits.businessType : (profile.businessType ?? "");
  const businessType = rawType.trim().slice(0, BUSINESS_TYPE_MAX).trim();
  const { businessType: _drop, ...rest } = base;
  void _drop;
  return {
    url,
    profile: { ...rest, ...(businessType ? { businessType } : {}) } as P,
    ...(isMarketTypeChoice(marketType) ? { marketType } : {}),
    notifyByEmail: false,
  };
}
