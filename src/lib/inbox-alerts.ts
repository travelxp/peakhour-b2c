/**
 * The inbox alert switches in Settings > Preferences (Inbox phase 1).
 *
 * Three emails go to a business's owners and admins: a shopper is waiting for a person, a new lead, a review of two stars or fewer.
 * A fourth (team desk, I3a) goes to whoever a conversation is assigned to, so it is for every editor and above.
 * Each person chooses for themselves. ★ABSENT MEANS ON: nobody was migrated, so a switch nobody has touched reads as on, and only
 * an explicit `false` is an opt-out (the api reads `=== false`, mirrored here).
 */

export type InboxAlertKey = "needsHuman" | "newLead" | "badReview" | "assigned";
export type InboxAlertPrefs = Partial<Record<InboxAlertKey, boolean>>;

/** Who an alert is for: the three business alerts go to owners and admins; "assigned" goes to the assignee, any editor or above. */
export type InboxAlertAudience = "admins" | "editors";

export const INBOX_ALERTS: Array<{ key: InboxAlertKey; label: string; hint: string; audience: InboxAlertAudience }> = [
  { key: "needsHuman", label: "A shopper is waiting for a reply", hint: "A shopper asked for a person, or the assistant could not answer twice. We email you once for each.", audience: "admins" },
  { key: "newLead", label: "A new lead arrives", hint: "A lead lands in your inbox.", audience: "admins" },
  { key: "badReview", label: "A review of two stars or fewer", hint: "A Google review you have not answered yet.", audience: "admins" },
  { key: "assigned", label: "A conversation is assigned to me", hint: "A teammate hands you a conversation. We email you once for each.", audience: "editors" },
];

/** The footer line: who gets these, and how often at most. */
export const INBOX_ALERTS_NOTE =
  "These emails go to owners and admins. If many arrive in an hour we send one email that says several things are waiting.";

/** What an editor reads under the one switch they have. */
export const INBOX_ALERTS_EDITOR_NOTE = "We email you when a teammate assigns a conversation to you.";

/** Whether an alert is on for a person: anything but an explicit `false`. */
export function alertIsOn(prefs: InboxAlertPrefs | null | undefined, key: InboxAlertKey): boolean {
  return prefs?.[key] !== false;
}

/** The four switches as the page shows them. */
export function alertSwitches(prefs: InboxAlertPrefs | null | undefined): Record<InboxAlertKey, boolean> {
  return { needsHuman: alertIsOn(prefs, "needsHuman"), newLead: alertIsOn(prefs, "newLead"), badReview: alertIsOn(prefs, "badReview"), assigned: alertIsOn(prefs, "assigned") };
}

/**
 * What to save when one switch changes: ALL FOUR keys, because the api replaces the whole `inboxAlerts` object (a shallow merge of
 * preferences; the team desk api merges per key, but this client keeps its contract). Sending only the changed key would turn the
 * others back on, and an editor saving "assigned" must not switch the three they cannot see back on or off by accident.
 */
export function alertsPatch(prefs: InboxAlertPrefs | null | undefined, key: InboxAlertKey, on: boolean): Record<InboxAlertKey, boolean> {
  return { ...alertSwitches(prefs), [key]: on };
}

/** Owners and admins are the recipients of the three business alerts. */
export function canSeeInboxAlerts(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Editors and above can be assigned a conversation, so they get that one switch. A viewer gets none. */
export function canSeeAssignedAlert(role: string | null | undefined): boolean {
  return canSeeInboxAlerts(role) || role === "editor";
}

/** The switches this role is shown: all four for an owner or admin, only "assigned" for an editor, none for anyone else. */
export function alertsForRole(role: string | null | undefined): typeof INBOX_ALERTS {
  if (canSeeInboxAlerts(role)) return INBOX_ALERTS;
  return canSeeAssignedAlert(role) ? INBOX_ALERTS.filter((a) => a.audience === "editors") : [];
}
