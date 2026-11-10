"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitCompare } from "lucide-react";
import { sanitizeContentHtml } from "./shared";

/**
 * Versions tab — 3-column side-by-side of aiOriginal / userEdited /
 * sent with the AI contribution % badge from segmentDiff. Owner /
 * admin / editor visible per locked decision L7 — this is the
 * credibility surface for "the AI did N% of this, you tailored M%".
 *
 * Reads GET /v1/content/ideas/:id/versions. When versions.sent is
 * absent, falls back to 2-column (Original / Current editor) with
 * the legacy in-editor aiAcceptanceRate.
 *
 * Per-paragraph color bands not rendered in v1 — segmentDiff data
 * is fetched and the headline % is computed from it, but the
 * detailed segment annotations are deferred to a follow-up
 * <SegmentDiffView> atomic. The headline scalar covers the L7
 * use case; the granular gutter view is incremental polish.
 */
export function VersionsTab({ ideaId }: { ideaId: string }) {
  type VersionSnapshot = {
    html?: string;
    plainText?: string;
    wordCount?: number;
    generatedAt?: string;
    sentAt?: string;
    capturedAt?: string;
    writerSkill?: string;
  };
  type VersionsResponse = {
    ideaId: string;
    title: string;
    contentFormat: string | null;
    versions: {
      aiOriginal: VersionSnapshot | null;
      userEdited: VersionSnapshot | null;
      sent: VersionSnapshot | null;
    };
    inEditor: {
      html: string | null;
      plainText: string | null;
      wordCount: number | null;
      lastEditedAt: string | null;
      version: number | null;
    };
    segmentDiff: Array<{
      band: "kept" | "lightly_edited" | "rewritten" | "removed" | "added";
      aiText?: string;
      sentText?: string;
      wordCount: number;
      paragraphIndex: number;
    }>;
    finalAcceptanceRate: number | null;
    finalEditCount: number | null;
    aiAcceptanceRate: number | null;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["idea-versions", ideaId],
    queryFn: () => api.get<VersionsResponse>(`/v1/content/ideas/${ideaId}/versions`),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Failed to load versions. {error instanceof Error ? error.message : ""}
        </CardContent>
      </Card>
    );
  }

  const hasSent = !!data.versions.sent;
  const aiContribPct = typeof data.finalAcceptanceRate === "number"
    ? Math.round(data.finalAcceptanceRate * 100)
    : typeof data.aiAcceptanceRate === "number"
      ? Math.round(data.aiAcceptanceRate * 100)
      : null;

  const bandStats = data.segmentDiff.reduce(
    (acc, e) => {
      acc[e.band] = (acc[e.band] ?? 0) + e.wordCount;
      return acc;
    },
    {} as Record<string, number>,
  );
  const totalSentWords = Object.values(bandStats).reduce((s, n) => s + n, 0);
  const bandPct = (b: string) =>
    totalSentWords > 0 ? Math.round(((bandStats[b] ?? 0) / totalSentWords) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <GitCompare className="h-4 w-4" /> AI contribution
            {aiContribPct !== null && (
              <Badge variant={aiContribPct >= 70 ? "default" : aiContribPct >= 40 ? "secondary" : "destructive"} className="ml-1 text-xs">
                {aiContribPct}%
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            {hasSent
              ? "Computed from the version subscribers actually received vs the AI's original draft."
              : aiContribPct !== null
                ? "In-editor similarity vs the AI's original draft. Final number lands once the post is sent in Beehiiv."
                : "AI contribution % will appear here once the post is sent in Beehiiv."}
          </CardDescription>
        </CardHeader>
        {data.segmentDiff.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { key: "kept", label: "Kept", color: "bg-success" },
                { key: "lightly_edited", label: "Tweaked", color: "bg-warning" },
                { key: "rewritten", label: "Rewritten", color: "bg-destructive" },
                { key: "added", label: "Added by you", color: "bg-state-info" },
              ].map((b) => (
                <div key={b.key} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className={`h-2 w-2 rounded-full ${b.color}`} aria-hidden />
                    <span className="text-xs text-muted-foreground">{b.label}</span>
                  </div>
                  <p className="text-lg font-semibold">{bandPct(b.key)}%</p>
                </div>
              ))}
            </div>
            {(data.finalEditCount ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {data.finalEditCount} paragraph(s) changed between AI draft and sent version.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <div className={`grid gap-4 ${hasSent ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <VersionColumn
          label="AI Original"
          sublabel={data.versions.aiOriginal?.writerSkill ? `via ${data.versions.aiOriginal.writerSkill}` : "What we generated"}
          tone="bg-success/10 border-success/30"
          html={data.versions.aiOriginal?.html ?? null}
          wordCount={data.versions.aiOriginal?.wordCount}
          timestamp={data.versions.aiOriginal?.generatedAt}
          timestampLabel="Generated"
        />
        <VersionColumn
          label="You Edited"
          sublabel="Latest state in our editor or Beehiiv"
          tone="bg-warning/10 border-warning/30"
          html={data.versions.userEdited?.html ?? data.inEditor.html}
          wordCount={data.versions.userEdited?.wordCount ?? data.inEditor.wordCount ?? undefined}
          timestamp={data.versions.userEdited?.capturedAt ?? data.inEditor.lastEditedAt ?? undefined}
          timestampLabel="Last edit"
        />
        {hasSent && (
          <VersionColumn
            label="Actually Sent"
            sublabel="What subscribers received"
            tone="bg-state-info/10 border-state-info/30"
            html={data.versions.sent?.html ?? null}
            wordCount={data.versions.sent?.wordCount}
            timestamp={data.versions.sent?.sentAt}
            timestampLabel="Sent"
          />
        )}
      </div>
    </div>
  );
}

function VersionColumn({
  label,
  sublabel,
  tone,
  html,
  wordCount,
  timestamp,
  timestampLabel,
}: {
  label: string;
  sublabel?: string;
  tone: string;
  html: string | null;
  wordCount?: number;
  timestamp?: string;
  timestampLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className={`${tone} border-b rounded-t-lg py-3`}>
        <CardTitle className="text-sm">{label}</CardTitle>
        {sublabel && <CardDescription className="text-[11px]">{sublabel}</CardDescription>}
        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
          {typeof wordCount === "number" && <span>{wordCount} words</span>}
          {timestamp && (
            <>
              <span aria-hidden>·</span>
              <span>{timestampLabel}: {new Date(timestamp).toLocaleString()}</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="max-h-[36rem] overflow-y-auto p-4">
        {html
          ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(html) }} />
          : <p className="text-xs text-muted-foreground italic">Not available.</p>}
      </CardContent>
    </Card>
  );
}
