/**
 * Posts, services, details and links on the Presence page (PE-12): what to draw, what each state says, what a person may press, and the values
 * a form sends. PURE - no React, no fetch.
 *
 * ★A PANEL IS DRAWN FROM THE NETWORK'S DECLARATION. `GET /v1/presence/changes/capabilities` says, per network, which of the four panels it offers
 * (`panels`); a network that does not declare one draws NOTHING, not a disabled control. The kinds of post, the buttons, the longest post, the
 * kinds of link and every choice in a list arrive from the api (`/v1/presence/extras/*`), and the network's name in a sentence is the api's label.
 * Nothing in this file spells a network.
 * ★EVERY SUBMIT PREPARES A CHANGE. Nothing is sent until an admin approves it, and "live" is a word only the api's `live` status earns.
 * ★LISTS ARE WHOLE. A services, details or links change is the complete list the network should hold, built from what the network holds now, so an
 * entry the person did not touch is kept exactly as read, price and description included. The page sends the BASE of the list it was drawn from
 * (`base` in the api's answer); the api compares it with a fresh read and refuses a change built on a list that has since changed (code
 * `LIST_CHANGED`), and the panel then reloads and says so, so a stale page cannot delete something added on the network after it was opened.
 * ★ONLY WHAT THE PERSON ADDED OR CHANGED IS JUDGED. What the network already holds passes whatever its address scheme or kind, so a list sent whole
 * never fails or blocks on something the person did not do.
 */

import type { CapabilitiesResponse, ChangeCardData, NetworkCapability } from "@/lib/presence-edit";
import type { PhotoAccess } from "@/lib/presence-photos";

// ── The four panels ──────────────────────────────────────────────────────────

export const EXTRA_FIELDS = ["posts", "services", "attributes", "links"] as const;
export type ExtraField = (typeof EXTRA_FIELDS)[number];

/** Whether a network's declaration offers a panel. An older api that sends no `panels` offers none. */
export function drawsPanel(cap: Pick<NetworkCapability, "panels"> | undefined, field: ExtraField): boolean {
  return cap?.panels?.[field] === true;
}

/** The fields whose changes are listed by their own panel, so the edit card does not list them a second time. */
export function drawnExtraFields(cap: Pick<NetworkCapability, "panels"> | undefined): ExtraField[] {
  return EXTRA_FIELDS.filter((f) => drawsPanel(cap, f));
}

export function capabilityOf(caps: CapabilitiesResponse | undefined, network: string | undefined): NetworkCapability | undefined {
  return caps && network ? caps.items.find((c) => c.network === network) : undefined;
}

export const PANEL_TITLES: Record<ExtraField, string> = { posts: "Post", services: "Services", attributes: "Details", links: "Links" };

// ── Shapes the api returns (only what is drawn) ──────────────────────────────

export type PostKind = "update" | "event" | "offer";
export interface PostItem {
  ref: string;
  kind: PostKind;
  summary: string;
  state: "live" | "processing" | "rejected" | "unknown";
  languageCode: string | null;
  action: { type: string; url?: string } | null;
  event: { title: string; start: string; end?: string; startTime?: string; endTime?: string } | null;
  offer: { code?: string; redeemUrl?: string; terms?: string } | null;
  createdAt: string | null;
  updatedAt: string | null;
  url: string | null;
  hasPhoto: boolean;
}
export interface PostsDeclaration {
  kinds: PostKind[];
  actions: string[];
  actionWithoutUrl: string | null;
  limits: { summaryMaxLength: number };
  edit: boolean;
  removal: { restorable: boolean };
}
export interface PostsResponse {
  network: string;
  label: string;
  declaration: PostsDeclaration;
  writes: { released: boolean; notice: string | null };
  /** False when the network had more posts than were read. */
  complete: boolean;
  items: PostItem[];
}

export type ServiceEntry =
  | { kind: "listed"; id: string; description?: string; price?: { currencyCode: string; units: string; nanos?: number } }
  | { kind: "custom"; categoryId: string; name: string; description?: string; languageCode?: string; price?: { currencyCode: string; units: string; nanos?: number } };
