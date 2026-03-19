"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface ContentMatch {
  _id: string;
  title: string;
  webUrl?: string;
  adScore?: number;
  sectors?: string[];
  sentiment?: string;
}

/**
 * Renders text with content references (#24, Daily #24, etc.) as
 * hoverable links. On hover shows preview, on click opens content detail.
 */
export function ContentLinkedText({ text }: { text: string }) {
  // Match patterns: #24, Daily #24, Quests Daily #24, "Your Daily #24"
  const refPattern = /(?:(?:Quests\s+)?Daily\s+)?#(\d+)/gi;
  const parts: { type: "text" | "ref"; content: string; num?: string }[] = [];

  let lastIndex = 0;
  let match;
  while ((match = refPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "ref", content: match[0], num: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  if (parts.every((p) => p.type === "text")) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.type === "text" ? (
          <span key={i}>{part.content}</span>
        ) : (
          <ContentRefLink key={i} display={part.content} searchNum={part.num!} />
        )
      )}
    </>
  );
}

function ContentRefLink({ display, searchNum }: { display: string; searchNum: string }) {
  const [match, setMatch] = useState<ContentMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [searched, setSearched] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async () => {
    if (searched) return;
    setSearched(true);
    setLoading(true);
    try {
      const results = await api.get<ContentMatch[]>("/v1/content/search", { q: `#${searchNum}` });
      if (results.length > 0) {
        // Find best match — title contains the number
        const best = results.find((r) => r.title.includes(`#${searchNum}`)) || results[0];
        setMatch(best);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [searchNum, searched]);

  function handleMouseEnter() {
    search();
    timeoutRef.current = setTimeout(() => setShowPreview(true), 300);
  }

  function handleMouseLeave() {
    clearTimeout(timeoutRef.current);
    setShowPreview(false);
  }

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  if (!match && searched && !loading) {
    // No match found — render as plain text
    return <span>{display}</span>;
  }

  return (
    <span
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <a
        href={match ? `/dashboard/content/${match._id}` : "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary cursor-pointer font-medium"
        onClick={(e) => {
          if (!match) e.preventDefault();
        }}
      >
        {display}
      </a>

      {/* Hover preview */}
      {showPreview && match && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-72 rounded-lg border bg-popover p-3 shadow-lg animate-in fade-in-0 zoom-in-95">
          <p className="text-sm font-medium leading-tight">{match.title}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {match.adScore && (
              <Badge variant={match.adScore >= 7 ? "default" : "secondary"} className="text-xs">
                Score: {match.adScore}
              </Badge>
            )}
            {match.sentiment && (
              <Badge variant="outline" className="text-xs">{match.sentiment}</Badge>
            )}
            {match.sectors?.slice(0, 2).map((s) => (
              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Click to open in new tab</p>
        </div>
      )}
    </span>
  );
}
