"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { useLocale } from "@/hooks/use-locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/molecules";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { navLabel } from "@/lib/nav-copy";

interface CalendarIdea {
  _id: string;
  title: string;
  description?: string;
  status: string;
  sector?: string;
  targetAudience?: string;
  contentType?: string;
  angle?: string;
  aiScore?: number;
  channels?: string[];
  targetDate?: string;
  suggestedPublishTime?: string;
  createdAt: string;
}

import { ChannelIconCompact } from "@/components/brand/channel-icon";
import { QueryError } from "@/components/dashboard/query-error";
import { queryViewState } from "@/lib/query-view-state";

const STATUS_COLORS: Record<string, string> = {
  brainstorm: "bg-muted border-border",
  planned: "bg-state-info/10 border-state-info/30",
  in_progress: "bg-warning/10 border-warning/30",
  published: "bg-success/10 border-success/30",
  archived: "bg-muted border-border",
};

export default function IdeasCalendarPage() {
  const queryClient = useQueryClient();
  const { formatDate } = useLocale();
  const [view, setView] = useState<"week" | "month">("week");
  const [weekOffset, setWeekOffset] = useState(0);

  const ideasQuery = useQuery({
    queryKey: ["content-ideas"],
    queryFn: () => api.get<CalendarIdea[]>("/v1/content/ideas"),
  });
  const { data: ideas } = ideasQuery;
  const ideasView = queryViewState(ideasQuery);

  // Calculate week dates
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7); // Monday

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const isToday = (date: Date) => {
    const t = new Date();
    return date.toDateString() === t.toDateString();
  };

  // Group ideas by date
  const ideasByDate = new Map<string, CalendarIdea[]>();
  for (const idea of ideas || []) {
    if (idea.targetDate) {
      const dateKey = new Date(idea.targetDate).toDateString();
      if (!ideasByDate.has(dateKey)) ideasByDate.set(dateKey, []);
      ideasByDate.get(dateKey)!.push(idea);
    }
  }

  // Ideas without dates
  // Archived ideas are done with: they never belong in the working list.
  const unscheduled = (ideas || []).filter(
    (i) => !i.targetDate && i.status !== "archived",
  );
  const archived = (ideas || []).filter((i) => i.status === "archived");

  return (
    <PageShell width="full">
      <CronToolbar
        crons={["jobs-runner"]}
        onTriggered={() =>
          queryClient.invalidateQueries({ queryKey: ["content-ideas"] })
        }
      />
      <PageHeader
        title={navLabel("/dashboard/calendar")}
        description="Your scheduled and planned content"
        actions={
          <>
            <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => setView("week")}>
              Week
            </Button>
            <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => setView("month")}>
              Month
            </Button>
          </>
        }
      />

      {(ideasView === "error" || ideasView === "offline") && (
        <QueryError
          what="your planned ideas"
          kind={ideasView}
          onRetry={() => void ideasQuery.refetch()}
        />
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
          ← Previous
        </Button>
        <span className="text-sm font-medium">
          {formatDate(weekDays[0], { month: "long", day: "numeric" })}
          {" — "}
          {formatDate(weekDays[6], { month: "long", day: "numeric", year: "numeric" })}
        </span>
        <div className="flex gap-2">
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
            Next →
          </Button>
        </div>
      </div>

      {/* Week view */}
      {view === "week" && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateKey = day.toDateString();
            const dayIdeas = ideasByDate.get(dateKey) || [];
            const dayName = formatDate(day, { weekday: "short" });
            const dayNum = day.getDate();

            return (
              <div
                key={dateKey}
                className={`min-h-[200px] rounded-lg border p-2 ${
                  isToday(day) ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>
                    {dayName}
                  </span>
                  <span className={`text-sm font-bold ${isToday(day) ? "text-primary" : ""}`}>
                    {dayNum}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {dayIdeas.map((idea) => (
                    <CalendarCard key={idea._id} idea={idea} compact />
                  ))}
                  {dayIdeas.length === 0 && (
                    <p className="text-xs text-muted-foreground/50 text-center py-4">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month view */}
      {view === "month" && (
        <MonthView ideasByDate={ideasByDate} today={today} />
      )}

      {/* Unscheduled ideas */}
      {unscheduled.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-muted-foreground">
            Unscheduled ({unscheduled.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
            {unscheduled.map((idea) => (
              <CalendarCard key={idea._id} idea={idea} />
            ))}
          </div>
        </div>
      )}

      {/* Archived ideas: collapsed, muted but full-contrast text. */}
      {archived.length > 0 && (
        <details className="space-y-3">
          <summary className="cursor-pointer text-base font-semibold text-muted-foreground">
            Archived ({archived.length})
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
            {archived.map((idea) => (
              <CalendarCard key={idea._id} idea={idea} />
            ))}
          </div>
        </details>
      )}
    </PageShell>
  );
}

function CalendarCard({ idea, compact }: { idea: CalendarIdea; compact?: boolean }) {
  const statusColor = STATUS_COLORS[idea.status] || "bg-muted border-border";

  return (
    <div className={`rounded-md border p-2 ${statusColor} transition-colors hover:shadow-sm`}>
      <p className={`font-medium leading-tight ${compact ? "text-xs line-clamp-2" : "text-sm line-clamp-3"}`}>
        {idea.title}
      </p>

      {!compact && idea.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{idea.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-1 mt-1.5">
        {idea.channels?.map((ch) => (
          <ChannelIconCompact key={ch} channel={ch} size={12} />
        ))}
        {idea.aiScore && (
          <span className={`text-xs font-bold ml-auto ${
            idea.aiScore >= 8 ? "text-success-on-tint" : idea.aiScore >= 6 ? "text-warning-on-tint" : "text-muted-foreground"
          }`}>
            {idea.aiScore}
          </span>
        )}
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {idea.sector && <Badge variant="secondary" className="text-micro h-5">{idea.sector}</Badge>}
          {idea.contentType && <Badge variant="outline" className="text-micro h-5">{idea.contentType}</Badge>}
          <StatusBadge status={idea.status} className="text-micro h-5" />
        </div>
      )}
    </div>
  );
}

function MonthView({ ideasByDate, today }: { ideasByDate: Map<string, CalendarIdea[]>; today: Date }) {
  const { formatDate } = useLocale();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Monday = 0

  const days: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));

  return (
    <div>
      <h3 className="text-base font-semibold mb-3">
        {formatDate(today, { month: "long", year: "numeric" })}
      </h3>
      <div className="grid grid-cols-7 gap-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-xs font-medium text-muted-foreground text-center py-1">{d}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} className="min-h-[60px]" />;
          const dateKey = day.toDateString();
          const dayIdeas = ideasByDate.get(dateKey) || [];
          const isToday = day.toDateString() === today.toDateString();

          return (
            <div
              key={dateKey}
              className={`min-h-[60px] rounded border p-1 ${
                isToday ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <span className={`text-xs ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                {day.getDate()}
              </span>
              {dayIdeas.slice(0, 2).map((idea) => (
                <div key={idea._id} className="mt-0.5">
                  <p className="text-micro leading-tight line-clamp-1 font-medium">{idea.title}</p>
                  <div className="flex gap-0.5">
                    {idea.channels?.slice(0, 3).map((ch) => (
                      <ChannelIconCompact key={ch} channel={ch} size={10} />
                    ))}
                  </div>
                </div>
              ))}
              {dayIdeas.length > 2 && (
                <p className="text-micro text-muted-foreground">+{dayIdeas.length - 2} more</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
