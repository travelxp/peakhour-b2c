"use client";

import { keepWithinBusiness } from "@/lib/wa-conversation-export";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { CustomerPanelData, InboxPrices } from "@/lib/inbox-customer";
import type { InboxState, StatusFilter } from "@/lib/inbox-view";
import { deskListParams, type AssigneeFilter, type ResponseTimer, type ThreadAssignee, type ThreadCsat } from "@/lib/inbox-desk";
import type { MessageMedia, ProductHit } from "@/lib/inbox-media";
import {
  replyRequest,
  resumeBody,
  threadPollInterval,
  type ReplyPayload,
  type ReplyResult,
  type StudioTemplate,
} from "@/lib/wa-inbox-reply";

/** A WhatsApp conversation summary (list row). */
export interface WaConversation {
  threadId: string;
  /** Which channel the thread is on. Absent = an older api (WhatsApp). */
  channel?: "whatsapp" | "messenger" | "instagram" | "x";
  waId: string;
  contactName: string | null;
  status: string;
  updatedAt: string | null;
  lastInboundAt: string | null;
  preview: string;
  /** Under a legal hold (H1), and how: by name or because the whole business is. null = not held; absent = an older api. */
  held?: "conversation" | "business" | null;
  /** Inbox phase 1: the assistant handed it to the team and nobody has picked it up. Absent = an older api. */
  needsYou?: boolean;
  /** Inbox phase 2: Open / Needs you / Done. Absent = an older api. */
  state?: InboxState;
  /** Team desk (I3a): who it is assigned to, its tags, and the first-reply timer (only in Needs you). Absent = an older api. */
  assignee?: ThreadAssignee | null;
  tagIds?: string[];
  timer?: ResponseTimer | null;
}

/** A storefront chat summary (list row): a web visitor talking to the assistant on the store. Read-only. */
export interface StorefrontChat {
  threadId: string;
  channel: "storefront";
  /** Always "Storefront visitor": the row holds no name. */
  contactName: string;
  status: string;
  updatedAt: string | null;
  preview: string;
  held?: "conversation" | "business" | null;
  /** Inbox phase 2: Open or Done (a storefront chat is never "Needs you"). */
  state?: InboxState;
  /** The merchant's own "Test on your store" chat. */
  test?: boolean;
  /** Team desk (I3a): who it is assigned to, its tags, and the first-reply timer (only in Needs you). Absent = an older api. */
  assignee?: ThreadAssignee | null;
  tagIds?: string[];
  timer?: ResponseTimer | null;
}

/** One storefront chat in full. `readOnly`: a web visitor cannot be messaged back. */
export interface StorefrontThread {
  threadId: string;
  channel: "storefront";
  contactName: string;
  status: string;
  held?: "conversation" | "business" | null;
  state?: InboxState;
  doneAt?: string | null;
  test?: boolean;
  /** Team desk (I3a): who it is assigned to, its tags, and the first-reply timer (only in Needs you). Absent = an older api. */
  assignee?: ThreadAssignee | null;
  tagIds?: string[];
  timer?: ResponseTimer | null;
  readOnly: true;
  messages: Array<{ role: string; content: string; timestamp: string | null }>;
}

export interface WaMessage {
  role: "user" | "assistant" | "merchant";
  content: string;
  timestamp: string | null;
  /** WA T3: `inbox` = a team member wrote it from the Inbox; `phone` = the
   *  business's own WhatsApp app (and every assistant or shopper line). */
  source?: "phone" | "inbox";
  /** WA T3: the team member who wrote an Inbox line; null from the Shopify admin. */
  authorUserId?: string | null;
  /** Inbox rich messages: a photo, voice note, video, document or sticker on this line; null on every other. Absent = an older api. */
  media?: MessageMedia | null;
}

export interface WaThread {
  threadId: string;
  channel?: "whatsapp" | "messenger" | "instagram" | "x";
  contactName: string | null;
  status: string;
  /** WA T3: the shopper's last message. */
  lastInboundAt?: string | null;
  /** WA T3: when free text stops being allowed; null = the window is closed. */
  replyWindowEndsAt?: string | null;
  /** WA T2's compare-and-set version, on the read since api#1530 (see `resumeBody`). */
  statusVersion?: number;
  /** Legal hold (H1): by name, or because the whole business is held; null = not held. */
  held?: "conversation" | "business" | null;
  /** Inbox phase 1: handed to the team by the assistant and not yet picked up. */
  needsYou?: boolean;
  /** Inbox phase 2: Open / Needs you / Done, and when a person marked it Done (while it still counts). */
  state?: InboxState;
  doneAt?: string | null;
  /** When the thread last changed (the api compares it when a person marks the conversation Done). */
  updatedAt?: string | null;
  /** Team desk (I3a): who it is assigned to, its tags, and the first-reply timer (only in Needs you). Absent = an older api. */
  assignee?: ThreadAssignee | null;
  tagIds?: string[];
  timer?: ResponseTimer | null;
  /** The shopper's rating of this conversation (Inbox CSAT); null = never asked. */
  csat?: ThreadCsat | null;
  messages: WaMessage[];
}

