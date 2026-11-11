/**
 * The Inbox team desk (I3a): who a conversation is assigned to, the team's notes and tags, the first-reply timer, business hours and
 * the pause of the shopper assistant. Every decision the screens make is here (tested); the components are markup and wiring.
 *
 * ★THE API COMPUTES THE TIMER AND THE LABELS. The page never recomputes a timer from timestamps and never retypes the note label
 * or the pause copy: it shows what `GET /v1/inbox-desk/*` and the list rows carry.
 */

import { assigneeFilterFromParam, deskListParams, priorityFilterFromParam, tagFromParam } from "@/lib/desk-list-params";
import { canReply } from "@/lib/wa-inbox-reply";

// ── what the api sends ──────────────────────────────────────────────────────────────────────────────────────────────

export interface ThreadAssignee {
  userId: string;
  name: string;
}

/** Server-computed, only on a conversation in Needs you. `paused`: the team is closed, so the clock is stopped. */
export interface ResponseTimer {
  state: "ok" | "amber" | "red";
  elapsedMinutes: number;
  targetMinutes: number;
  paused: boolean;
}

/** Team desk parity (SA-10): normal, or flagged high by a person. The api stores only "high"; normal is the absence. */
export type Priority = "normal" | "high";

/** Someone who has the conversation open right now (a ping within the last minute). Team-only. */
export interface Viewer {
  userId: string;
  name: string;
  replying: boolean;
}

export interface TeamMemberRef {
  userId: string;
  name: string;
  role: string;
}

export interface DeskTag {
  id: string;
  name: string;
}

export interface DeskNote {
  id: string;
  body: string;
  authorUserId: string;
  authorName: string;
  createdAt: string;
  /** The teammates (user ids) the note @mentions. Absent on an older api. */
  mentions?: string[];
}

export interface DeskDay {
  day: number;
  open: string;
  close: string;
}

export interface DeskSettings {
  aiPaused: boolean;
  aiPausedAt: string | null;
  autoAssign: { enabled: boolean; availableUserIds: string[] };
  /** SA-10. Absent on an older api = off. */
  autoClose?: { enabled: boolean; days: number };
  smartTags?: { enabled: boolean; map: Array<{ topic: string; tagId: string }> };
  channelRouting?: { enabled: boolean; rules: Array<{ channel: RoutingChannel; userIds: string[] }> };
  firstResponseMinutes: number;
  hours: { enabled: boolean; timezone: string; days: DeskDay[] } | null;
  awayMessage: string | null;
}

/** The channels a rule or a saved view can name (the api's DESK_CHANNELS). */
export const ROUTING_CHANNELS = ["storefront", "whatsapp", "messenger", "instagram", "x"] as const;
export type RoutingChannel = (typeof ROUTING_CHANNELS)[number];
export const ROUTING_CHANNEL_LABEL: Record<RoutingChannel, string> = { storefront: "Storefront", whatsapp: "WhatsApp", messenger: "Messenger", instagram: "Instagram", x: "X" };

export interface AiPauseCopy {
  title: string;
  on: string;
  off: string;
  notEmergencyStop: string;
}

export interface DeskSettingsResponse {
  settings: DeskSettings;
  defaults: { awayMessage: string; opensToken: string };
  aiPauseCopy: AiPauseCopy;
}

// ── who may do what (the api's requireRole is the real gate; this decides what to show) ────────────────────────────

/** Assign, tag and note a conversation: the api's `requireRole("editor")`. A viewer sees all of it and changes none of it. */
export const canWorkConversation = canReply;

/** Tags themselves, the settings and the pause: the api's `requireRole("admin")`. */
export function canManageDesk(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** The pause switch is an admin's: it changes how every shopper is served. */
export const canPauseAssistant = canManageDesk;

// ── the list filters ────────────────────────────────────────────────────────────────────────────────────────────────

export type AssigneeFilter = "all" | "mine" | "unassigned" | "assigned";

export const ASSIGNEE_FILTERS: Array<{ value: AssigneeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "unassigned", label: "Unassigned" },
  { value: "assigned", label: "Assigned" },
];

/** The priority chip: every conversation, or only those a person flagged. */
export type PriorityFilter = "all" | "high";

export { deskListParams, assigneeFilterFromParam, priorityFilterFromParam, tagFromParam };

export interface DeskFilters {
  assignee: AssigneeFilter;
  tag: string | null;
  /** SA-10. Optional so a caller that predates it still means "every priority". */
  priority?: PriorityFilter;
}

