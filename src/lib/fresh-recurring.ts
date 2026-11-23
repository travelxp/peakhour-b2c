/**
 * "Write a new post each time" (Content Wave 2, W2-D): a recurring rule whose post is written fresh ahead of every repeat.
 *
 * The api writes the post about two days BEFORE it is due, as a draft in Needs your OK; approving it schedules it for the rule's time. If nobody approves it, nothing goes out
 * and the rule says so. Writing costs Peaks, so it only happens when Automatic writing is switched on for "Fresh recurring posts" with the one monthly limit set (the card on
 * Content > Create). Every number here is the api's (`GET /v1/content/auto-write`, which reads the rate card): none is typed. Peaks only, never money.
 */
import type { ContentHubIntegration } from "@/lib/nav-queries";
import { metaComposeTargets } from "@/lib/meta-compose";
import type { AutoWriteStatus } from "@/lib/auto-write";
import { peaksWord } from "@/lib/wordpress-ai-images";
import type { RecurringRuleInput } from "@/components/scheduler/recurring-schedule-editor";

export const FRESH_CHANNELS = ["linkedin", "x", "facebook", "threads"] as const;
export type FreshChannel = (typeof FRESH_CHANNELS)[number];

export interface FreshChannelOption {
  value: FreshChannel;
  label: string;
}

const LABEL: Record<FreshChannel, string> = { linkedin: "LinkedIn", x: "X", facebook: "Facebook", threads: "Threads" };

/**
 * The channels a rule can write for: the ones the merchant has connected, in picker order. LinkedIn and X are judged by their own connection; Facebook and Threads by the
 * same reading the New post sheet uses (`metaComposeTargets`). Instagram is never offered: it needs a picture, and these posts are words. While the list is loading (or
 * failed) none is offered, rather than one that may be refused.
 */
export function freshChannelOptions(integrations: readonly ContentHubIntegration[] | undefined): FreshChannelOption[] {
  const rows = integrations ?? [];
  const has = (provider: string) => rows.some((i) => i.provider === provider && i.connected === true);
  const meta = new Set<string>(metaComposeTargets(rows).map((t) => t.channel));
  const on: Record<FreshChannel, boolean> = { linkedin: has("linkedin_content"), x: has("x"), facebook: meta.has("facebook"), threads: meta.has("threads") };
  return FRESH_CHANNELS.filter((c) => on[c]).map((value) => ({ value, label: LABEL[value] }));
}

export interface FreshRuleDraft {
  name: string;
  topic: string;
  channels: FreshChannel[];
  rule: RecurringRuleInput;
}

/** The api's own bounds (`routes/scheduler`): a topic of 3 to 500 characters, a name of 1 to 256. */
export const TOPIC_MIN = 3;
export const TOPIC_MAX = 500;
export const NAME_MAX = 256;

export const FRESH_COPY = {
  button: "New recurring post",
  title: "Write a new post each time",
  intro: "Peakhour writes a fresh post about two days before each one is due and puts it in Needs your OK. It goes out at the time you set once you approve it. If you do not approve it, nothing is posted.",
  nameLabel: "Name",
  namePlaceholder: "Tuesday tip",
  topicLabel: "What should each post be about?",
  topicPlaceholder: "A quick cooking tip for busy weeknights",
  channelsLabel: "Post on",
  noChannels: "Connect LinkedIn, X, Facebook or Threads to use this.",
  channelsNote: "Instagram needs a picture with every post, so it is not offered here.",
  zoneLabel: "Time zone",
  create: "Create rule",
  creating: "Creating…",
  cancel: "Cancel",
  created: "Recurring post created.",
  failed: "That did not work. Check your entries and try again.",
  autoWriteLink: "Automatic writing",
  autoWriteHref: "/dashboard/content/create",
  needsOkLink: "Needs your OK",
  needsOkHref: "/dashboard/content/needs-ok",
} as const;

