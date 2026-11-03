"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { DeskNote, DeskSettings, DeskSettingsResponse, DeskTag, TeamMemberRef, ThreadAssignee } from "@/lib/inbox-desk";
import { patchFromForm } from "@/lib/inbox-desk";

/** The Inbox team desk's client (I3a): `/v1/inbox-desk/*`. One settings query, so the Inbox, Autopilot and the form read the same pause. */

const BASE = "/v1/inbox-desk";
const threadPath = (threadId: string) => `${BASE}/threads/${encodeURIComponent(threadId)}`;

export const deskKeys = {
  settings: (biz: string) => ["inbox-desk", "settings", biz] as const,
  team: (org: string) => ["inbox-desk", "team", org] as const,
  tags: (biz: string) => ["inbox-desk", "tags", biz] as const,
  notes: (biz: string, threadId: string) => ["inbox-desk", "notes", biz, threadId] as const,
};

export function useDeskSettings() {
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useQuery({
    queryKey: deskKeys.settings(biz),
    queryFn: () => api.get<DeskSettingsResponse>(`${BASE}/settings`),
    enabled: Boolean(business?._id),
    staleTime: 30_000,
  });
}

/** Teammates a conversation can be assigned to (editors and above), and who "me" is. */
export function useDeskTeam(enabled = true) {
  const { org } = useAuth();
  return useQuery({
    queryKey: deskKeys.team(org?._id ?? "none"),
    queryFn: () => api.get<{ team: TeamMemberRef[]; me: string }>(`${BASE}/team`),
    enabled: enabled && Boolean(org?._id),
    staleTime: 60_000,
  });
}

export function useDeskTags() {
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useQuery({
    queryKey: deskKeys.tags(biz),
    queryFn: () => api.get<{ tags: DeskTag[] }>(`${BASE}/tags`),
    enabled: Boolean(business?._id),
    staleTime: 60_000,
  });
}

// ── optimistic edits to the open conversation ───────────────────────────────────────────────────────────────────────

interface Patchable {
  assignee?: ThreadAssignee | null;
  tagIds?: string[];
}

/**
 * Writes `patch` into whichever thread query holds the conversation, and hands back what to put back: ONLY the fields this write
 * changed. ★An assign and a tag change can be in flight together; putting the whole old object back would undo the other one's
 * optimistic edit (or bring back one it had already rolled back).
 */
async function patchThreadCaches(qc: QueryClient, biz: string, threadId: string, patch: Patchable) {
  const keys = [
    ["wa-thread", biz, threadId],
    ["storefront-thread", biz, threadId],
  ];
  await Promise.all(keys.map((k) => qc.cancelQueries({ queryKey: k })));
  const previous = keys.map((k) => {
    const data = qc.getQueryData<Patchable>(k);
    const was: Patchable = {};
    if (data && "assignee" in patch) was.assignee = data.assignee ?? null;
    if (data && "tagIds" in patch) was.tagIds = data.tagIds ?? [];
    return [k, data ? was : undefined] as const;
  });
  for (const k of keys) qc.setQueryData<Patchable | undefined>(k, (data) => (data ? { ...data, ...patch } : data));
  return previous;
}

function restore(qc: QueryClient, previous: ReadonlyArray<readonly [readonly string[], Patchable | undefined]> | undefined) {
  for (const [k, was] of previous ?? []) if (was) qc.setQueryData<Patchable | undefined>(k, (data) => (data ? { ...data, ...was } : data));
}

function refreshLists(qc: QueryClient, biz: string, threadId: string) {
  void qc.invalidateQueries({ queryKey: ["wa-conversations", biz] });
  void qc.invalidateQueries({ queryKey: ["storefront-chats", biz] });
  void qc.invalidateQueries({ queryKey: ["wa-thread", biz, threadId] });
  void qc.invalidateQueries({ queryKey: ["storefront-thread", biz, threadId] });
}

/**
 * Assign, "Assign to me" or unassign. `pick` is a teammate's id, "me" or null. ★OPTIMISTIC, AND PUT BACK ON A FAILURE: the header shows
 * the new person at once and the old one again, with a message, if the api refuses.
 */