export interface ServiceOption {
  id: string;
  label: string;
}
export interface ServicesResponse {
  network: string;
  label: string;
  current: ServiceEntry[];
  /** Null when the network's list could not be read: `optionsNotice` says so. */
  options: ServiceOption[] | null;
  optionsNotice: string | null;
  /** The network's reference to the business's main category: a service the person names is filed under it. Null when it has none. */
  categoryRef: string | null;
  /** The list as it is drawn: sent back with a change so the api can refuse a change built on an old copy. */
  base: string;
  writes: { released: boolean; notice: string | null };
}

export type AttributeEntry =
  | { id: string; kind: "yesno"; value: boolean }
  // a repeatable detail holds several values: every one is kept
  | { id: string; kind: "choice"; values: string[] }
  | { id: string; kind: "link"; values: string[] }
  | { id: string; kind: "choices"; set: string[]; unset: string[] };
export interface AttributeOption {
  id: string;
  label: string;
  group?: string;
  kind: AttributeEntry["kind"];
  values: Array<{ value: string; label: string }>;
  deprecated: boolean;
}
export interface AttributesResponse {
  network: string;
  label: string;
  current: AttributeEntry[];
  options: AttributeOption[] | null;
  optionsNotice: string | null;
  base: string;
  writes: { released: boolean; notice: string | null };
}

export interface ActionLink {
  type: string;
  uri: string;
  preferred?: boolean;
}
export interface LinksResponse {
  network: string;
  label: string;
  types: Array<{ type: string; label: string }>;
  /** Which kind of link fills the booking address and which the order address on the listing, with the words to show. */
  canonical?: { booking: { type: string; label: string } | null; order: { type: string; label: string } | null };
  current: ActionLink[];
  base: string;
  writes: { released: boolean; notice: string | null };
}

// ── States ───────────────────────────────────────────────────────────────────

/**
 * What this person can do. The panel is drawn only once the capabilities have answered (a read that failed or is paused draws nothing, and the edit
 * card states that failure), so only an answer that says no says the role cannot.
 */
export function extrasAccess(can: { propose: boolean } | undefined, what: string): PhotoAccess {
  // The capabilities answered but did not say what this role can do (an older api): that is not the role's doing, and nothing can be changed.
  if (!can) return { mode: "view", why: `We could not check what your role can do, so ${what} cannot be changed from here right now. Reload the page to try again.` };
  return can.propose ? { mode: "edit" } : { mode: "view", why: `Your role can look at your ${what} but not change them. Ask an editor, admin or owner.` };
}

/** A role that may edit is still held until the change list, which says what is waiting, has answered. */
export function withChangesKnown(access: PhotoAccess, changes: "loading" | "paused" | "failed" | "data" | "data_stale", what: string): PhotoAccess {
  if (access.mode !== "edit") return access;
  if (changes === "data" || changes === "data_stale") return access;
  if (changes === "failed") return { mode: "view", why: `We could not load your ${what} changes, so changing them is off until they load. Try again.` };
  return { mode: "view", why: `Checking your waiting ${what} changes...` };
}

// ── A draft remembers the list it started from ───────────────────────────────

/** A draft of a whole list and the `base` of the list it was started from. The base is captured when the draft STARTS and never changes under it. */
export interface BasedDraft<T> {
  value: T;
  base: string;
}

/** The draft to keep given the list's base now: a draft started from another list is DROPPED (never silently re-based onto a list the person did not see). */
export function liveDraft<T>(d: BasedDraft<T> | null, baseNow: string): { draft: BasedDraft<T> | null; dropped: boolean } {
  if (!d) return { draft: null, dropped: false };
  return d.base === baseNow ? { draft: d, dropped: false } : { draft: null, dropped: true };
}

/** A new value for a draft. The first edit captures `baseNow`; later edits keep the base the draft started from. */
export function nextDraft<T>(prev: BasedDraft<T> | null, value: T, baseNow: string): BasedDraft<T> {
  return { value, base: prev?.base ?? baseNow };
}

export const draftDroppedWords = (label: string, what: string): string =>
  `Your ${what} changed on ${label} while you were editing, so your draft was dropped. Make the change again from what is there now.`;

// ── The change list of one panel ─────────────────────────────────────────────

const OPEN = ["proposed", "validated", "approved", "applying"];
const IN_FLIGHT = [...OPEN, "submitted"];