/** What stops the rule from being created, in the merchant's words, one per problem. */
export function freshRuleProblems(d: FreshRuleDraft): string[] {
  const out: string[] = [];
  if (!d.name.trim()) out.push("Give the rule a name.");
  else if (d.name.trim().length > NAME_MAX) out.push(`The name can be up to ${NAME_MAX} characters.`);
  const topic = d.topic.trim();
  if (topic.length < TOPIC_MIN) out.push("Say what each post should be about.");
  else if (topic.length > TOPIC_MAX) out.push(`The topic can be up to ${TOPIC_MAX} characters.`);
  if (d.channels.length === 0) out.push("Choose at least one channel.");
  if (d.rule.freq === "weekly" && (d.rule.weekdays ?? []).length === 0) out.push("Choose at least one weekday.");
  if (d.rule.freq === "monthly" && !(d.rule.dayOfMonth && d.rule.dayOfMonth >= 1 && d.rule.dayOfMonth <= 31)) out.push("Choose a day of the month.");
  if (!d.rule.timezone) out.push("Choose a time zone.");
  return out;
}

/** The body of `POST /v1/scheduler/recurring-rules` for a rule that writes a new post each time. Only the fields that apply to the chosen rhythm are sent (the api refuses the others). */
export function buildFreshRuleBody(d: FreshRuleDraft) {
  const r = d.rule;
  return {
    name: d.name.trim(),
    planTemplate: { sourceType: "ai_generated" as const, topic: d.topic.trim(), channels: d.channels.map((channel) => ({ channel })) },
    freq: r.freq,
    interval: r.interval ?? 1,
    ...(r.freq === "weekly" ? { weekdays: r.weekdays ?? [] } : {}),
    ...(r.freq === "monthly" ? { dayOfMonth: r.dayOfMonth } : {}),
    localTime: r.localTime,
    timezone: r.timezone,
    effectiveFrom: r.effectiveFrom,
    ...(r.effectiveUntil ? { effectiveUntil: r.effectiveUntil } : {}),
    ...(r.maxRuns ? { maxRuns: r.maxRuns } : {}),
  };
}

export type SetupState = "ready" | "loading" | "off" | "no_limit" | "not_priced" | "reaccept" | "no_room";

export interface Setup {
  state: SetupState;
  /** Today's price per post in Peaks, from the api; null when it cannot be priced (or is still loading). */
  pricePeaks: number | null;
  /** What to tell the merchant; null when it is simply ready and there is nothing to add. */
  text: string | null;
}

/**
 * Will a rule that writes a new post each time actually write? Judged from the api's status for the `fresh_recurring` job: it must be on, priced, at the price the merchant accepted,
 * with the one monthly limit set and room left in it. The sentence says what to do, never a code.
 */
export function freshSetup(status: AutoWriteStatus | undefined): Setup {
  if (!status) return { state: "loading", pricePeaks: null, text: null };
  const job = status.jobs.find((j) => j.job === "fresh_recurring");
  const price = job?.pricePerDraftPeaks ?? null;
  if (!job || !job.enabled) return { state: "off", pricePeaks: price, text: "Switch on Fresh recurring posts in Automatic writing and set a monthly limit, or this rule will not write anything." };
  if (price === null) return { state: "not_priced", pricePeaks: null, text: "The price of a post cannot be read right now, so nothing is written until it can." };
  if (job.needsReaccept) return { state: "reaccept", pricePeaks: price, text: "The price of a post has changed. Accept the new price in Automatic writing, or this rule will not write anything." };
  if (status.monthlyCapPeaks === null) return { state: "no_limit", pricePeaks: price, text: "Set a monthly limit in Automatic writing, or this rule will not write anything." };
  if (status.remainingPeaks !== null && status.remainingPeaks < price) return { state: "no_room", pricePeaks: price, text: "This month's limit for Automatic writing has no room for another post, so none will be written until next month or until you raise it." };
  return { state: "ready", pricePeaks: price, text: null };
}

/** "Each post costs 225 Peaks, charged only when it is written." */
export function freshPriceLine(price: number | null): string | null {
  return price === null ? null : `Each post costs ${peaksWord(price)}, charged only when it is written.`;
}

/** The code the api stamps on a rule when its post time came and nothing approved was waiting. It is a note about a missed post, not a failure to run. */
export const NO_APPROVED_DRAFT = "NO_APPROVED_DRAFT";