export function useAssignThread(threadId: string) {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useMutation({
    mutationFn: ({ pick }: { pick: string | null; optimistic: ThreadAssignee | null }) =>
      api.put<{ ok: boolean; threadId: string; assignee: ThreadAssignee | null; changed: boolean }>(`${threadPath(threadId)}/assignee`, { assigneeId: pick }),
    onMutate: async ({ optimistic }) => ({ previous: await patchThreadCaches(qc, biz, threadId, { assignee: optimistic }) }),
    onError: (_e, _v, ctx) => restore(qc, ctx?.previous),
    onSettled: () => refreshLists(qc, biz, threadId),
  });
}

/** The conversation's tags as a whole list (the api replaces them). Optimistic, put back on a failure. */
export function useSetThreadTags(threadId: string) {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useMutation({
    mutationFn: (tagIds: string[]) => api.put<{ tagIds: string[] }>(`${threadPath(threadId)}/tags`, { tagIds }),
    onMutate: async (tagIds) => ({ previous: await patchThreadCaches(qc, biz, threadId, { tagIds }) }),
    onError: (_e, _v, ctx) => restore(qc, ctx?.previous),
    onSettled: () => refreshLists(qc, biz, threadId),
  });
}

// ── notes ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface NotesResponse {
  notes: DeskNote[];
  label: string;
  me: string;
}

export function useThreadNotes(threadId: string | null) {
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useQuery({
    queryKey: deskKeys.notes(biz, threadId ?? ""),
    queryFn: () => api.get<NotesResponse>(`${threadPath(threadId!)}/notes`),
    enabled: Boolean(business?._id && threadId),
    refetchInterval: 30_000,
  });
}

export function useAddNote(threadId: string) {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useMutation({
    mutationFn: (body: string) => api.post<{ note: DeskNote; duplicate: boolean }>(`${threadPath(threadId)}/notes`, { body }),
    onSettled: () => void qc.invalidateQueries({ queryKey: deskKeys.notes(biz, threadId) }),
  });
}

export function useDeleteNote(threadId: string) {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useMutation({
    mutationFn: (noteId: string) => api.delete<{ ok: boolean }>(`${BASE}/notes/${encodeURIComponent(noteId)}`),
    onSettled: () => void qc.invalidateQueries({ queryKey: deskKeys.notes(biz, threadId) }),
  });
}

// ── settings, the pause and tags (admin) ────────────────────────────────────────────────────────────────────────────

export function useSaveDeskSettings() {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  return useMutation({
    mutationFn: (form: Parameters<typeof patchFromForm>[0]) => api.put<{ settings: DeskSettings }>(`${BASE}/settings`, patchFromForm(form)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: deskKeys.settings(biz) }),
  });
}

/** Pause or resume the shopper assistant. ★Optimistic, and the switch reads the server again once it settles. */
export function useSetAiPause() {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  const key = deskKeys.settings(biz);
  return useMutation({
    mutationFn: (paused: boolean) => api.post<{ paused: boolean; changed: boolean }>(`${BASE}/ai-pause`, { paused }),
    onMutate: async (paused) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<DeskSettingsResponse>(key);
      if (previous) qc.setQueryData<DeskSettingsResponse>(key, { ...previous, settings: { ...previous.settings, aiPaused: paused } });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

export function useTagAdmin() {
  const qc = useQueryClient();
  const { business } = useAuth();
  const biz = business?._id ?? "none";
  const done = () => {
    void qc.invalidateQueries({ queryKey: deskKeys.tags(biz) });
    // a renamed or deleted tag is on rows
    void qc.invalidateQueries({ queryKey: ["wa-conversations", biz] });
    void qc.invalidateQueries({ queryKey: ["storefront-chats", biz] });
  };
  return {
    create: useMutation({ mutationFn: (name: string) => api.post<DeskTag>(`${BASE}/tags`, { name }), onSuccess: done }),
    rename: useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => api.patch<DeskTag>(`${BASE}/tags/${encodeURIComponent(id)}`, { name }), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`${BASE}/tags/${encodeURIComponent(id)}`), onSuccess: done }),
  };
}