/** The changes of one field for one network, newest first as the api sends them. */
export function fieldChanges(items: readonly ChangeCardData[] | undefined, network: string, field: ExtraField): ChangeCardData[] {
  return (items ?? []).filter((c) => c.field === field && c.network === network);
}

export function inFlightChanges(items: readonly ChangeCardData[] | undefined, network: string, field: ExtraField): ChangeCardData[] {
  return fieldChanges(items, network, field).filter((c) => IN_FLIGHT.includes(c.status));
}

/** EVERY change that has not settled, and only the most recent `settledCap` of the history. Capping must never hide a change somebody can act on. */
export function listedChanges(items: readonly ChangeCardData[] | undefined, network: string, field: ExtraField, settledCap: number): ChangeCardData[] {
  const all = fieldChanges(items, network, field);
  const settled = all.filter((c) => !IN_FLIGHT.includes(c.status)).slice(0, settledCap);
  const keep = new Set([...all.filter((c) => IN_FLIGHT.includes(c.status)), ...settled].map((c) => c.id));
  return all.filter((c) => keep.has(c.id));
}

/** Whether a change of this field has just LEFT the in-flight statuses, so what the panel reads is stale. `before` is the ids in flight at the last look. */
export function settledSince(before: ReadonlySet<string>, items: readonly ChangeCardData[] | undefined, network: string, field: ExtraField): boolean {
  const flying = new Set(inFlightChanges(items, network, field).map((c) => c.id));
  for (const id of before) if (!flying.has(id)) return true;
  return false;
}

/** The change about one existing post that has not settled: the ONE source of what is waiting. */
export function pendingForPost(items: readonly ChangeCardData[] | undefined, network: string, ref: string): ChangeCardData | undefined {
  return inFlightChanges(items, network, "posts").find((c) => (c.after as { ref?: string } | null)?.ref === ref && (c.after as { op?: string } | null)?.op !== "create");
}

/** What a prepared change says next: an admin approves, so anyone else is told who. */
export function preparedWords(can: { approve: boolean } | undefined, label: string, checked: boolean): string {
  const head = checked ? "Your change is prepared and checked." : `Your change is prepared, but ${label} could not check it just now.`;
  return `${head} ${can?.approve ? "Review it below, then approve it." : "It is waiting below for an admin or owner to approve."}`;
}

/** The line shown while a change of this panel is waiting. */
export function waitingWords(what: string, can: { approve: boolean } | undefined): string {
  return can?.approve
    ? `A change to your ${what} is waiting below. Approve or decline it before making another.`
    : `A change to your ${what} is waiting below for an admin or owner to approve or decline. Nothing else can be changed until then.`;
}

/** The message shown when the api refuses a change built on a list that has since changed. */
export const LIST_CHANGED_CODE = "LIST_CHANGED";
export function isListChanged(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === LIST_CHANGED_CODE;
}

export function pendingNote(status: string, can: { approve: boolean } | undefined): string {
  if (status === "submitted") return "A change was sent. Waiting for it to show.";
  if (status === "approved") return "Approved, waiting to be sent.";
  if (status === "applying") return "Being sent now.";
  return can?.approve ? "A change is waiting below. Approve or decline it there." : "A change is waiting below for an admin or owner to approve.";
}

// ── Posts ────────────────────────────────────────────────────────────────────

export const KIND_LABEL: Record<PostKind, string> = { update: "Update", event: "Event", offer: "Offer" };

/** What a post's state says. "May": the network does not say how long it takes. */
export function postStateWords(state: PostItem["state"], label: string): { text: string; tone: "good" | "neutral" | "bad" } {
  if (state === "live") return { text: `Showing on ${label}`, tone: "good" };
  if (state === "processing") return { text: `${label} is still processing this post. It may not show yet.`, tone: "neutral" };
  if (state === "rejected") return { text: `${label} did not publish this post.`, tone: "bad" };
  return { text: `${label} did not say whether this post is showing.`, tone: "neutral" };
}

/** "LEARN_MORE" -> "Learn more". The network's own name for a button, made readable. */
export function humanize(id: string): string {
  const tail = id.split(/[/:]/).filter(Boolean).pop() ?? id;
  const s = tail.replace(/[_-]+/g, " ").trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : id;
}
export const actionLabel = humanize;

