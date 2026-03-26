"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useTicketDetail,
  useUpdateTicketStatus,
  useAddComment,
  useReanalyzeTicket,
} from "@/hooks/use-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Brain,
  Loader2,
  MessageSquare,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  AlertCircle,
  XCircle,
} from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  acknowledged: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  informational: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
};

const SEVERITY_ICONS: Record<string, React.ElementType> = {
  critical: XCircle,
  high: AlertCircle,
  medium: AlertTriangle,
  low: Info,
  informational: Info,
};

const PRIORITY_LABELS: Record<string, string> = {
  immediate: "Immediate",
  next_sprint: "Next Sprint",
  backlog: "Backlog",
};

const EFFORT_LABELS: Record<string, string> = {
  trivial: "Trivial",
  small: "Small",
  medium: "Medium",
  large: "Large",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FeedbackAdminDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const { data: ticket, isLoading } = useTicketDetail(ticketId);

  const [newStatus, setNewStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentInternal, setCommentInternal] = useState(true);

  const updateStatus = useUpdateTicketStatus(ticketId);
  const addComment = useAddComment(ticketId);
  const reanalyze = useReanalyzeTicket(ticketId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Ticket not found
      </div>
    );
  }

  const ai = ticket.aiAnalysis;
  const SeverityIcon = ai?.severity ? SEVERITY_ICONS[ai.severity] ?? Info : Info;

  async function handleStatusUpdate() {
    if (!newStatus) return;
    const data: { status: string; priority?: number; resolution?: { notes: string } } = { status: newStatus };
    if (priority) data.priority = parseInt(priority, 10);
    if (newStatus === "resolved" && resolutionNotes.trim()) {
      data.resolution = { notes: resolutionNotes.trim() };
    }
    await updateStatus.mutateAsync(data);
    setNewStatus("");
    setResolutionNotes("");
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    await addComment.mutateAsync({
      body: commentText.trim(),
      internal: commentInternal,
    });
    setCommentText("");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/settings/feedback-admin">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight font-mono">
            {ticket.ticketNumber}
          </h1>
          <Badge
            className={STATUS_STYLES[ticket.status] ?? ""}
            variant="secondary"
          >
            {ticket.status.replace("_", " ")}
          </Badge>
          <Badge variant="outline">{ticket.category}</Badge>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* User Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">User Description</CardTitle>
              <CardDescription>
                Submitted by {ticket.createdByName || "Unknown"} on{" "}
                {formatDate(ticket.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          {/* Context */}
          {ticket.context && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Context</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {ticket.context.url && (
                    <div>
                      <span className="text-muted-foreground">URL:</span>{" "}
                      <span className="break-all">{ticket.context.url}</span>
                    </div>
                  )}
                  {ticket.context.module && (
                    <div>
                      <span className="text-muted-foreground">Module:</span>{" "}
                      <Badge variant="outline">{ticket.context.module}</Badge>
                    </div>
                  )}
                  {ticket.context.entityType && (
                    <div>
                      <span className="text-muted-foreground">Entity:</span>{" "}
                      {ticket.context.entityType}
                      {ticket.context.entityId && (
                        <span className="ml-1 font-mono text-xs text-muted-foreground">
                          ({ticket.context.entityId})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline: Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="size-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticket.comments && ticket.comments.length > 0 ? (
                ticket.comments.map((comment) => (
                  <div
                    key={comment._id}
                    className={`rounded-lg border p-3 space-y-1 ${
                      comment.internal
                        ? "border-dashed bg-muted/30"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {comment.createdByName || "System"}
                        </span>
                        {comment.internal && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1"
                          >
                            internal
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px] px-1">
                          {comment.type}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {comment.body}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No comments yet.
                </p>
              )}

              {/* Add Comment */}
              <div className="space-y-3 pt-3 border-t">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={commentInternal}
                      onChange={(e) => setCommentInternal(e.target.checked)}
                      className="rounded"
                    />
                    Internal only (not visible to user)
                  </label>
                  <Button
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || addComment.isPending}
                  >
                    {addComment.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Add Comment"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">
          {/* AI Analysis */}
          {ai ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="size-4" />
                    AI Analysis
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => reanalyze.mutate()}
                    disabled={reanalyze.isPending}
                  >
                    {reanalyze.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                  </Button>
                </div>
                {ai.analyzedAt && (
                  <CardDescription className="text-xs">
                    Analyzed {formatDate(ai.analyzedAt)}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Severity */}
                <div className="flex items-center gap-2">
                  <SeverityIcon className="size-4" />
                  <Badge
                    className={SEVERITY_STYLES[ai.severity] ?? ""}
                    variant="secondary"
                  >
                    {ai.severity}
                  </Badge>
                  {ai.categoryRefined !== ticket.category && (
                    <Badge variant="outline" className="text-xs">
                      {ai.categoryRefined}
                    </Badge>
                  )}
                </div>

                {/* Sentiment */}
                <div className="text-xs text-muted-foreground">
                  Sentiment: <span className="font-medium">{ai.sentiment}</span>
                </div>

                {/* Summary */}
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    Summary
                  </h4>
                  <p className="text-sm">{ai.summary}</p>
                </div>

                {/* Root Cause */}
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    Root Cause Hypothesis
                  </h4>
                  <p className="text-sm">{ai.rootCauseHypothesis}</p>
                </div>

                {/* Suggested Actions */}
                {ai.suggestedActions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      Suggested Actions
                    </h4>
                    {ai.suggestedActions.map((action, i) => (
                      <div
                        key={i}
                        className="rounded-md border p-2 space-y-1"
                      >
                        <p className="text-sm">{action.action}</p>
                        <div className="flex gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {PRIORITY_LABELS[action.priority] ?? action.priority}
                          </Badge>
                          {action.effort && (
                            <Badge variant="outline" className="text-[10px]">
                              {EFFORT_LABELS[action.effort] ?? action.effort}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Affected Modules */}
                {ai.affectedModules.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      Affected Modules
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {ai.affectedModules.map((mod) => (
                        <Badge key={mod} variant="outline" className="text-xs">
                          {mod}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8">
                <Brain className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  AI analysis pending...
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reanalyze.mutate()}
                  disabled={reanalyze.isPending}
                >
                  {reanalyze.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 size-4" />
                  )}
                  Run Analysis
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Update Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Change status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Set priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">P1 - Critical</SelectItem>
                    <SelectItem value="2">P2 - High</SelectItem>
                    <SelectItem value="3">P3 - Medium</SelectItem>
                    <SelectItem value="4">P4 - Low</SelectItem>
                    <SelectItem value="5">P5 - Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resolution notes (visible when resolved) */}
              {newStatus === "resolved" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Resolution Notes
                  </label>
                  <Textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="How was this resolved?"
                    rows={3}
                  />
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleStatusUpdate}
                disabled={!newStatus || updateStatus.isPending}
              >
                {updateStatus.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 size-4" />
                )}
                Save Changes
              </Button>

              {updateStatus.isError && (
                <p className="text-sm text-destructive">
                  Failed to update. Please try again.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