/** `GET /v1/meta/whatsapp/connection`, the parts the composer reads. */
export interface WaConnectionStatus {
  connected: boolean;
  phoneNumberId?: string;
  phoneNumber?: string;
}

const BASE = "/v1/meta/whatsapp/conversations";

/** Pages are read at different moments, so a row that moved can appear in two; each conversation is listed once (the first, newest, copy). */
function dedupe<T extends { threadId: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.threadId) ? false : (seen.add(r.threadId), true)));
}

/** What narrows a list: the Open / Needs you / Done chip, and the search text (already trimmed and long enough: `searchTerm`). */
export interface ListView {
  expiringOnly?: boolean;
  status?: StatusFilter;
  q?: string;
  /** Team desk (I3a): Mine / Unassigned (All = none), and one tag. A new value is a new query key, so the list starts again from its first page. */
  assignee?: AssigneeFilter;
  tag?: string | null;
}

const listParams = (view: ListView, cursor: string | undefined): Record<string, string> => ({
  ...deskListParams({ assignee: view.assignee ?? "all", tag: view.tag ?? null }),
  ...(view.expiringOnly ? { expiring: "1" } : {}),
  ...(view.status ? { status: view.status } : {}),
  ...(view.q ? { q: view.q } : {}),
  ...(cursor ? { cursor } : {}),
});

interface WaListPage {
  conversations: WaConversation[];
  /** Where the next page starts; null = the list ends here. Absent = an older api (no paging). */
  nextCursor?: string | null;
  expiringCount?: number | null;
  expiringFrom?: string | null;
  /** Inbox phase 1: the connection behind the list. Absent = an older api (nothing is claimed). */
  available?: boolean;
  connected?: boolean;
  needsReauth?: boolean;
}

/**
 * List the business's WhatsApp conversations (most recent first), a page at a time (Inbox phase 2: `fetchNextPage`).
 *
 * H2: the first page also carries `expiringCount` (conversations that will be deleted in the next 14 days, the number the
 * weekly email states) and `expiringFrom` (when the first goes). `expiringOnly` filters the list to those.
 * The key starts `["wa-conversations", business]` in every mode, so every existing invalidation still reaches it.
 * `data` is the FIRST page (the connection state and the banner count are read from it).
 */
export function useWaConversations(view: ListView = {}) {
  const { business } = useAuth();
  const key = ["wa-conversations", business?._id ?? "none", view.expiringOnly ? "expiring" : "all", view.status ?? "any", view.q ?? "", view.assignee ?? "all", view.tag ?? ""];
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => {
      const params = listParams(view, pageParam);
      return api.get<WaListPage>(BASE, Object.keys(params).length ? params : undefined);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(business?._id),
    refetchInterval: 30_000, // inbox stays roughly live
    // changing the chip or the search keeps the rows and the banner on screen until the other list arrives
    // ...but ONLY within one business: switching business must not show the previous business's list or banner
    placeholderData: (prev: InfiniteData<WaListPage, string | undefined> | undefined, prevQuery) => keepWithinBusiness(prev, prevQuery?.queryKey, business?._id ?? "none"),
  });
  const first = query.data?.pages[0];
  return {
    ...query,
    listKey: key,
    /** The first page: the connection state and the banner count. */
    data: first,
    conversations: dedupe(query.data?.pages.flatMap((p) => p.conversations) ?? []),
    expiringCount: first?.expiringCount ?? null,
    expiringFrom: first?.expiringFrom ?? null,
  };
}

interface StorefrontListPage {
  conversations: StorefrontChat[];
  nextCursor?: string | null;
}

/**
 * The business's storefront chats (Inbox phase 1), most recent first, a page at a time. Read-only, and NOT behind the WhatsApp
 * availability gate: a business whose WhatsApp is not on offer yet still reads its storefront chats. The key starts
 * `["storefront-chats", business]`. `enabled: false` (a search, which a visitor row can never match) fetches nothing.
 */
export function useStorefrontChats(view: ListView & { enabled?: boolean } = {}) {
  const { business } = useAuth();
  const key = ["storefront-chats", business?._id ?? "none", view.expiringOnly ? "expiring" : "all", view.status ?? "any", view.assignee ?? "all", view.tag ?? ""];
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => {
      const params = listParams({ ...view, q: undefined }, pageParam);
      return api.get<StorefrontListPage>("/v1/storefront-chats", Object.keys(params).length ? params : undefined);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(business?._id) && view.enabled !== false,
    refetchInterval: 30_000,
    placeholderData: (prev: InfiniteData<StorefrontListPage, string | undefined> | undefined, prevQuery) => keepWithinBusiness(prev, prevQuery?.queryKey, business?._id ?? "none"),
  });
  return { ...query, chats: dedupe(query.data?.pages.flatMap((p) => p.conversations) ?? []) };
}