export interface PostDraft {
  kind: PostKind;
  /** Carried through an edit untouched: the network may have filled it in, and an edit must not clear it. */
  languageCode: string;
  startTime: string;
  endTime: string;
  summary: string;
  actionType: string;
  actionUrl: string;
  eventTitle: string;
  start: string;
  end: string;
  offerCode: string;
  redeemUrl: string;
  terms: string;
}

export const emptyPostDraft = (kind: PostKind = "update"): PostDraft => ({ kind, languageCode: "", startTime: "", endTime: "", summary: "", actionType: "", actionUrl: "", eventTitle: "", start: "", end: "", offerCode: "", redeemUrl: "", terms: "" });

export function postDraftOf(p: PostItem): PostDraft {
  return {
    kind: p.kind,
    languageCode: p.languageCode ?? "",
    startTime: p.event?.startTime ?? "",
    endTime: p.event?.endTime ?? "",
    summary: p.summary,
    actionType: p.action?.type ?? "",
    actionUrl: p.action?.url ?? "",
    eventTitle: p.event?.title ?? "",
    start: p.event?.start ?? "",
    end: p.event?.end ?? "",
    offerCode: p.offer?.code ?? "",
    redeemUrl: p.offer?.redeemUrl ?? "",
    terms: p.offer?.terms ?? "",
  };
}

