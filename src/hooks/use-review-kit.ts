import { useQuery } from "@tanstack/react-query";
import { presenceApi } from "@/lib/api/presence";
import { REVIEW_KIT_QUERY_KEY } from "@/lib/review-kit";

/** The review kit (link, QR, poster facts) for the listing the page is showing. One query for the Presence card and the poster page, so they cannot disagree. */
export function useReviewKit(location?: string, network?: string) {
  return useQuery({ queryKey: [...REVIEW_KIT_QUERY_KEY, location ?? null, network ?? null], queryFn: () => presenceApi.reviewKit(location, network), staleTime: 60_000 });
}