/** One storefront chat's transcript. */
export function useStorefrontThread(threadId: string | null) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["storefront-thread", business?._id ?? "none", threadId],
    queryFn: () => api.get<StorefrontThread>(`/v1/storefront-chats/${encodeURIComponent(threadId!)}`),
    enabled: Boolean(business?._id && threadId),
    // a visitor may still be talking: the open chat is re-read at the list's pace
    refetchInterval: 30_000,
  });
}

/** Load one thread's messages. */
export function useWaThread(threadId: string | null) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["wa-thread", business?._id ?? "none", threadId],
    queryFn: () => api.get<WaThread>(`${BASE}/${encodeURIComponent(threadId!)}`),
    enabled: Boolean(business?._id && threadId),
    // ✅WA T4: while a person holds the thread, the shopper's answers arrive
    //  without a reload (spec: every 5s). Any other open thread is re-read at
    //  the list's 30s (`threadPollInterval`), since the list's poll does not
    //  refresh this query.
    refetchInterval: (q) => threadPollInterval(q.state.data?.status),
  });
}

/** The business's WhatsApp connection, for "Replying as <number>". */
export function useWaConnection(enabled: boolean) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["wa-connection", business?._id ?? "none"],
    queryFn: () => api.get<WaConnectionStatus>("/v1/meta/whatsapp/connection"),
    enabled: enabled && Boolean(business?._id),
    staleTime: 5 * 60_000,
  });
}

/**
 * The Template Studio's list, for the picker once the 24h window has closed.
 *
 * ★THE STUDIO PAGE'S OWN KEY AND RESPONSE, so an approval seen there is seen
 * here without a second fetch, and a refetch here refreshes that page.
 */
export function useWaStudioTemplates(enabled: boolean) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["wa-templates", business?._id ?? "none"],
    queryFn: () => api.get<{ templates: StudioTemplate[] }>("/v1/meta/whatsapp/studio/templates"),
    enabled: enabled && Boolean(business?._id),
    // ★Each thread opened remounts the composer (review R3); a refusal that
    //  says the list is stale refetches it explicitly (`refetchTemplates`).
    staleTime: 60_000,
  });
}

/**
 * ✅WA T4: send a reply from the Inbox (api#1528). The caller owns the
 * idempotency key: one per compose attempt, kept while the words are the same.
 */
export function useWaReply(threadId: string) {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: ReplyPayload; idempotencyKey: string }) => {
      const req = replyRequest(threadId, payload, idempotencyKey);
      return api.post<ReplyResult>(req.path, req.body);
    },
    // ★EVERY outcome re-reads the thread: a success to show the line, a repeat
    //  (`duplicate: true` carries no message) to show the first one, and a
    //  refusal because most of them are about the thread's state.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["wa-thread", biz, threadId] });
      qc.invalidateQueries({ queryKey: ["wa-conversations", biz] });
    },
  });
}

/** The composer's product search: this business's active products (up to 10; no words = the newest). */
export function useInboxProducts(threadId: string, q: string, enabled: boolean) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["wa-products", business?._id ?? "none", threadId, q],
    queryFn: () => api.get<{ products: ProductHit[] }>(`${BASE}/${encodeURIComponent(threadId)}/products`, { q }),
    enabled: Boolean(business?._id && threadId && enabled),
    staleTime: 60_000,
  });
}

/** Flag a thread for human handoff (sets it escalated). */
export function useWaHandoff() {
  const qc = useQueryClient();
  const { business } = useAuth();
  return useMutation({
    mutationFn: (threadId: string) => api.post(`${BASE}/${encodeURIComponent(threadId)}/handoff`),
    // ★Settled, as Resume (review R1): a 409 STATUS_CHANGED also re-reads.
    onSettled: (_r, _e, threadId) => {
      qc.invalidateQueries({ queryKey: ["wa-conversations", business?._id ?? "none"] });
      qc.invalidateQueries({ queryKey: ["wa-thread", business?._id ?? "none", threadId] });
    },
  });
}

