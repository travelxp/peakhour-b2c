/**
 * Posts, services, details and links on the Presence page (PE-12): what to draw, what each state says, what a person may press, and the values
 * a form sends. PURE - no React, no fetch.
 *
 * ★A PANEL IS DRAWN FROM THE NETWORK'S DECLARATION. `GET /v1/presence/changes/capabilities` says, per network, which of the four panels it offers
 * (`panels`); a network that does not declare one draws NOTHING, not a disabled control. The kinds of post, the buttons, the longest post, the
 * kinds of link and every choice in a list arrive from the api (`/v1/presence/extras/*`), and the network's name in a sentence is the api's label.
 * Nothing in this file spells a network.
 * ★EVERY SUBMIT PREPARES A CHANGE. Nothing is sent until an admin approves it, and "live" is a word only the api's `live` status earns.
 * ★LISTS ARE WHOLE. A services, details or links change is the complete list the network should hold, built from what the network holds now (the
 * api reads it again and refuses a list built from an old copy), so an entry the person did not touch is kept exactly as read, price and
 * description included.
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
  event: { title: string; start: string; end?: string } | null;
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
  writes: { released: boolean; notice: string | null };
}

export type AttributeEntry =
  | { id: string; kind: "yesno"; value: boolean }
  | { id: string; kind: "choice"; value: string }
  | { id: string; kind: "link"; value: string }
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
  current: ActionLink[];
  writes: { released: boolean; notice: string | null };
}

// ── States ───────────────────────────────────────────────────────────────────

export type ListView = { kind: "loading" } | { kind: "paused" } | { kind: "failed" } | { kind: "empty"; stale: boolean } | { kind: "ready"; stale: boolean };

/** What a panel's read is: loading, waiting for a connection, failed, empty (read, nothing there) or ready. `stale` is a failed refresh over data. */
export function listView(v: "loading" | "paused" | "failed" | "data" | "data_stale", itemCount: number): ListView {
  if (v === "loading") return { kind: "loading" };
  if (v === "paused") return { kind: "paused" };
  if (v === "failed") return { kind: "failed" };
  const stale = v === "data_stale";
  return itemCount === 0 ? { kind: "empty", stale } : { kind: "ready", stale };
}

/**
 * What this person can do. `can` undefined is a read that has not answered or has failed, which is NOT "your role cannot": the first says
 * "checking", the second says the check failed, and only an answer that says no says the role cannot.
 */
export function extrasAccess(view: "loading" | "paused" | "failed" | "data" | "data_stale", can: { propose: boolean } | undefined, what: string): PhotoAccess {
  if (can) return can.propose ? { mode: "edit" } : { mode: "view", why: `Your role can look at your ${what} but not change them. Ask an editor, admin or owner.` };
  if (view === "loading" || view === "paused") return { mode: "view", why: "Checking what you can do here..." };
  return { mode: "view", why: `We could not check what your role can do, so ${what} cannot be changed from here right now. Reload the page to try again.` };
}

/** A role that may edit is still held until the change list, which says what is waiting, has answered. */
export function withChangesKnown(access: PhotoAccess, changes: "loading" | "paused" | "failed" | "data" | "data_stale", what: string): PhotoAccess {
  if (access.mode !== "edit") return access;
  if (changes === "data" || changes === "data_stale") return access;
  if (changes === "failed") return { mode: "view", why: `We could not load your ${what} changes, so changing them is off until they load. Try again.` };
  return { mode: "view", why: `Checking your waiting ${what} changes...` };
}

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

export const emptyPostDraft = (kind: PostKind = "update"): PostDraft => ({ kind, summary: "", actionType: "", actionUrl: "", eventTitle: "", start: "", end: "", offerCode: "", redeemUrl: "", terms: "" });