/** The page's own query string with the filters written in (the other keys, such as `tab`, are kept). */
export function searchWithFilters(current: string, f: DeskFilters): string {
  const search = new URLSearchParams(current);
  search.delete("assignee");
  search.delete("tag");
  search.delete("priority");
  for (const [k, v] of Object.entries(deskListParams(f))) search.set(k, v);
  return search.toString();
}

// ── assignee and timer ──────────────────────────────────────────────────────────────────────────────────────────────

/** Up to two letters for the avatar badge. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]! : "";
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export function formatMinutes(total: number): string {
  const m = Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

export interface TimerView {
  label: string;
  tone: "ok" | "amber" | "red" | "paused";
  className: string;
}

const TIMER_CLASS: Record<TimerView["tone"], string> = {
  ok: "bg-muted text-muted-foreground",
  amber: "bg-warning/15 text-warning-on-tint",
  red: "bg-destructive/15 text-destructive-on-tint",
  paused: "bg-muted text-muted-foreground",
};

/** The words and colour for a first-reply timer; null when the conversation has none (not in Needs you). */
export function timerView(timer: ResponseTimer | null | undefined): TimerView | null {
  if (!timer) return null;
  if (timer.paused) return { label: "Paused until opening", tone: "paused", className: TIMER_CLASS.paused };
  const waited = formatMinutes(timer.elapsedMinutes);
  const target = formatMinutes(timer.targetMinutes);
  if (timer.state === "red") return { label: `Overdue: waiting ${waited} (target ${target})`, tone: "red", className: TIMER_CLASS.red };
  if (timer.state === "amber") return { label: `Reply soon: waiting ${waited} of ${target}`, tone: "amber", className: TIMER_CLASS.amber };
  return { label: `Waiting ${waited} of ${target}`, tone: "ok", className: TIMER_CLASS.ok };
}

/** A conversation's shopper rating, as the api returns it (Inbox CSAT, I3c). Absent/null = never asked. */
export interface ThreadCsat {
  score: number | null;
  resolvedBy: "ai" | "human";
  askedAt: string;
  answeredAt: string | null;
}

/** The words for the read-only rating badge in the thread header; null when the shopper was never asked. */
export function csatView(csat: ThreadCsat | null | undefined): { label: string; answered: boolean } | null {
  if (!csat) return null;
  const by = csat.resolvedBy === "human" ? "closed by your team" : "closed by the assistant";
  if (typeof csat.score === "number" && csat.score >= 1 && csat.score <= 5) return { label: `Rated ${csat.score}/5 · ${by}`, answered: true };
  return { label: `Rating asked, no answer yet · ${by}`, answered: false };
}

/** Optimistic assignee for a pick: "me", a teammate, or nobody. */
export function assigneeFor(pick: string | null, me: string | null, team: readonly TeamMemberRef[]): ThreadAssignee | null {
  if (pick === null) return null;
  const id = pick === "me" ? me : pick;
  if (!id) return null;
  const m = team.find((t) => t.userId === id);
  return { userId: id, name: m?.name ?? "Teammate" };
}

// ── notes ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The api sends this with the notes; this is the line a screen shows before they have loaded. */
export const NOTE_LABEL = "Note — only your team sees this";
export const NOTE_MAX = 2000;

export interface NoteDraft {
  canSave: boolean;
  remaining: number;
  /** Why not, in plain words; null when it can be saved or is simply empty. */
  error: string | null;
}

export function noteDraft(body: string, saving: boolean): NoteDraft {
  const trimmed = body.trim();
  const remaining = NOTE_MAX - body.length;
  if (remaining < 0) return { canSave: false, remaining, error: `A note can be up to ${NOTE_MAX} characters. This one is ${body.length}.` };
  return { canSave: trimmed.length > 0 && !saving, remaining, error: null };
}

/** Delete is the author's alone. */
export function canDeleteNote(note: Pick<DeskNote, "authorUserId">, me: string | null | undefined, role: string | null | undefined): boolean {
  return Boolean(me) && canWorkConversation(role) && note.authorUserId === me;
}

// ── tags ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const TAG_LIMIT = 30;
export const TAG_NAME_MAX = 30;
/** Per conversation (the api's bound on `PUT /threads/:id/tags`). */
export const TAGS_PER_THREAD_MAX = 10;

