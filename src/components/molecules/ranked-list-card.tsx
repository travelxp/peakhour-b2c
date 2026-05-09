import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * RankedListCard — generic top-N leaderboard pattern (numbered list,
 * each row showing a primary label + optional secondary line + a
 * trailing count/value badge).
 *
 * Used by Insights panels (Trusted Sources top-cited, future
 * X/LinkedIn top posts, etc.). The molecule deliberately leaves
 * domain-specific concerns (links, action menus, type-icons) to the
 * composition site — keep the molecule renderer dumb so the same
 * component renders top-cited sources and top-engaging posts without
 * a switch.
 */

export interface RankedListItem {
  /** Stable React key. */
  id: string;
  /** Primary label, e.g. a source's display name. */
  title: string;
  /** Optional secondary line (truncated if long), e.g. URL/identifier. */
  subtitle?: string;
  /** Trailing badge value — render as-is so callers can format
   *  (e.g. "1.2k", "$420", "12 citations"). */
  value: string | number;
}

export interface RankedListCardProps {
  title: string;
  items: RankedListItem[];
  /** Copy shown when items is empty. Tailor per surface — the
   *  molecule has no domain context to choose default copy. */
  emptyMessage: string;
  /** Cap the visible items. Defaults to 5 (the leaderboard sweet
   *  spot). Pass `Infinity` to render everything. */
  limit?: number;
}

export function RankedListCard({
  title,
  items,
  emptyMessage,
  limit = 5,
}: RankedListCardProps) {
  const visible = items.slice(0, limit);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ol className="space-y-2">
            {visible.map((item, i) => (
              <li key={item.id} className="flex items-baseline gap-3 text-sm">
                <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.title}</p>
                  {item.subtitle ? (
                    <p
                      className="truncate font-mono text-[11px] text-muted-foreground"
                      title={item.subtitle}
                    >
                      {item.subtitle}
                    </p>
                  ) : null}
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
                  {item.value}
                </Badge>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
