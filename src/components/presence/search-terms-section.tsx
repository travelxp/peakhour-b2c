"use client";

import { useLocale } from "@/hooks/use-locale";
import { PRESENCE_NETWORK_LABEL, monthStartIso, searchTermsView, termCountText, type PresenceListingResponse } from "@/lib/presence-panels";

/**
 * What people searched for to find the listing, for one month.
 *
 * MARKUP ONLY. Drawn only where the network declares search terms. A count the network gave only as a
 * threshold reads "Fewer than N searches", never N; a month never asked about says so rather than
 * showing an empty list.
 */
export function SearchTermsSection({ google }: { google: PresenceListingResponse["google"] }) {
  const { formatNumber, formatDate } = useLocale();
  const view = searchTermsView(google, PRESENCE_NETWORK_LABEL);
  if (!view) return null;
  const monthText = (month: string) => {
    const iso = monthStartIso(month);
    return iso ? formatDate(iso, { timeZone: "UTC", month: "long", year: "numeric" }) : month;
  };

  return (
    <div className="space-y-2 border-t pt-4">
      <div>
        <h3 className="text-sm font-medium">What people searched for</h3>
        <p className="text-xs text-muted-foreground">
          {view.kind === "no_answer" ? "Once a month" : monthText(view.month)}
        </p>
      </div>
      {view.kind === "terms" ? (
        <>
          <ul className="divide-y rounded-lg border text-sm">
            {view.terms.map((t) => (
              <li key={t.term} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <span className="min-w-0 break-words">{t.term}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{termCountText(t, formatNumber)}</span>
              </li>
            ))}
          </ul>
          {view.note && <p className="text-[11px] text-muted-foreground">{view.note}</p>}
        </>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">{view.text}</p>
      )}
    </div>
  );
}