const HTTPS = /^https:\/\/\S+$/i;
/** `HH:MM`; `24:00` is the end of the day. */
const HHMM = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;
export const isTime = (v: string): boolean => HHMM.test(v);
const WEB = /^https?:\/\/\S+$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function isDay(v: string): boolean {
  if (!DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type Built<T> = { ok: true; value: T } | { ok: false; message: string };

/** What an edited post holds now: only what the person changes is judged, so anything left as it is passes whatever the network offers today. */
export type HeldPost = Partial<Pick<PostItem, "kind" | "summary" | "action" | "event" | "offer">>;

const trimmed = (d: PostDraft) => ({ ...d, summary: d.summary.trim(), actionType: d.actionType.trim().toUpperCase(), actionUrl: d.actionUrl.trim(), eventTitle: d.eventTitle.trim(), start: d.start.trim(), end: d.end.trim(), startTime: d.startTime.trim(), endTime: d.endTime.trim(), offerCode: d.offerCode.trim(), redeemUrl: d.redeemUrl.trim(), terms: d.terms.trim(), languageCode: d.languageCode.trim() });

/** Whether an edit changes nothing: the form refuses it rather than prepare a change that says what the post already says. */
export function postDraftUnchanged(initial: PostDraft, now: PostDraft): boolean {
  return JSON.stringify(trimmed(initial)) === JSON.stringify(trimmed(now));
}

/** A fresh id for a new post, made once when the form opens: sent with the post so a double click or a retry is the same post, not two. */
export function newDraftId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type PostValue =
  | ({ op: "create"; draftId: string } & PostContentValue)
  | ({ op: "update"; ref: string } & PostContentValue)
  | { op: "delete"; ref: string };
export interface PostContentValue {
  kind: PostKind;
  summary: string;
  languageCode?: string;
  action?: { type: string; url?: string };
  event?: { title: string; start: string; end?: string; startTime?: string; endTime?: string };
  offer?: { code?: string; redeemUrl?: string; terms?: string };
}

/** How many characters are left. Negative is over the network's limit. */
export const charsLeft = (summary: string, max: number): number => max - summary.trim().length;

/**
 * The value a post form sends, or the plain reason it cannot. These are the api's rules (it checks again, and says the same): the declared kinds
 * and buttons, the longest post (never shortened for you), https addresses, and a title and dates for an event or an offer.
 */
export function buildPostValue(
  draft: PostDraft,
  decl: PostsDeclaration,
  op: { op: "create"; draftId: string } | { op: "update"; ref: string },
  /** What the post holds now, when it is being edited. Anything the person leaves as it is passes: a button the network no longer offers, a redeem link, an empty summary, an event without times. */
  held?: HeldPost | null,
): Built<PostValue> {
  const summary = draft.summary.trim();
  const summaryChanged = held?.summary === undefined || summary !== held.summary.trim();
  if (!summary && summaryChanged) return { ok: false, message: "Write what you want to say." };
  if (summaryChanged && summary.length > decl.limits.summaryMaxLength) {
    return { ok: false, message: `Use at most ${decl.limits.summaryMaxLength} characters. This one is ${summary.length}, and it is not shortened for you.` };
  }
  if (!(held?.kind === draft.kind) && !decl.kinds.includes(draft.kind)) return { ok: false, message: "That kind of post is not offered." };
  const value: PostContentValue = { kind: draft.kind, summary, ...(draft.languageCode.trim() ? { languageCode: draft.languageCode.trim() } : {}) };

  const type = draft.actionType.trim().toUpperCase();
  const heldButton = held?.action ?? null;
  const keptButton = !!heldButton && heldButton.type.toUpperCase() === type && (heldButton.url ?? "") === draft.actionUrl.trim();
  if (type && keptButton) {
    // Left as it is: not judged again (an edit must not fail on a button the person did not touch).
    value.action = { type: heldButton!.type, ...(heldButton!.url ? { url: heldButton!.url } : {}) };
  } else if (type) {
    if (!decl.actions.includes(type)) return { ok: false, message: "That button is not offered." };
    if (type === decl.actionWithoutUrl) {
      // This button calls the listing's number: a web address with it is a mistake, said rather than quietly dropped.
      if (draft.actionUrl.trim()) return { ok: false, message: "That button calls your listing's phone number, so it takes no web address." };
      value.action = { type };
    } else {
      const url = draft.actionUrl.trim();
      if (!url) return { ok: false, message: "That button needs a web address." };
      if (!HTTPS.test(url)) return { ok: false, message: "The button's web address must start with https://." };
      value.action = { type, url };
    }
  } else if (draft.actionUrl.trim()) {
    return { ok: false, message: "Choose a button for that web address, or clear it." };
  }

  if (draft.kind === "event" || draft.kind === "offer") {
    const title = draft.eventTitle.trim();
    const start = draft.start.trim();
    const end = draft.end.trim();
    const startTime = draft.startTime.trim();
    const endTime = draft.endTime.trim();
    const he = held?.kind === draft.kind ? held.event : null;
    const kept = !!he && he.title === title && he.start === start && (he.end ?? "") === end && (he.startTime ?? "") === startTime && (he.endTime ?? "") === endTime;
    if (!kept) {
      // A new event or offer (or one whose event was changed) carries a title, both dates and both times: the network's schedule is not valid without all four.
      if (!title) return { ok: false, message: `${draft.kind === "offer" ? "An offer" : "An event"} needs a title.` };
      if (!isDay(start)) return { ok: false, message: "Choose a start date." };
      if (!isDay(end)) return { ok: false, message: "Choose a real end date." };
      if (end < start) return { ok: false, message: "The end date is before the start date." };
      if (!isTime(startTime)) return { ok: false, message: "Enter the start time as HH:MM, for example 18:30." };
      if (!isTime(endTime)) return { ok: false, message: "Enter the end time as HH:MM, for example 21:00 (24:00 is the end of the day)." };
    }
    value.event = { title, start, ...(end ? { end } : {}), ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}) };
  }
  if (draft.kind === "offer") {
    const code = draft.offerCode.trim();
    const redeemUrl = draft.redeemUrl.trim();
    const terms = draft.terms.trim();
    // A redeem link is judged only when the person changed it.
    if (redeemUrl && redeemUrl !== (held?.offer?.redeemUrl ?? "") && !HTTPS.test(redeemUrl)) return { ok: false, message: "The redeem link must start with https://." };
    if (code || redeemUrl || terms) value.offer = { ...(code ? { code } : {}), ...(redeemUrl ? { redeemUrl } : {}), ...(terms ? { terms } : {}) };
  }
  return { ok: true, value: { ...op, ...value } as PostValue };
}

/** The note beside a delete, said BEFORE approval, from the declaration. */
export function deleteNote(decl: Pick<PostsDeclaration, "removal">, label: string): string {
  return decl.removal.restorable
    ? `The post will be removed from ${label}.`
    : `The post will be removed from ${label}, and Peakhour cannot bring it back. You can post it again as a new post.`;
}

