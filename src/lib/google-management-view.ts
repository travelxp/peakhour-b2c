import type { GoogleAd, GoogleAdStatus, GoogleCampaignSettings, GoogleSettingsInput } from "@/lib/api/google-ads";
import { formatGoogleMoney } from "@/lib/google-ads-view";

/**
 * ★★G14c — the words and decisions of a Google campaign's management (RMF
 * M.10, M.110, M.130, C.190): the settings form's draft and what a save sends,
 * the irreversible remove's typed confirmation, and an ad's status and the
 * actions it offers. The screens (`google-campaign-manage-dialog.tsx`,
 * `google-ads-list-section.tsx`) only render what this decides.
 */

/** What the settings form holds: text as typed, so a half-typed budget is not a number yet. */
export interface GoogleSettingsDraft {
  name: string;
  budget: string;
  /** `YYYY-MM-DD`, or "" for no end. */
  endDate: string;
  searchPartners: boolean;
  displayNetwork: boolean;
}

/** The draft a form starts from: what Google holds now. */
export function googleSettingsDraftOf(s: GoogleCampaignSettings): GoogleSettingsDraft {
  return {
    name: s.name,
    budget: String(s.budget.amount),
    endDate: s.endDate ?? "",
    searchPartners: s.network?.searchPartners ?? false,
    displayNetwork: s.network?.displayNetwork ?? false,
  };
}

/**
 * Today as `YYYY-MM-DD` in the ACCOUNT's zone (review round 1): Google reads the
 * end date there, and so does the api's "already passed" refusal. The browser's
 * day when the read named no zone `Intl` can use.
 */
export function googleAccountToday(timeZone: string | undefined, now: Date = new Date()): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
      const get = (t: string) => parts.find((p) => p.type === t)?.value;
      const [y, m, d] = [get("year"), get("month"), get("day")];
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      // An unknown zone falls through to the browser's day.
    }
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * What stops a save, in the merchant's words, or null. `today` is the account's
 * (`googleAccountToday`). ★AN END DATE LEFT AS GOOGLE HOLDS IT IS NOT JUDGED
 * (review round 1): a campaign whose end has passed can still be renamed, or
 * have its budget lowered.
 */
export function googleSettingsProblem(s: GoogleCampaignSettings, d: GoogleSettingsDraft, today: string): string | null {
  if (!d.name.trim()) return "Give the campaign a name.";
  if (/[\n\r]/.test(d.name)) return "The name must be on one line.";
  const amount = Number(d.budget);
  if (!d.budget.trim() || !Number.isFinite(amount) || amount <= 0) return "Enter a daily budget above zero.";
  if (d.endDate && d.endDate !== (s.endDate ?? "") && d.endDate < today) return "The end date is in the past.";
  return null;
}

/**
 * ★ONLY WHAT CHANGED is sent, so a save of the name never re-sends a budget the
 * merchant did not touch (and a budget Google changed since is not undone).
 * Null when nothing differs from what Google holds.
 */
