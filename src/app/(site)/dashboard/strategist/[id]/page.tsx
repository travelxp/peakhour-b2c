"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { PipelineStatusBadge } from "../components/status-badge";
import { PipelineStepper, STAGE_PANEL_MAP } from "../components/pipeline-stepper";
import { IdeaCardActions } from "../components/idea-card-actions";
import { ArrowLeft, Loader2, GitCompare } from "lucide-react";
import { ACTION_LABELS, IdeaDetail, Panel } from "./_components/shared";
import { OverviewTab } from "./_components/overview-tab";

// Only the open step's panel is mounted, so each other panel loads on demand.
const panelLoading = () => (
  <div className="flex justify-center py-12" aria-busy="true">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);
const BriefTab = dynamic(() => import("./_components/brief-tab").then((m) => m.BriefTab), { loading: panelLoading });
const WriteTab = dynamic(() => import("./_components/write-tab").then((m) => m.WriteTab), { loading: panelLoading });
const ReviewTab = dynamic(() => import("./_components/review-tab").then((m) => m.ReviewTab), { loading: panelLoading });
const PublishTab = dynamic(() => import("./_components/publish-tab").then((m) => m.PublishTab), { loading: panelLoading });
const VersionsTab = dynamic(() => import("./_components/versions-tab").then((m) => m.VersionsTab), { loading: panelLoading });

/* ── SSE stream reader (reusable for any streaming action) ── */

export default function IdeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const ideaId = params.id as string;
  const [activePanel, setActivePanel] = useState<Panel>("overview");
  const [loading, setLoading] = useState<string | null>(null);

  const { data: idea, isLoading } = useQuery({
    queryKey: ["idea-detail", ideaId],
    queryFn: () => api.get<IdeaDetail>(`/v1/content/ideas/${ideaId}`),
  });

  // Sync activePanel with idea.status when status changes (without setState-in-effect).
  // Track the last seen status; when it changes, derive the new panel during render.
  const [lastSyncedStatus, setLastSyncedStatus] = useState<string | undefined>(undefined);
  if (idea?.status && idea.status !== lastSyncedStatus) {
    setLastSyncedStatus(idea.status);
    setActivePanel((STAGE_PANEL_MAP[idea.status] || "overview") as Panel);
  }

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["idea-detail", ideaId] });
    queryClient.invalidateQueries({ queryKey: ["pipeline-ideas"] });
  }, [queryClient, ideaId]);

  /**
   * Returns true on success, false on caught failure. Existing callers
   * (approve / submit-review / schedule / publish) ignore the return
   * — fire-and-forget. The reject flow uses the boolean to bridge
   * into RejectReasonDialog's "throw to stay open" contract: the
   * dialog auto-closes on resolve, so a swallowed-error void return
   * would close the dialog after a failed reject.
   */
  async function action(path: string, body?: Record<string, unknown>): Promise<boolean> {
    setLoading(path);
    try {
      await api.post(`/v1/content/ideas/${ideaId}/${path}`, body || {});
      refresh();
      toast.success(ACTION_LABELS[path] || "Done");
      setLoading(null);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
      setLoading(null);
      return false;
    }
  }

  if (isLoading || !idea) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/strategist")}
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pipeline
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <PipelineStatusBadge status={idea.status} />
              {idea.aiScore != null && (
                <Badge variant="secondary" className="text-xs">Score: {idea.aiScore}</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{idea.title}</h1>
            {idea.description && (
              <p className="mt-1 max-w-2xl text-muted-foreground">{idea.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <IdeaCardActions
              ideaId={idea._id}
              title={idea.title}
              starred={!!idea.starred}
              size="md"
              onChanged={(change) => {
                if (change.deleted) {
                  router.push("/dashboard/strategist");
                } else {
                  queryClient.invalidateQueries({ queryKey: ["idea-detail", ideaId] });
                }
              }}
            />
            <div className="flex flex-wrap justify-end gap-2">
              {idea.sector && <Badge variant="outline">{idea.sector}</Badge>}
              {idea.contentType && <Badge variant="secondary">{idea.contentType}</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Stepper — clickable, replaces tabs */}
      <PipelineStepper
        currentStatus={idea.status}
        activePanel={activePanel === "versions" ? "publish" : activePanel}
        onStepClick={(panel) => setActivePanel(panel as Panel)}
      />

      {/* Versions tab is shown as a secondary link when content has
          ever been sent (any acceptanceRate present, or status reached
          published). Keeps the main stepper visually clean — the
          Versions view is for post-publish credibility surfacing
          (locked decision L7), not part of the editorial flow. */}
      {(idea.content?.finalAcceptanceRate !== undefined ||
        idea.content?.aiAcceptanceRate !== undefined ||
        idea.status === "published") && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === "versions" ? "publish" : "versions")}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              activePanel === "versions"
                ? "bg-primary text-primary-foreground"
                : "border bg-background hover:bg-accent"
            }`}
          >
            <GitCompare className="h-3.5 w-3.5" />
            Versions {typeof idea.content?.finalAcceptanceRate === "number"
              ? `· AI contribution ${Math.round(idea.content.finalAcceptanceRate * 100)}%`
              : ""}
          </button>
        </div>
      )}

      {/* Content panel for active step */}
      <div>
        {activePanel === "overview" && <OverviewTab idea={idea} />}
        {activePanel === "brief" && <BriefTab idea={idea} ideaId={ideaId} onRefresh={refresh} />}
        {activePanel === "write" && <WriteTab idea={idea} ideaId={ideaId} onRefresh={refresh} />}
        {activePanel === "review" && (
          <ReviewTab
            idea={idea}
            loading={loading}
            onSubmitReview={() => action("submit-review")}
            onApprove={() => action("approve")}
            onReject={async (notes: string) => {
              // Throw on failure so RejectReasonDialog stays open;
              // resolve on success so it auto-closes.
              const ok = await action("reject-review", { notes });
              if (!ok) throw new Error("reject-review failed");
            }}
          />
        )}
        {activePanel === "publish" && <PublishTab idea={idea} loading={loading} onPublish={() => action("publish")} onScheduled={refresh} />}
        {activePanel === "versions" && <VersionsTab ideaId={ideaId} />}
      </div>
    </div>
  );
}