export function tagNameError(raw: string, existing: readonly DeskTag[], exceptId?: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return "Type a name for the tag.";
  if (name.length > TAG_NAME_MAX) return `A tag name is at most ${TAG_NAME_MAX} characters.`;
  if (existing.some((t) => t.id !== exceptId && t.name.toLowerCase() === name.toLowerCase())) return "You already have a tag with that name.";
  return null;
}

export function tagCountLine(count: number): string {
  return `${count} of ${TAG_LIMIT} tags used`;
}

export function toggleTag(current: readonly string[], tagId: string): string[] {
  return current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId];
}

// ── the settings form ───────────────────────────────────────────────────────────────────────────────────────────────

/** Monday first on screen; the api's `day` is 0 = Sunday. */
export const WEEK: Array<{ day: number; label: string }> = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];

export const DEFAULT_OPEN = "09:00";
export const DEFAULT_CLOSE = "18:00";
export const DEFAULT_FIRST_REPLY_MINUTES = 15;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const AWAY_MAX = 300;

export interface DeskFormDay {
  day: number;
  closed: boolean;
  open: string;
  close: string;
}

export const AUTO_CLOSE_DEFAULT_DAYS = 7;
export const AUTO_CLOSE_MAX_DAYS = 365;

export interface SmartTagRule {
  topic: string;
  tagId: string;
}
export interface RoutingRule {
  channel: RoutingChannel;
  userIds: string[];
}

export interface DeskForm {
  autoClose: boolean;
  autoCloseDays: string;
  smartTags: boolean;
  smartTagRules: SmartTagRule[];
  routing: boolean;
  routingRules: RoutingRule[];
  firstResponseMinutes: string;
  hoursEnabled: boolean;
  timezone: string;
  days: DeskFormDay[];
  awayMessage: string;
  autoAssign: boolean;
  availableUserIds: string[];
}

