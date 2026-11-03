import type { Channel, InboxRow, InboxState } from "@/lib/inbox-view";
import type { ResponseTimer, ThreadAssignee } from "@/lib/inbox-desk";

/**
 * "All my stores" in the Inbox (I3f): what the page decides about a read-only list across the stores a person belongs to.
 *
 * ★THE SESSION STAYS PINNED TO ONE STORE. This list only reads; opening a row switches the session to that row's store (the business
 * switcher) and then opens the conversation as usual, so every action - reply, assign, mark done - still runs inside one store.
 * The rules (who is a member, what each state means) are the api's; this file is the words and the open flow.
 */

export type InboxScope = "store" | "all";

export const SCOPE_LABEL: Record<InboxScope, string> = { store: "This store", all: "All my stores" };

/** The line under the toggle while the list spans stores. */
export const ALL_STORES_NOTE = "Conversations from all your stores, newest first. Opening one switches to that store.";

export const ALL_STORES_EMPTY = "No conversations match in your stores.";

/** `?scope=all` is the only value that means all stores; anything else is the current store. */
export function scopeFromParam(v: string | null | undefined): InboxScope {
  return v === "all" ? "all" : "store";
}

/** The toggle is for a person with more than one store: with one, "All my stores" would be the same list. */
export function offersAllStores(storeCount: number): boolean {
  return storeCount > 1;
}

/** One row of the api's all-stores list. */
export interface AllStoresConversation {
  businessId: string;
  businessName: string;
  threadId: string;
  channel: Channel;
  contactName: string | null;
  waId: string;
  status: string;
  updatedAt: string | null;
  preview: string;
  held: "conversation" | "business" | null;
  needsYou: boolean;
  state: InboxState;
  assignee: ThreadAssignee | null;
  tagIds: string[];
  timer: ResponseTimer | null;
  test?: boolean;
}

export interface AllStoresStore {
  id: string;
  name: string;
  role: string;
  /** Rows of the loaded page in this store, and how many of those need a person. */
  count: number;
  needsYou: number;
}

export interface AllStoresPage {
  conversations: AllStoresConversation[];
  nextCursor: string | null;
  stores: AllStoresStore[];
  capNote: string | null;
}

export interface AllStoresRow extends InboxRow {
  businessId: string;
  businessName: string;
}

/** A row as the shared list row shows it, plus the store it belongs to. */
export function rowOfAllStores(c: AllStoresConversation): AllStoresRow {
  return {
    threadId: c.threadId,
    channel: c.channel,
    title: c.contactName || c.waId || (c.channel === "storefront" ? "Storefront visitor" : "Contact"),
    preview: c.preview,
    status: c.status,
    updatedAt: c.updatedAt,
    activityAt: c.updatedAt,
    held: c.held,
    needsYou: c.needsYou,
    state: c.state,
    test: c.test === true,
    assignee: c.assignee,
    tagIds: c.tagIds,
    timer: c.timer,
    businessId: c.businessId,
    businessName: c.businessName,
  };
}

/** Pages are read at different moments, so a row that moved can appear in two; each conversation is listed once. */
export function dedupeRows<T extends { threadId: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.threadId) ? false : (seen.add(r.threadId), true)));
}

/** The count shown on a store's chip: of the conversations loaded so far, how many are in it. */
export function storeChipLabel(s: Pick<AllStoresStore, "name" | "count" | "needsYou">): string {
  return s.count > 0 ? `${s.name} (${s.count})` : s.name;
}

export const openFailedMessage = (storeName: string): string => `Couldn't switch to ${storeName}, so the conversation was not opened. Try again.`;

/** The address that lands on a conversation in the store the session is about to be in: no `scope`, the thread named. */
export function openAddress(pathname: string, current: string, threadId: string): string {
  const search = new URLSearchParams(current);
  search.delete("scope");
  search.set("tab", "conversations");
  search.set("thread", threadId);
  return `${pathname}?${search.toString()}`;
}

/**
 * Open a row: switch the session to the row's store unless it is already there, then open the conversation. ★THE CONVERSATION IS OPENED
 * ONLY AFTER THE SWITCH SUCCEEDED; a failed switch leaves the person where they were, with the words for it. Nothing is half done.
 */
export async function openAllStoresRow(args: {
  row: Pick<AllStoresRow, "businessId" | "businessName" | "threadId">;
  activeBusinessId: string | null | undefined;
  switchBusiness: (businessId: string) => Promise<void>;
  open: (threadId: string) => void;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (args.row.businessId !== args.activeBusinessId) {
    try {
      await args.switchBusiness(args.row.businessId);
    } catch {
      return { ok: false, message: openFailedMessage(args.row.businessName) };
    }
  }
  args.open(args.row.threadId);
  return { ok: true };
}