/** Whether an edit or a delete is offered for a post: a role that may edit, nothing already waiting on that post, and (for an edit) a network that lets posts be edited. */
export function postControls(access: PhotoAccess, decl: Pick<PostsDeclaration, "edit">, pending: ChangeCardData | undefined): { edit: boolean; remove: boolean } {
  if (access.mode !== "edit" || pending) return { edit: false, remove: false };
  return { edit: decl.edit, remove: true };
}

// ── Services ─────────────────────────────────────────────────────────────────

export const serviceKey = (e: ServiceEntry): string => (e.kind === "listed" ? `listed:${e.id}` : `custom:${e.categoryId}:${e.name.trim().toLowerCase()}`);

export function serviceLabel(e: ServiceEntry, options: ServiceOption[] | null): string {
  if (e.kind === "custom") return e.name;
  return options?.find((o) => o.id === e.id)?.label ?? humanize(e.id);
}

/** The network's services the business does not hold yet. */
export function addableServices(current: readonly ServiceEntry[], options: ServiceOption[] | null): ServiceOption[] {
  const held = new Set(current.flatMap((s) => (s.kind === "listed" ? [s.id] : [])));
  return (options ?? []).filter((o) => !held.has(o.id));
}

/**
 * The list with one network service added. Every entry already there is kept exactly as read. A service the network held and the person removed in
 * this draft comes back from `held` (what the network holds, price and description included), not as a bare one.
 */
export function withService(current: readonly ServiceEntry[], id: string, held: readonly ServiceEntry[] = []): ServiceEntry[] {
  if (current.some((s) => s.kind === "listed" && s.id === id)) return [...current];
  const back = held.find((s) => s.kind === "listed" && s.id === id);
  return [...current, back ?? { kind: "listed", id }];
}

/** The list with a service the person names added, filed under the network's category for the business. Nothing is added without a category or a name. */
export function withCustomService(current: readonly ServiceEntry[], categoryRef: string | null, name: string, held: readonly ServiceEntry[] = []): Built<ServiceEntry[]> {
  const n = name.trim();
  if (!categoryRef) return { ok: false, message: "We cannot file a service of your own until your main category is set." };
  if (!n) return { ok: false, message: "Write the name of the service." };
  if (n.length > 140) return { ok: false, message: "Use at most 140 characters for a service name." };
  const fresh: ServiceEntry = { kind: "custom", categoryId: categoryRef, name: n };
  if (current.some((s) => serviceKey(s) === serviceKey(fresh))) return { ok: false, message: "That service is already on the list." };
  // A service of the person's own that the network held and they removed in this draft comes back as it was (description and price included).
  const back = held.find((s) => s.kind === "custom" && serviceKey(s) === serviceKey(fresh));
  return { ok: true, value: [...current, back ?? fresh] };
}

/** The list without one entry. The others are kept exactly as read (price and description included). */
export function withoutService(current: readonly ServiceEntry[], key: string): ServiceEntry[] {
  return current.filter((s) => serviceKey(s) !== key);
}

/** The list a services form sends, or why nothing can be sent: an unchanged list is no change. */
export function servicesValue(before: readonly ServiceEntry[], after: readonly ServiceEntry[]): Built<ServiceEntry[]> {
  const a = [...before.map(serviceKey)].sort().join("|");
  const b = [...after.map(serviceKey)].sort().join("|");
  if (a === b) return { ok: false, message: "Add or remove a service first." };
  return { ok: true, value: [...after] };
}

// ── Details ──────────────────────────────────────────────────────────────────

/** The details the network offers that a person may set: a deprecated one is accepted by the network and not saved, so it is never offered. */
export function offeredDetails(options: AttributeOption[] | null): AttributeOption[] {
  return (options ?? []).filter((o) => !o.deprecated);
}

export const detailLabel = (id: string, options: AttributeOption[] | null): string => options?.find((o) => o.id === id)?.label ?? humanize(id);

/** The list with one detail set (replacing any earlier entry for it). The other entries are kept exactly as read. */
export function withDetail(current: readonly AttributeEntry[], entry: AttributeEntry): AttributeEntry[] {
  const at = current.findIndex((a) => a.id === entry.id);
  return at < 0 ? [...current, entry] : current.map((a, i) => (i === at ? entry : a));
}

