/**
 * The switch for a business's HELPFUL emails in Settings > Preferences (PE-14): the Monday summary of how its listings did, and Peakhour's tips.
 *
 * It is the notifications engine's own "turn off tips" switch (`ntf_prefs.helpfulOff`), so the dashboard, the Shopify app and the opt-out link in the
 * summary email all move ONE setting. It belongs to the BUSINESS, not to a person: an owner or an admin changes it, and everyone else reads it.
 * ★ABSENT MEANS ON: nobody was migrated, so a business that never touched it reads as on.
 *
 * Alerts that need a person to act (control of a listing lost, a duplicate, figures that fell) are NOT behind this switch, and the card says so.
 */

export const TIPS_TITLE = "Weekly summary and tips";
export const TIPS_DESCRIPTION = "The Monday email on how your listings did, and Peakhour's tips";
export const TIPS_LABEL = "Email the weekly listings summary and tips";
export const TIPS_HINT =
  "One email on Monday morning, with each place and each network on its own. It is only sent when there is something to say. This also turns Peakhour's tips off or on. It is a setting for the whole business.";
export const TIPS_ALERTS_NOTE = "Alerts that need you to act, such as losing control of a listing, are separate and always arrive.";
export const TIPS_READONLY_NOTE = "An owner or an admin can change this.";

/** Who may change the business's setting: the api's rule (`requireRole("admin")`), mirrored so the switch is not offered to someone it would refuse. */
export function canChangeTips(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** The answer of `GET /v1/notifications/tips`. */
export interface TipsAnswer {
  enabled: boolean;
  canChange: boolean;
}