export function postDraftOf(p: PostItem): PostDraft {
  return {
    kind: p.kind,
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
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function isDay(v: string): boolean {
  if (!DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type Built<T> = { ok: true; value: T } | { ok: false; message: string };

export type PostValue =
  | ({ op: "create" } & PostContentValue)
  | ({ op: "update"; ref: string } & PostContentValue)
  | { op: "delete"; ref: string };
export interface PostContentValue {
  kind: PostKind;
  summary: string;
  action?: { type: string; url?: string };
  event?: { title: string; start: string; end?: string };
  offer?: { code?: string; redeemUrl?: string; terms?: string };
}

/** How many characters are left. Negative is over the network's limit. */
export const charsLeft = (summary: string, max: number): number => max - summary.trim().length;

/**
 * The value a post form sends, or the plain reason it cannot. These are the api's rules (it checks again, and says the same): the declared kinds
 * and buttons, the longest post (never shortened for you), https addresses, and a title and dates for an event or an offer.
 */
export function buildPostValue(draft: PostDraft, decl: PostsDeclaration, op: { op: "create" } | { op: "update"; ref: string }): Built<PostValue> {
  const summary = draft.summary.trim();
  if (!summary) return { ok: false, message: "Write what you want to say." };
  if (summary.length > decl.limits.summaryMaxLength) {
    return { ok: false, message: `Use at most ${decl.limits.summaryMaxLength} characters. This one is ${summary.length}, and it is not shortened for you.` };
  }
  if (!decl.kinds.includes(draft.kind)) return { ok: false, message: "That kind of post is not offered." };
  const value: PostContentValue = { kind: draft.kind, summary };

  const type = draft.actionType.trim();
  if (type) {
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
    if (!title) return { ok: false, message: `${draft.kind === "offer" ? "An offer" : "An event"} needs a title.` };
    if (!isDay(draft.start.trim())) return { ok: false, message: "Choose a start date." };
    const end = draft.end.trim();
    if (end) {
      if (!isDay(end)) return { ok: false, message: "Choose a real end date, or leave it empty." };
      if (end < draft.start.trim()) return { ok: false, message: "The end date is before the start date." };
    }
    value.event = { title, start: draft.start.trim(), ...(end ? { end } : {}) };
  }
  if (draft.kind === "offer") {
    const code = draft.offerCode.trim();
    const redeemUrl = draft.redeemUrl.trim();
    const terms = draft.terms.trim();
    if (redeemUrl && !HTTPS.test(redeemUrl)) return { ok: false, message: "The redeem link must start with https://." };
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
export function postControls(access: PhotoAccess, decl: Pick<PostsDeclaration, "edit">, pending: ChangeCardData | undefined): { edit: boolean; remove: boolean; note: string | null } {
  if (access.mode !== "edit") return { edit: false, remove: false, note: access.why };
  if (pending) return { edit: false, remove: false, note: null };
  return { edit: decl.edit, remove: true, note: null };
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

/** The list with one network service added. Every entry already there is kept exactly as read. */
export function withService(current: readonly ServiceEntry[], id: string): ServiceEntry[] {
  return current.some((s) => s.kind === "listed" && s.id === id) ? [...current] : [...current, { kind: "listed", id }];
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

export function detailsValue(before: readonly AttributeEntry[], after: readonly AttributeEntry[]): Built<AttributeEntry[]> {
  const norm = (l: readonly AttributeEntry[]) => JSON.stringify([...l].sort((x, y) => (x.id < y.id ? -1 : 1)).map((e) => (e.kind === "choices" ? { ...e, set: [...e.set].sort(), unset: [...e.unset].sort() } : e)));
  if (norm(before) === norm(after)) return { ok: false, message: "Change a detail first." };
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
      return `${name}: ${valueName(e.value)}`;
    case "link":
      return `${name}: ${e.value}`;
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
  for (const l of after) {
    if (!types.some((t) => t.type === l.type)) return { ok: false, message: "That kind of link is not offered." };
    if (!HTTPS.test(l.uri)) return { ok: false, message: "A web address must start with https://." };
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
