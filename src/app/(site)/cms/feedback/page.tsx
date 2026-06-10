"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminTickets, type FeedbackTicket } from "@/hooks/use-feedback";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Inbox } from "lucide-react";

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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CmsFeedbackPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const params: Record<string, string> = {};
  if (statusFilter !== "all") params.status = statusFilter;
  if (severityFilter !== "all") params.severity = severityFilter;

  const { data: tickets, isLoading } = useAdminTickets(
    Object.keys(params).length > 0 ? params : undefined
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Feedback Tickets
        </h1>
        <p className="text-sm text-muted-foreground">
          Review user feedback with AI-powered triage.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="informational">Informational</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ticket List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Inbox className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No tickets match the current filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <TicketRow key={ticket._id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketRow({ ticket }: { ticket: FeedbackTicket }) {
  const ai = ticket.aiAnalysis;

  return (
    <Link href={`/cms/feedback/${ticket._id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">
                  {ticket.ticketNumber}
                </span>
                <Badge
                  className={STATUS_STYLES[ticket.status] ?? ""}
                  variant="secondary"
                >
                  {ticket.status.replace("_", " ")}
                </Badge>
                {ai?.severity && (
                  <Badge
                    className={SEVERITY_STYLES[ai.severity] ?? ""}
                    variant="secondary"
                  >
                    {ai.severity}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {ticket.category}
                </Badge>
                {ticket.context?.module && (
                  <Badge variant="outline" className="text-xs">
                    {ticket.context.module}
                  </Badge>
                )}
              </div>

              <p className="text-sm truncate">
                {ai?.summary || ticket.description}
              </p>

              {ai?.suggestedActions && ai.suggestedActions.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {ai.suggestedActions.slice(0, 2).map((action, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs"
                    >
                      {action.action.length > 60
                        ? action.action.slice(0, 60) + "..."
                        : action.action}
                    </span>
                  ))}
                  {ai.suggestedActions.length > 2 && (
                    <span className="text-xs text-muted-foreground">
                      +{ai.suggestedActions.length - 2} more
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 text-right space-y-1">
              <p className="text-xs text-muted-foreground">
                {ticket.createdByName}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(ticket.createdAt)}
              </p>
              {ticket.priority && (
                <Badge variant="outline" className="text-xs">
                  P{ticket.priority}
                </Badge>
              )}
            </div>

            <ExternalLink className="size-4 shrink-0 text-muted-foreground mt-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
