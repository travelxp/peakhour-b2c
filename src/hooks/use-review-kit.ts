import { useQuery } from "@tanstack/react-query";
import { presenceApi } from "@/lib/api/presence";
import { REVIEW_KIT_QUERY_KEY } from "@/lib/review-kit";

/** The review kit (link, QR, poster facts). One query for the Presence card and the poster page, so they cannot disagree. */
export function useReviewKit() {
  return useQuery({ queryKey: REVIEW_KIT_QUERY_KEY, queryFn: () => presenceApi.reviewKit(), staleTime: 60_000 });
}