/** Hand a thread back to the AI (clears escalated → active). Inverse of handoff. */
export function useWaResume() {
  const qc = useQueryClient();
  const { business } = useAuth();
  return useMutation({
    // ★WA T2 follow-up: the rendered `statusVersion` goes with it
    //  (`resumeBody`), so a Resume from a stale view is a 409, not a release.
    mutationFn: ({ threadId, thread }: { threadId: string; thread?: WaThread | null }) =>
      api.post(`${BASE}/${encodeURIComponent(threadId)}/resume`, resumeBody(thread)),
    // ★SETTLED, NOT ONLY SUCCESS: after a stale-view 409 the pane must re-read
    //  the thread, or it keeps the old version and every click is the same 409.
    onSettled: (_r, _e, { threadId }) => {
      qc.invalidateQueries({ queryKey: ["wa-conversations", business?._id ?? "none"] });
      qc.invalidateQueries({ queryKey: ["wa-thread", business?._id ?? "none", threadId] });
    },
  });
}

// ── Inbox phase 2: Mark done, the customer panel, the priced buttons ─────────────────────────────────────────────

/** What the Inbox's priced buttons cost, in Peaks, from the live rate card (null = no price row: the button says so). */
export function useInboxPrices() {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["inbox-prices", business?._id ?? "none"],
    queryFn: () => api.get<InboxPrices>(`${BASE.replace("/conversations", "")}/inbox-prices`),
    enabled: Boolean(business?._id),
    staleTime: 5 * 60_000,
  });
}

/**
 * The customer panel beside an open conversation. `after` is the orders cursor of a page a person asked for; the first page has none.
 * ★A WHATSAPP THREAD AND A STOREFRONT THREAD HAVE THEIR OWN MOUNTS (the storefront tree is not behind the WhatsApp availability gate).
 */
export function useCustomerPanel(threadId: string | null, after?: string) {
  const { business } = useAuth();
  const storefront = Boolean(threadId?.startsWith("storefront:"));
  return useQuery({
    queryKey: ["inbox-customer", business?._id ?? "none", threadId, after ?? ""],
    queryFn: () => {
      const path = storefront ? `/v1/storefront-chats/${encodeURIComponent(threadId!)}/customer` : `${BASE}/${encodeURIComponent(threadId!)}/customer`;
      return api.get<CustomerPanelData>(path, after ? { after } : undefined);
    },
    enabled: Boolean(business?._id && threadId),
    // the orders are read live from Shopify and not stored: a short stay in this browser, so reopening a conversation is quick and a refresh is current
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Mark a conversation Done, or Reopen it. `seenUpdatedAt` is the time the person's view was loaded: a message that arrived since is a refusal, not a hidden message. */
export function useMarkDone() {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useMutation({
    mutationFn: ({ threadId, done, seenUpdatedAt }: { threadId: string; done: boolean; seenUpdatedAt?: number }) => {
      const mount = threadId.startsWith("storefront:") ? `/v1/storefront-chats/${encodeURIComponent(threadId)}` : `${BASE}/${encodeURIComponent(threadId)}`;
      return api.post<{ done: boolean; resumed: boolean }>(`${mount}/${done ? "done" : "reopen"}`, done && seenUpdatedAt !== undefined ? { seenUpdatedAt } : undefined);
    },
    // ★SETTLED, NOT ONLY SUCCESS: a refusal because a message arrived must re-read the thread and the list
    onSettled: (_r, _e, { threadId }) => {
      void qc.invalidateQueries({ queryKey: ["wa-conversations", biz] });
      void qc.invalidateQueries({ queryKey: ["storefront-chats", biz] });
      void qc.invalidateQueries({ queryKey: ["wa-thread", biz, threadId] });
      void qc.invalidateQueries({ queryKey: ["storefront-thread", biz, threadId] });
    },
  });
}

/** "Refresh summary": rewrite the customer's summary from the conversation. Priced; a deliberate press. */
export function useRefreshSummary(threadId: string) {
  const qc = useQueryClient();
  const { business } = useAuth();
  return useMutation({
    mutationFn: () => api.post<{ summary: string | null; chargedCredits: number }>(`${BASE}/${encodeURIComponent(threadId)}/customer/summary`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox-customer", business?._id ?? "none", threadId] }),
  });
}

/** "Suggest a reply": an editable draft. A draft only: nothing is sent or stored. Priced; a deliberate press. */
export function useSuggestReply(threadId: string) {
  return useMutation({
    mutationFn: () => api.post<{ reply: string; rationale: string; chargedCredits: number }>(`${BASE}/${encodeURIComponent(threadId)}/suggest-reply`),
  });
}

/** "Delete this customer's data" (owner/admin): the api erases the customer's conversations, contact record and queued messages. */
export function useDeleteContactData() {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useMutation({
    mutationFn: (threadId: string) => api.delete<{ erased: true; held: { deferred: number } }>(`${BASE}/${encodeURIComponent(threadId)}/contact-data`),
    onSuccess: (_r, threadId) => {
      void qc.invalidateQueries({ queryKey: ["wa-conversations", biz] });
      qc.removeQueries({ queryKey: ["wa-thread", biz, threadId] });
      qc.removeQueries({ queryKey: ["inbox-customer", biz, threadId] });
    },
  });
}
