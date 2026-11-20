/**
 * Merchant-facing words of the ad-account choice that every channel shares (MR-G0). A leaf module: the neutral chooser
 * (`components/ads/ad-account-choice.tsx`) and the Meta views both read it, and neither imports the other.
 */

/** The warning when no ad account is ticked yet. */
export const CHOOSE_AD_ACCOUNTS = "Choose the ad accounts this business may use before creating campaigns.";

/** The line under an ad account the business has not enabled: Peakhour starts nothing there, but a running campaign can be stopped or cut (MR-G4). */
export const PAUSE_ONLY_NOTICE = "Peakhour does not run new spend in this account. You can pause or lower what is running.";