/** CLEARING A DETAIL REMOVES IT FROM THE LIST: the api sends the whole list, and a detail that is not in it is removed. */
export function withoutDetail(current: readonly AttributeEntry[], id: string): AttributeEntry[] {
  return current.filter((a) => a.id !== id);
}

/** One value of a several-choice detail: on, off, or not said. The other values are kept. */
export function withChoice(current: readonly AttributeEntry[], id: string, value: string, state: "set" | "unset" | "unknown"): AttributeEntry[] {
  const now = current.find((a) => a.id === id);
  const prev = now && now.kind === "choices" ? now : { id, kind: "choices" as const, set: [], unset: [] };
  const set = prev.set.filter((v) => v !== value);
  const unset = prev.unset.filter((v) => v !== value);
  if (state === "set") set.push(value);
  if (state === "unset") unset.push(value);
  // nothing said about any value: the detail is removed, not sent empty
  return set.length + unset.length === 0 ? withoutDetail(current, id) : withDetail(current, { id, kind: "choices", set, unset });
}

const entryKey = (e: AttributeEntry): string => JSON.stringify(e.kind === "choices" ? { ...e, set: [...e.set].sort(), unset: [...e.unset].sort() } : e);

export function detailsValue(before: readonly AttributeEntry[], after: readonly AttributeEntry[]): Built<AttributeEntry[]> {
  const norm = (l: readonly AttributeEntry[]) => JSON.stringify([...l].sort((x, y) => (x.id < y.id ? -1 : 1)).map(entryKey));
  if (norm(before) === norm(after)) return { ok: false, message: "Change a detail first." };
  // Only an entry the person ADDED OR CHANGED is judged; one the network already holds passes as it is.
  const held = new Set(before.map(entryKey));
  for (const e of after) {
    if (held.has(entryKey(e))) continue;
    if (e.kind === "link" && e.values.some((v) => !WEB.test(v))) return { ok: false, message: "A web address must start with http:// or https://." };
  }
  return { ok: true, value: [...after] };
}

/** A detail as a line a person reads. */
export function detailLine(e: AttributeEntry, options: AttributeOption[] | null): string {
  const o = options?.find((x) => x.id === e.id);
  const name = o?.label ?? humanize(e.id);
  const valueName = (v: string) => o?.values.find((x) => x.value === v)?.label ?? humanize(v);
  switch (e.kind) {
    case "yesno":
      return `${name}: ${e.value ? "Yes" : "No"}`;
    case "choice":
      return `${name}: ${e.values.map(valueName).join(", ")}`;
    case "link":
      return `${name}: ${e.values.join(", ")}`;
    case "choices":
      return `${name}: ${[...e.set.map(valueName), ...e.unset.map((v) => `not ${valueName(v)}`)].join(", ")}`;
  }
}

// ── Links ────────────────────────────────────────────────────────────────────

export const linkTypeLabel = (type: string, types: LinksResponse["types"]): string => types.find((t) => t.type === type)?.label ?? humanize(type);

/** The list with one link added. A second address for a kind is fine; the same address twice for one kind is not added. */
export function withLink(current: readonly ActionLink[], link: ActionLink): ActionLink[] {
  return current.some((l) => l.type === link.type && l.uri === link.uri) ? [...current] : [...current, link];
}

export function withoutLink(current: readonly ActionLink[], index: number): ActionLink[] {
  return current.filter((_, i) => i !== index);
}

/** ONE PREFERRED LINK PER KIND: marking one clears the mark on the others of its kind. */
export function withPreferred(current: readonly ActionLink[], index: number): ActionLink[] {
  const type = current[index]?.type;
  return current.map((l, i) => {
    const rest: ActionLink = { type: l.type, uri: l.uri };
    return i === index ? { ...rest, preferred: true } : l.type === type ? rest : l;
  });
}

