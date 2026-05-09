import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

/**
 * ProportionListCard — "label + count of total" rows with a progress
 * bar each, sorted however the caller likes. Used for breakdowns
 * (sources by type, posts by channel, audience by industry) where a
 * full chart is overkill but a list of plain counts is undersold.
 *
 * The molecule renders proportions strictly relative to `total` so
 * the caller controls whether the denominator is "all rows" or "rows
 * matching some filter" — a different denominator changes the bars'
 * meaning, and shifting that decision into the molecule would couple
 * it to a single use case.
 */

export interface ProportionListItem {
  id: string;
  label: string;
  count: number;
}

export interface ProportionListCardProps {
  title: string;
  items: ProportionListItem[];
  total: number;
  /** Copy shown when items is empty. */
  emptyMessage: string;
}

export function ProportionListCard({
  title,
  items,
  total,
  emptyMessage,
}: ProportionListCardProps) {
  return (
    <Card>
      <CardHeader>
        {/* Real <h3> for SR navigation — see ranked-list-card.tsx
            for the rationale. Tokens mirror CardTitle's defaults. */}
        <h3 className="text-base leading-none font-semibold">{title}</h3>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {item.count} / {total}
                  </span>
                </div>
                <Progress
                  value={total === 0 ? 0 : (item.count / total) * 100}
                  // Label puts the category name first so the AT
                  // user hears the bar's meaning (the category) before
                  // the proportion. "Newsletter: 3 of 12" is more
                  // scannable than "3 of 12 are newsletter".
                  aria-label={`${item.label}: ${item.count} of ${total}`}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