export function googleSettingsChangeOf(s: GoogleCampaignSettings, d: GoogleSettingsDraft): GoogleSettingsInput | null {
  const out: GoogleSettingsInput = {};
  if (d.name.trim() !== s.name.trim()) out.name = d.name.trim();
  const amount = Number(d.budget);
  if (Number.isFinite(amount) && amount !== s.budget.amount) out.dailyBudget = { amount };
  const endDate = d.endDate || null;
  if (endDate !== s.endDate) out.endDate = endDate;
  if (s.network && (d.searchPartners !== s.network.searchPartners || d.displayNetwork !== s.network.displayNetwork)) {
    out.network = { searchPartners: d.searchPartners, displayNetwork: d.displayNetwork };
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Where a Search campaign shows, in words. */
export function googleNetworkSentence(n: GoogleCampaignSettings["network"]): string | null {
  if (!n) return null;
  const places = [n.googleSearch ? "Google Search" : null, n.searchPartners ? "search partner sites" : null, n.displayNetwork ? "the Google Display Network" : null].filter(
    (p): p is string => p !== null,
  );
  return places.length > 0 ? `Shows on ${places.join(", ")}.` : "Shows nowhere: every network is off in Google Ads.";
}

/** The settings as one line, for the dialog's "Now:". */
export function googleSettingsSentence(s: GoogleCampaignSettings): string {
  const budget = `${formatGoogleMoney(s.budget.amount, s.budget.currencyCode)}/day`;
  const end = s.endDate ? `ends ${s.endDate}` : "runs until you stop it";
  return `${budget}, ${end}.${s.budget.shared ? " Its budget is shared with other campaigns in Google Ads, so it is changed there." : ""}`;
}

/** What a save did, in words. */
export function googleSettingsSavedSentence(changed: boolean): string {
  return changed ? "Saved on Google Ads." : "Google Ads already had these settings.";
}

// ── the ad group's name at create (RMF C.190) ─────────────────────────────

/** v26 ad_group.name, held to at most 255 UTF-8 bytes on one line, as the api holds it. The api refuses, never cuts, a name past it. */
export const GOOGLE_AD_GROUP_NAME_MAX_BYTES = 255;

/** What stops the typed ad group name, or null (empty is fine: the campaign's name is used). */
export function googleAdGroupNameProblem(name: string): string | null {
  const t = name.trim();
  if (!t) return null;
  if (/[\n\r\u0000]/.test(t)) return "The ad group name must be on one line.";
  if (new TextEncoder().encode(t).length > GOOGLE_AD_GROUP_NAME_MAX_BYTES) return "The ad group name is too long for Google Ads.";
  return null;
}

/** What the create sends: the trimmed name, or nothing (the api names it after the campaign) — and never for Performance Max. */
export function googleAdGroupNameOf(channelType: string, name: string): { adGroupName: string } | Record<string, never> {
  const t = name.trim();
  return channelType === "PERFORMANCE_MAX" || !t ? {} : { adGroupName: t };
}

// ── remove (RMF M.110) ────────────────────────────────────────────────────

/** ★THE TYPED NAME CONFIRMS IT: exact, spaces at the ends aside (the api's own rule). */
export function googleRemoveConfirmed(campaignName: string, typed: string): boolean {
  return typed.trim() !== "" && typed.trim() === campaignName.trim();
}

export const GOOGLE_REMOVE_WARNING =
  "Removing a campaign on Google Ads can't be undone. It stops showing at once, it can never be started again, and its ads go with it. " +
  "Its reports stay. To stop it for now, pause it instead.";

// ── ads (RMF M.130) ───────────────────────────────────────────────────────

export function googleAdStatusLabel(status: string): string {
  switch (status) {
    case "ENABLED":
      return "Running";
    case "PAUSED":
      return "Paused";
    case "REMOVED":
      return "Removed";
    default:
      return "Unknown";
  }
}

/** The actions an ad offers: none for a removed one (Google refuses any change to it), or when the campaign is finished. */
export function googleAdActions(status: string, campaignOpen: boolean): Array<{ status: GoogleAdStatus; label: string }> {
  if (!campaignOpen || status === "REMOVED") return [];
  const out: Array<{ status: GoogleAdStatus; label: string }> = [];
  if (status === "ENABLED") out.push({ status: "PAUSED", label: "Pause" });
  if (status === "PAUSED") out.push({ status: "ENABLED", label: "Enable" });
  if (status === "ENABLED" || status === "PAUSED") out.push({ status: "REMOVED", label: "Remove" });
  return out;
}

/** An ad, in one line: its first headlines, or its type when it carries no text we can read. */
export function googleAdSummary(ad: Pick<GoogleAd, "headlines" | "type">): string {
  if (ad.headlines.length > 0) return ad.headlines.slice(0, 3).join(" | ");
  return ad.type === "DEMAND_GEN_VIDEO_RESPONSIVE_AD" ? "Video ad" : ad.type === "RESPONSIVE_SEARCH_AD" ? "Responsive search ad" : "Ad";
}

/** What an ad change did, in words. */
export function googleAdSavedSentence(status: GoogleAdStatus, changed: boolean): string {
  if (!changed) return "Google Ads already had the ad that way.";
  return status === "ENABLED" ? "Ad enabled on Google Ads." : status === "PAUSED" ? "Ad paused on Google Ads." : "Ad removed on Google Ads.";
}