export function linksValue(before: readonly ActionLink[], after: readonly ActionLink[], types: LinksResponse["types"]): Built<ActionLink[]> {
  // Only a link the person ADDED is judged: a new one needs a kind the network offers and an https address. One the network already holds keeps
  // its kind and its scheme (a preference change on it is not a new link).
  const held = new Set(before.map((l) => `${l.type}|${l.uri}`));
  for (const l of after) {
    if (held.has(`${l.type}|${l.uri}`)) continue;
    if (!types.some((t) => t.type === l.type)) return { ok: false, message: "That kind of link is not offered." };
    if (!HTTPS.test(l.uri)) return { ok: false, message: "A new web address must start with https://." };
  }
  const key = (l: ActionLink) => `${l.type}|${l.uri}|${l.preferred === true}`;
  const preferredTypes = after.filter((l) => l.preferred).map((l) => l.type);
  if (new Set(preferredTypes).size !== preferredTypes.length) return { ok: false, message: "Only one link of each kind can be the preferred one." };
  if ([...before.map(key)].sort().join("\n") === [...after.map(key)].sort().join("\n")) return { ok: false, message: "Add, remove or change a link first." };
  return { ok: true, value: [...after] };
}

// ── The lines of a change card ───────────────────────────────────────────────

function postLines(v: Record<string, unknown>): string[] {
  const op = v.op as string | undefined;
  if (op === "delete") return ["This post will be removed"];
  const kind = (v.kind as PostKind | undefined) ?? "update";
  const out = [`${KIND_LABEL[kind] ?? "Post"}: ${String(v.summary ?? "")}`];
  const action = v.action as { type?: string; url?: string } | undefined;
  if (action?.type) out.push(`Button: ${actionLabel(action.type)}${action.url ? ` (${action.url})` : ""}`);
  const ev = v.event as { title?: string; start?: string; end?: string } | undefined;
  if (ev?.title) out.push(`${ev.title}: ${ev.start ?? ""}${ev.end ? ` to ${ev.end}` : ""}`);
  const of = v.offer as { code?: string; redeemUrl?: string; terms?: string } | undefined;
  if (of?.code) out.push(`Code: ${of.code}`);
  if (of?.redeemUrl) out.push(`Redeem at: ${of.redeemUrl}`);
  if (of?.terms) out.push(`Terms: ${of.terms}`);
  return out;
}

/** A value of one of the four fields as plain lines (never raw JSON). An empty list of lines is "nothing set". */
export function extraValueLines(field: string, value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (field === "posts") return typeof value === "object" ? postLines(value as Record<string, unknown>) : [];
  if (!Array.isArray(value)) return [];
  switch (field) {
    case "services":
      return (value as ServiceEntry[]).map((s) => (s.kind === "custom" ? s.name : humanize(s.id)) + (s.description ? ` (${s.description})` : ""));
    case "attributes":
      return (value as AttributeEntry[]).map((a) => detailLine(a, null));
    case "links":
      return (value as ActionLink[]).map((l) => `${humanize(l.type)}: ${l.uri}${l.preferred ? " (preferred)" : ""}`);
    default:
      return [];
  }
}

// ── A read that failed ───────────────────────────────────────────────────────

/**
 * What a panel shows when the read of what the network holds fails, and the ONE thing it offers. The api says why with a code, in its own plain
 * words: Peakhour's side is not set up (`NETWORK_SETUP`: nothing to do, so no "Try again"), the access was refused (`RECONNECT_NEEDED`: reconnect),
 * the listing is gone (`LISTING_NOT_FOUND`: choose it again), or the network did not answer (anything else: try again). The api names the page
 * to go to (`details[0].href`); with none, the two linked actions are not offered rather than guessed. The network's name is the api's label.
 */
export type ReadFailureAction = { kind: "none" } | { kind: "retry" } | { kind: "link"; label: string; href: string };

export function readFailureAction(err: unknown, label: string): ReadFailureAction {
  const e = err as { code?: unknown; details?: unknown } | null;
  const code = typeof e?.code === "string" ? e.code : "";
  if (code === "NETWORK_SETUP") return { kind: "none" };
  if (code === "RECONNECT_NEEDED" || code === "LISTING_NOT_FOUND") {
    const first = Array.isArray(e?.details) ? (e!.details as Array<{ href?: unknown }>)[0] : undefined;
    const href = typeof first?.href === "string" && first.href.startsWith("/") ? first.href : null;
    if (!href) return { kind: "none" };
    return { kind: "link", label: code === "RECONNECT_NEEDED" ? `Reconnect ${label}` : "Choose your listing", href };
  }
  return { kind: "retry" };
}
