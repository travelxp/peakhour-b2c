"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TipsAnswer } from "@/lib/notification-tips";

/**
 * The business's helpful-emails switch (GET/PUT /v1/notifications/tips, PE-14). The save is confirmed by the api's answer, not assumed: the switch
 * shows what the api holds, and a failed save leaves it where it was.
 */
export const tipsKeys = { all: ["notification-tips"] as const };

export function useNotificationTips() {
  return useQuery<TipsAnswer>({
    queryKey: tipsKeys.all,
    queryFn: () => api.get<TipsAnswer>("/v1/notifications/tips"),
    staleTime: 30_000,
  });
}

export function useSetNotificationTips() {
  const qc = useQueryClient();
  return useMutation<TipsAnswer, Error, boolean>({
    mutationFn: (enabled) => api.put<TipsAnswer>("/v1/notifications/tips", { enabled }),
    onSuccess: (answer) => qc.setQueryData(tipsKeys.all, answer),
  });
}
