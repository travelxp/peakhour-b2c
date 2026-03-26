"use client";

import { useState } from "react";
import { useMyTickets, useTicketDetail, type FeedbackTicket } from "@/hooks/use-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  acknowledged: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const CATEGORY_STYLES: Record<string, string> = {
  bug: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  feature: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  improvement: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  question: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={STATUS_STYLES[status] ?? ""} variant="secondary">
      {status.replace("_", " ")}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge className={CATEGORY_STYLES[category] ?? ""} variant="secondary">
      {category}
    </Badge>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyTicketsPage() {
  const { data: tickets, isLoading } = useMyTickets();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/settings">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Track your feedback submissions and their status.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <MessageSquare className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No tickets yet. Use the feedback button in the header to submit
              one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <Card
              key={ticket._id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => setSelectedId(ticket._id)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {ticket.ticketNumber}
                    </span>
                    <CategoryBadge category={ticket.category} />
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p className="truncate text-sm">{ticket.description}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(ticket.createdAt)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ticket Detail Sheet */}
      <TicketDetailSheet
        ticketId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function TicketDetailSheet({
  ticketId,
  onClose,
}: {
  ticketId: string | null;
  onClose: () => void;
}) {
  const { data: ticket } = useTicketDetail(ticketId ?? "");

  return (
    <Sheet open={!!ticketId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        {ticket ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span className="font-mono">{ticket.ticketNumber}</span>
                <StatusBadge status={ticket.status} />
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Meta */}
              <div className="flex flex-wrap gap-2">
                <CategoryBadge category={ticket.category} />
                {ticket.context?.module && (
                  <Badge variant="outline">{ticket.context.module}</Badge>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Description</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {ticket.description}
                </p>
              </div>

              {/* Resolution */}
              {ticket.resolution?.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Resolution</CardTitle>
                    <CardDescription>
                      {ticket.resolution.resolvedByName} &mdash;{" "}
                      {formatDate(ticket.resolution.resolvedAt)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{ticket.resolution.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Comments (public only for users) */}
              {ticket.comments && ticket.comments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Updates</h3>
                  {ticket.comments.map((comment) => (
                    <div
                      key={comment._id}
                      className="rounded-lg border p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                          {comment.createdByName || "Team"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {comment.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Submitted {formatDate(ticket.createdAt)}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-12">
            <Skeleton className="h-6 w-32" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
