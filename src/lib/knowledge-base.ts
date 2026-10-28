/**
 * The knowledge base page's rules (Commerce -> Knowledge base).
 *
 * The page lives in the dashboard but the words live here, because a rule in a
 * render closure is a rule nothing can check. The api (`/v1/kb`, peakhour-api
 * services/kb/kb-editor.ts) is the authority on every bound below; they are
 * repeated so the form can say "too long" before a round trip, and a test pins
 * them to the api's numbers.
 */

export const KB_TITLE_MAX = 256;
export const KB_CONTENT_MAX = 8192;
export const KB_TAG_MAX = 64;
export const KB_TAGS_MAX = 32;

/** `cmrc_merchants.channel`, the api's enum (kb-editor.ts KB_CHANNELS): the editor's checkboxes never wait on a fetch. */
export const KB_CHANNELS = ["shopify", "woocommerce"] as const;

export type KbSource = "owner" | "import" | "learned";

export interface KbEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source: KbSource;
  status: "active" | "archived";
  /** Empty = every channel. */
  channels: string[];
  readOnly: boolean;
  managedIn: string | null;
  url: string | null;
  syncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface KbRequest {
  id: string;
  question: string;
  timesAsked: number;
  lastAskedAt: string | null;
  createdAt: string | null;
  status: "open" | "answered" | "dismissed";
  answeredEntryId: string | null;
}

export interface KbForm {
  title: string;
  content: string;
  /** Comma- or newline-separated. */
  tags: string;
  channels: string[];
}

export interface KbPayload {
  title: string;
  content: string;
  tags: string[];
  channels: string[];
}

export const EMPTY_FORM: KbForm = { title: "", content: "", tags: "", channels: [] };

/** "a, b\nc" -> ["a","b","c"], trimmed, no blanks, no repeats. */
export function parseTags(raw: string): string[] {
  return Array.from(new Set(raw.split(/[,\n]/).map((t) => t.trim()).filter(Boolean)));
}

export function entryToForm(e: KbEntry): KbForm {
  return { title: e.title, content: e.content, tags: e.tags.join(", "), channels: [...e.channels] };
}

/** The form as the api wants it, or the sentence to show beside the field. */
export function formToPayload(f: KbForm): { ok: true; payload: KbPayload } | { ok: false; error: string; field: "title" | "content" | "tags" } {
  const title = f.title.trim();
  const content = f.content.trim();
  const tags = parseTags(f.tags);
  if (!title) return { ok: false, field: "title", error: "Give the entry a title - the question it answers works well." };
  if (title.length > KB_TITLE_MAX) return { ok: false, field: "title", error: `The title can be at most ${KB_TITLE_MAX} characters.` };
  if (!content) return { ok: false, field: "content", error: "Write the answer your assistant should give." };
  if (content.length > KB_CONTENT_MAX) return { ok: false, field: "content", error: `The answer can be at most ${KB_CONTENT_MAX} characters.` };
  if (tags.length > KB_TAGS_MAX) return { ok: false, field: "tags", error: `Use at most ${KB_TAGS_MAX} tags.` };
  if (tags.some((t) => t.length > KB_TAG_MAX)) return { ok: false, field: "tags", error: `A tag can be at most ${KB_TAG_MAX} characters.` };
  return { ok: true, payload: { title, content, tags, channels: f.channels } };
}

/** An answer to a question: only the answer is required; the title defaults to the question. */
export function answerToPayload(content: string): { ok: true; payload: { content: string } } | { ok: false; error: string } {
  const c = content.trim();
  if (!c) return { ok: false, error: "Write the answer first." };
  if (c.length > KB_CONTENT_MAX) return { ok: false, error: `The answer can be at most ${KB_CONTENT_MAX} characters.` };
  return { ok: true, payload: { content: c } };
}

export function charsLeft(content: string): number {
  return KB_CONTENT_MAX - content.length;
}

const CHANNEL_LABELS: Record<string, string> = { shopify: "Shopify", woocommerce: "WooCommerce" };
export const channelLabel = (c: string): string => CHANNEL_LABELS[c] ?? c;

/** Where an entry applies. An entry with no channel applies to every one. */
export function channelsLine(channels: string[]): string {
  return channels.length ? channels.map(channelLabel).join(", ") : "All channels";
}

export function sourceLabel(e: Pick<KbEntry, "source" | "managedIn">): string {
  if (e.source === "import") return e.managedIn ? `Imported from ${e.managedIn}` : "Imported";
  if (e.source === "learned") return "Learned from a conversation";
  return "Written by you";
}

/** Why an imported entry has no edit button, and what to do about it. */
export function readOnlyNote(e: Pick<KbEntry, "readOnly" | "managedIn">): string | null {
  if (!e.readOnly) return null;
  return `Managed in ${e.managedIn ?? "its source"} and refreshed from there, so it is read-only here. Take it over to write your own version - Peakhour then stops refreshing it.`;
}

/** "Asked once" / "Asked 4 times". */
export function askedLine(r: Pick<KbRequest, "timesAsked">): string {
  return r.timesAsked === 1 ? "Asked once" : `Asked ${r.timesAsked} times`;
}

/** The api's refusal as the sentence to show; its own wording when it sent one. */
export function kbErrorMessage(err: unknown): string {
  const m = err instanceof Error ? err.message : "";
  return m || "That did not save. Please try again.";
}
