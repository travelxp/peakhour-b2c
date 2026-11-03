/**
 * The inbox alert switches in Settings > Preferences (Inbox phase 1).
 *
 * Three emails go to a business's owners and admins: a shopper is waiting for a person, a new lead, a review of two stars or fewer.
 * Each person chooses for themselves. ★ABSENT MEANS ON: nobody was migrated, so a switch nobody has touched reads as on, and only
 * an explicit `false` is an opt-out (the api reads `=== false`, mirrored here).
 */

export type InboxAlertKey = "needsHuman" | "newLead" | "badReview";
export type InboxAlertPrefs = Partial<Record<InboxAlertKey, boolean>>;

export const INBOX_ALERTS: Array<{ key: InboxAlertKey; label: string; hint: string }> = [
  { key: "needsHuman", label: "A shopper is waiting for a reply", hint: "A shopper asked for a person, or the assistant could not answer twice. We email you once for each." },
  { key: "newLead", label: "A new lead arrives", hint: "A lead lands in your inbox." },
  { key: "badReview", label: "A review of two stars or fewer", hint: "A Google review you have not answered yet." },
];

/** The footer line: who gets these, and how often at most. */
export const INBOX_ALERTS_NOTE =
  "These emails go to owners and admins. If many arrive in an hour we send one email that says several things are waiting.";

/** Whether an alert is on for a person: anything but an explicit `false`. */
export function alertIsOn(prefs: InboxAlertPrefs | null | undefined, key: InboxAlertKey): boolean {
  return prefs?.[key] !== false;
}

/** The three switches as the page shows them. */
export function alertSwitches(prefs: InboxAlertPrefs | null | undefined): Record<InboxAlertKey, boolean> {
  return { needsHuman: alertIsOn(prefs, "needsHuman"), newLead: alertIsOn(prefs, "newLead"), badReview: alertIsOn(prefs, "badReview") };
}

/**
 * What to save when one switch changes: ALL THREE keys, because the api replaces the whole `inboxAlerts` object (a shallow merge of
 * preferences). Sending only the changed key would turn the other two back on.
 */
export function alertsPatch(prefs: InboxAlertPrefs | null | undefined, key: InboxAlertKey, on: boolean): Record<InboxAlertKey, boolean> {
  return { ...alertSwitches(prefs), [key]: on };
}

/** Owners and admins are the only recipients, so only they are shown the switches. */
export function canSeeInboxAlerts(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