/** The form a saved setting opens as. `fallbackZone` is Settings > Preferences' timezone when the person has one. */
export function formFromSettings(s: DeskSettings, fallbackZone: string): DeskForm {
  const byDay = new Map((s.hours?.days ?? []).map((d) => [d.day, d] as const));
  const hasHours = Boolean(s.hours && s.hours.days.length > 0);
  return {
    // the three SA-10 blocks are off on an api that predates them
    autoClose: s.autoClose?.enabled === true,
    autoCloseDays: String(s.autoClose?.days ?? AUTO_CLOSE_DEFAULT_DAYS),
    smartTags: s.smartTags?.enabled === true,
    smartTagRules: (s.smartTags?.map ?? []).map((m) => ({ topic: m.topic, tagId: m.tagId })),
    routing: s.channelRouting?.enabled === true,
    routingRules: (s.channelRouting?.rules ?? []).map((r) => ({ channel: r.channel, userIds: [...r.userIds] })),
    firstResponseMinutes: String(s.firstResponseMinutes || DEFAULT_FIRST_REPLY_MINUTES),
    hoursEnabled: s.hours?.enabled === true,
    timezone: s.hours?.timezone || fallbackZone || "UTC",
    days: WEEK.map(({ day }) => {
      const d = byDay.get(day);
      // a business with no hours saved starts from a weekday 9-6 rather than seven closed days
      return d ? { day, closed: false, open: d.open, close: d.close } : { day, closed: hasHours || day === 0 || day === 6, open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
    }),
    // the saved text, or empty = "use the default line"
    awayMessage: s.awayMessage ?? "",
    autoAssign: s.autoAssign.enabled,
    availableUserIds: [...s.autoAssign.availableUserIds],
  };
}

/** The first thing wrong with the form, in the words the merchant should read; null = good to save. */
export function validateForm(f: DeskForm): string | null {
  const minutes = Number(f.firstResponseMinutes);
  if (f.firstResponseMinutes.trim() === "" || !Number.isInteger(minutes)) return "Enter the first-reply target as a whole number of minutes.";
  if (minutes < 1) return "The first-reply target is at least 1 minute.";
  if (minutes > 1440) return "The first-reply target is at most 24 hours (1440 minutes).";
  if (f.hoursEnabled) {
    if (!f.timezone) return "Pick the timezone your business hours are in.";
    const open = f.days.filter((d) => !d.closed);
    if (open.length === 0) return "Open at least one day, or turn business hours off.";
    for (const d of open) {
      const label = WEEK.find((w) => w.day === d.day)?.label ?? "A day";
      if (!TIME_RE.test(d.open) || !TIME_RE.test(d.close)) return `${label}: use a time such as 09:00.`;
      if (d.close <= d.open) return `${label}: closing time must be after opening time.`;
    }
  }
  if (f.awayMessage.length > AWAY_MAX) return `The away message is at most ${AWAY_MAX} characters.`;
  if (f.autoAssign && f.availableUserIds.length === 0) return "Choose at least one available teammate, or turn off taking turns.";
  const days = Number(f.autoCloseDays);
  if (f.autoClose && (f.autoCloseDays.trim() === "" || !Number.isInteger(days) || days < 1 || days > AUTO_CLOSE_MAX_DAYS)) return `Closing quiet conversations waits a whole number of days, from 1 to ${AUTO_CLOSE_MAX_DAYS}.`;
  if (f.smartTags) {
    const seen = new Set<string>();
    for (const r of f.smartTagRules) {
      if (!r.topic || !r.tagId) return "Pick a topic and a tag for every automatic tag, or remove the incomplete one.";
      if (seen.has(r.topic)) return "A topic can go to one tag only.";
      seen.add(r.topic);
    }
  }
  if (f.routing) {
    if (f.routingRules.length === 0) return "Add a channel and the people who take it, or turn off routing by channel.";
    const seen = new Set<string>();
    for (const r of f.routingRules) {
      if (r.userIds.length === 0) return `${ROUTING_CHANNEL_LABEL[r.channel]}: pick at least one teammate, or remove the channel.`;
      if (seen.has(r.channel)) return `${ROUTING_CHANNEL_LABEL[r.channel]} appears twice.`;
      seen.add(r.channel);
    }
  }
  return null;
}

/**
 * Keeps only teammates who can still take a conversation. ★A TEAMMATE WHO WAS REMOVED OR DEMOTED STAYS IN THE SAVED LIST, is not in
 * the checkbox list (so cannot be unticked), and the api refuses a save that names them. Dropping them here is what lets it through.
 */
export function pruneAvailable(f: DeskForm, team: readonly TeamMemberRef[]): DeskForm {
  const known = new Set(team.map((t) => t.userId));
  const kept = f.availableUserIds.filter((id) => known.has(id));
  // routing rules name people the same way: someone who left stays in the saved rule, the api refuses a save that names them, a rule left with nobody goes
  const rules = f.routingRules.map((r) => ({ ...r, userIds: r.userIds.filter((id) => known.has(id)) })).filter((r) => r.userIds.length > 0);
  const rulesSame = rules.length === f.routingRules.length && rules.every((r, i) => r.userIds.length === f.routingRules[i]!.userIds.length);
  if (kept.length === f.availableUserIds.length && rulesSame) return f;
  return { ...f, availableUserIds: kept, routingRules: rules };
}

/** The `PUT /inbox-desk/settings` body. "" for the away line puts the default back. */
export function patchFromForm(f: DeskForm) {
  return {
    firstResponseMinutes: Number(f.firstResponseMinutes),
    autoAssign: { enabled: f.autoAssign, availableUserIds: f.availableUserIds },
    hours: {
      enabled: f.hoursEnabled,
      timezone: f.timezone,
      // ★ONLY DAYS THE API WOULD ACCEPT: with hours switched off nothing checked the times, and a half-edited day must not make the save fail
      days: f.days.filter((d) => !d.closed && TIME_RE.test(d.open) && TIME_RE.test(d.close) && d.close > d.open).map((d) => ({ day: d.day, open: d.open, close: d.close })),
    },
    awayMessage: f.awayMessage.trim(),
    autoClose: { enabled: f.autoClose, days: Number.isInteger(Number(f.autoCloseDays)) && Number(f.autoCloseDays) >= 1 && Number(f.autoCloseDays) <= AUTO_CLOSE_MAX_DAYS ? Number(f.autoCloseDays) : AUTO_CLOSE_DEFAULT_DAYS },
    // ★ONLY COMPLETE RULES, so a half-edited row with the feature off cannot make the save fail
    smartTags: { enabled: f.smartTags, map: dedupeBy(f.smartTagRules.filter((r) => r.topic && r.tagId), (r) => r.topic) },
    channelRouting: { enabled: f.routing, rules: dedupeBy(f.routingRules.filter((r) => r.userIds.length > 0), (r) => r.channel) },
  };
}

function dedupeBy<T>(list: readonly T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((t) => (seen.has(key(t)) ? false : (seen.add(key(t)), true)));
}

/** What a shopper would read: the away line with `{opens}` filled in. */
export function awayPreview(message: string, defaultLine: string, token: string, example = "9:00 am tomorrow"): string {
  const line = message.trim() || defaultLine;
  return line.split(token).join(example);
}

export function toggleAvailable(current: readonly string[], userId: string): string[] {
  return current.includes(userId) ? current.filter((u) => u !== userId) : [...current, userId];
}

// ── double clicks ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One guard per control: `run(fn)` does nothing while an earlier `fn` is still in flight. ★A FLAG HELD HERE, NOT `isPending`: a mutation's
 * pending state reaches the screen on the next render, so two clicks in one tick would both pass a check of it.
 */
export function createFlightGuard(): { run: (fn: () => Promise<unknown>) => Promise<void>; readonly busy: boolean } {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    async run(fn) {
      if (busy) return;
      busy = true;
      try {
        await fn();
      } finally {
        busy = false;
      }
    },
  };
}

