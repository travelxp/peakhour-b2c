import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { NewsSourceProvenance } from "../types";

/** Hostname for display, or the raw value if it doesn't parse. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The Sources panel — the visible "multi-source, no bluff" proof on a news draft
 * (News Desk req. #4). Lists the corroborating sources from the idea's
 * sourceProvenance[] with their role + trust, primary first.
 */
export function SourcesPanel({ provenance }: { provenance?: NewsSourceProvenance[] }) {
  if (!provenance?.length) {
    return <p className="text-xs text-muted-foreground">No sources recorded.</p>;
  }
  // Primary first, then supporting, then validation.
  const order: Record<string, number> = { primary: 0, supporting: 1, validation: 2 };
  const sorted = [...provenance].sort((a, b) => (order[a.contribution] ?? 9) - (order[b.contribution] ?? 9));

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Backed by {provenance.length} {provenance.length === 1 ? "source" : "sources"}
      </p>
      <ul className="space-y-1.5">
        {sorted.map((p, i) => (
          <li key={p.sourceId ?? p.externalUrl ?? i} className="flex items-center gap-2 text-sm">
            <Badge
              variant={p.contribution === "primary" ? "default" : "secondary"}
              className="shrink-0 text-[10px] capitalize"
            >
              {p.contribution}
            </Badge>
            {p.externalUrl ? (
              <a
                href={p.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 items-center gap-1 truncate text-primary hover:underline"
                title={p.externalUrl}
              >
                <span className="truncate">{hostOf(p.externalUrl)}</span>
                <ExternalLink className="size-3 shrink-0" aria-hidden />
              </a>
            ) : (
              <span className="truncate text-muted-foreground">{p.sourceType} source</span>
            )}
            {typeof p.trustScoreAtTime === "number" && (
              <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                trust {Math.round(p.trustScoreAtTime * 100)}%
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
