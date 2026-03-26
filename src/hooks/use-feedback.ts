"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────

export interface FeedbackTicket {
  _id: string;
  ticketNumber: string;
  category: string;
  description: string;
  status: string;
  context: {
    url?: string;
    module?: string;
    entityType?: string;
    entityId?: string;
  };
  aiAnalysis?: {
    severity: string;
    categoryRefined: string;
    rootCauseHypothesis: string;
    suggestedActions: Array<{
      action: string;
      priority: string;
      effort?: string;
    }>;
    affectedModules: string[];
    sentiment: string;
    summary: string;
    analyzedAt: string;
  };
  resolution?: {
    notes: string;
    resolvedAt: string;
    resolvedByName: string;
  };
  priority?: number;
  assignedToName?: string;
  createdByName: string;
  createdAt: string;
  comments?: FeedbackComment[];
}

export interface FeedbackComment {
  _id: string;
  body: string;
  internal: boolean;
  type: string;
  createdByName: string;
  createdAt: string;
}

// ── Query Keys ──────────────────────────────────────────────

export const feedbackKeys = {
  all: ["feedback"] as const,
  myTickets: (status?: string) =>
    status ? (["feedback", "my", status] as const) : (["feedback", "my"] as const),
  adminTickets: (params?: Record<string, string>) =>
    ["feedback", "admin", params ?? {}] as const,
  detail: (id: string) => ["feedback", id] as const,
};

// ── User Hooks ──────────────────────────────────────────────

export function useMyTickets(status?: string) {
  return useQuery({
    queryKey: feedbackKeys.myTickets(status),
    queryFn: () =>
      api.get<FeedbackTicket[]>(
        "/v1/feedback",
        status ? { status } : undefined
      ),
  });
}

export function useTicketDetail(id: string) {
  return useQuery({
    queryKey: feedbackKeys.detail(id),
    queryFn: () => api.get<FeedbackTicket>(`/v1/feedback/${id}`),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      category: string;
      description: string;
      context: Record<string, unknown>;
    }) => api.post<{ _id: string; ticketNumber: string; status: string }>("/v1/feedback", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
    },
  });
}

// ── Admin Hooks ─────────────────────────────────────────────

export function useAdminTickets(params?: Record<string, string>) {
  return useQuery({
    queryKey: feedbackKeys.adminTickets(params),
    queryFn: () => api.get<FeedbackTicket[]>("/v1/feedback/admin", params),
  });
}

export function useUpdateTicketStatus(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      status: string;
      priority?: number;
      assignedToId?: string;
      assignedToName?: string;
      resolution?: { notes: string };
    }) => api.patch<{ status: string }>(`/v1/feedback/${ticketId}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
    },
  });
}

export function useAddComment(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { body: string; internal?: boolean }) =>
      api.post<{ _id: string }>(`/v1/feedback/${ticketId}/comments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: feedbackKeys.detail(ticketId),
      });
    },
  });
}

export function useReanalyzeTicket(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<Record<string, unknown>>(`/v1/feedback/${ticketId}/analyze`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: feedbackKeys.detail(ticketId),
      });
    },
  });
}