// ── the timeline ────────────────────────────────────────────────────────────────────────────────────────────────────

export type TimelineItem<M extends { timestamp: string | null }> =
  | { kind: "message"; timestamp: string | null; line: M }
  | { kind: "note"; timestamp: string; note: DeskNote };

const ms = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Messages and notes in one timeline, by time. ★MESSAGES KEEP THEIR OWN ORDER (a message with no time stays where it is); each note is
 * placed before the first message that came after it, so a note written between two messages sits between them, and the notes the
 * team wrote last come last.
 */
export function timelineOf<M extends { timestamp: string | null }>(messages: readonly M[], notes: readonly DeskNote[]): Array<TimelineItem<M>> {
  const pending = [...notes].sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
  const out: Array<TimelineItem<M>> = [];
  let next = 0;
  for (const line of messages) {
    const t = ms(line.timestamp);
    while (t && next < pending.length && ms(pending[next]!.createdAt) < t) {
      const note = pending[next++]!;
      out.push({ kind: "note", timestamp: note.createdAt, note });
    }
    out.push({ kind: "message", timestamp: line.timestamp, line });
  }
  while (next < pending.length) {
    const note = pending[next++]!;
    out.push({ kind: "note", timestamp: note.createdAt, note });
  }
  return out;
}

// ── who is viewing (SA-10) ──────────────────────────────────────────────────────────────────────────────────────────

/** How often an open conversation pings (the api also sends it). The api treats a ping older than a minute as gone. */
export const PING_EVERY_MS = 20_000;

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/**
 * "Asha is viewing", "Asha and Ravi are viewing", "Ravi is replying". ★NEVER YOURSELF: the person looking at the screen is not told they
 * are viewing it. Null when nobody else is there. Typing outranks looking, so a person who is replying is named as replying only.
 */
export function viewersLine(viewers: readonly Viewer[] | null | undefined, me?: string | null): string | null {
  const others = (viewers ?? []).filter((v) => v.userId !== me);
  const replying = others.filter((v) => v.replying).map((v) => v.name);
  const viewing = others.filter((v) => !v.replying).map((v) => v.name);
  const parts: string[] = [];
  if (replying.length > 0) parts.push(`${joinNames(replying)} ${replying.length > 1 ? "are" : "is"} replying`);
  if (viewing.length > 0) parts.push(`${joinNames(viewing)} ${viewing.length > 1 ? "are" : "is"} viewing`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// ── @mentions in notes (SA-10) ──────────────────────────────────────────────────────────────────────────────────────

/** Add `@Name ` to the draft, on a word of its own. */
export function insertMention(body: string, member: Pick<TeamMemberRef, "name">): string {
  const sep = body.length === 0 || /\s$/.test(body) ? "" : " ";
  return `${body}${sep}@${member.name} `;
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The ids to send: the people picked whose `@Name` is still in the text. ★A mention the writer then deleted from the note is not sent, so a
 * teammate is never emailed about a name that is no longer there. Names are matched whole (`@Ravi` is not `@Ravindra`).
 */
export function mentionsIn(body: string, picked: readonly Pick<TeamMemberRef, "userId" | "name">[]): string[] {
  const out: string[] = [];
  for (const m of picked) {
    if (new RegExp(`(?<![\\p{L}\\p{N}_])@${escapeRegExp(m.name)}(?![\\p{L}\\p{N}_])`, "u").test(body) && !out.includes(m.userId)) out.push(m.userId);
  }
  return out;
}

/** How a note shows who it mentions (names from the team list; a person who has left is skipped). */
export function mentionNames(note: Pick<DeskNote, "mentions">, team: readonly TeamMemberRef[]): string[] {
  return (note.mentions ?? []).map((id) => team.find((t) => t.userId === id)?.name).filter((n): n is string => Boolean(n));
}

// ── saved views (SA-10) ─────────────────────────────────────────────────────────────────────────────────────────────

export const VIEWS_MAX = 20;
export const VIEW_NAME_MAX = 40;

/** What a view keeps: the list's own filters. ★Search text is not one: it can be a customer's name, and a view is shared with the team. */
export interface SavedViewFilters {
  status?: "open" | "needs_you" | "waiting" | "done";
  assignee?: string;
  tag?: string;
  topic?: string;
  priority?: "high";
  channel?: RoutingChannel;
}

export interface SavedView {
  id: string;
  name: string;
  filters: SavedViewFilters;
  createdAt: string;
}

/** The filters the page is showing, as the page holds them. */
export interface PageFilters {
  status: "open" | "needs_you" | "waiting" | "done";
  assignee: AssigneeFilter;
  tag: string | null;
  topic: string | null;
  priority: PriorityFilter;
  /** "all" or one channel. */
  channel: string;
}

/** The view that would reproduce the page: only what narrows it, with the status chip always (so a view always has one filter). */
export function viewFiltersOfPage(p: PageFilters): SavedViewFilters {
  return {
    status: p.status,
    ...(p.assignee !== "all" ? { assignee: p.assignee } : {}),
    ...(p.tag ? { tag: p.tag } : {}),
    ...(p.topic ? { topic: p.topic } : {}),
    ...(p.priority === "high" ? { priority: "high" as const } : {}),
    ...((ROUTING_CHANNELS as readonly string[]).includes(p.channel) ? { channel: p.channel as RoutingChannel } : {}),
  };
}

/** The page a view opens: every filter it does not name goes back to "all". ★Opening a view REPLACES the filters, never adds to them. */
export function pageOfView(v: SavedViewFilters): PageFilters {
  return {
    status: v.status ?? "open",
    assignee: v.assignee === "mine" || v.assignee === "unassigned" || v.assignee === "assigned" ? v.assignee : "all",
    tag: v.tag ?? null,
    topic: v.topic ?? null,
    priority: v.priority === "high" ? "high" : "all",
    channel: v.channel ?? "all",
  };
}

/** Whether the page can show this view as saved. A view for one named teammate (made through the api) cannot be drawn as a chip, so it is not opened as something broader. */
export function viewOpensAsSaved(v: SavedViewFilters): boolean {
  return v.assignee === undefined || v.assignee === "mine" || v.assignee === "unassigned" || v.assignee === "assigned";
}

/** Whether the page is showing exactly this view (so the picker can say which one is on). ★Never a view the page cannot open as saved. */
export function isViewActive(v: SavedView, p: PageFilters): boolean {
  if (!viewOpensAsSaved(v.filters)) return false;
  const a = pageOfView(v.filters);
  return a.status === p.status && a.assignee === p.assignee && a.tag === p.tag && a.topic === p.topic && a.priority === p.priority && a.channel === p.channel;
}

/** Why a name cannot be saved, in plain words; null when it can. */
export function viewNameError(raw: string, existing: readonly Pick<SavedView, "name">[]): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return "Give the view a name.";
  if ([...name].length > VIEW_NAME_MAX) return `A view name can be up to ${VIEW_NAME_MAX} characters.`;
  if (existing.some((v) => v.name.toLowerCase() === name.toLowerCase())) return "You already have a view with that name.";
  if (existing.length >= VIEWS_MAX) return `You can keep up to ${VIEWS_MAX} views. Delete one to add another.`;
  return null;
}

/** Plain words for what a view narrows to, for its tooltip: "Open, Unassigned, High priority". */
export function viewSummary(v: SavedViewFilters, tags: readonly DeskTag[] | undefined): string {
  const parts: string[] = [];
  if (v.status) parts.push(({ open: "Open", needs_you: "Needs you", waiting: "Waiting", done: "Done" } as const)[v.status]);
  if (v.assignee === "mine") parts.push("Mine");
  else if (v.assignee === "unassigned") parts.push("Unassigned");
  else if (v.assignee === "assigned") parts.push("Assigned");
  if (v.tag) parts.push(tags?.find((t) => t.id === v.tag)?.name ?? "A removed tag");
  if (v.topic) parts.push("An Insights topic");
  if (v.priority === "high") parts.push("High priority");
  if (v.channel) parts.push(ROUTING_CHANNEL_LABEL[v.channel]);
  return parts.join(", ");
}
