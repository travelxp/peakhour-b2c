"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocale } from "@/hooks/use-locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/molecules";

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

import { ChannelIconCompact } from "@/components/ui/channel-icon";

const STATUS_COLORS: Record<string, string> = {
  brainstorm: "bg-slate-100 border-slate-200",
  planned: "bg-blue-50 border-blue-200",
  in_progress: "bg-amber-50 border-amber-200",
  published: "bg-green-50 border-green-200",
  archived: "bg-red-50 border-red-200 opacity-50",
};

export default function CalendarPage() {
  const { formatDate } = useLocale();
  const [view, setView] = useState<"week" | "month">("week");
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: ideas } = useQuery({
    queryKey: ["content-ideas"],
    queryFn: () => api.get<CalendarIdea[]>("/v1/content/ideas"),
  });

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
  const unscheduled = (ideas || []).filter((i) => !i.targetDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Content Calendar</h2>
          <p className="text-muted-foreground">
            Your scheduled and planned content
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => setView("week")}>
            Week
          </Button>
          <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => setView("month")}>
            Month
          </Button>
        </div>
      </div>

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
        <MonthView ideas={ideas || []} ideasByDate={ideasByDate} today={today} />
      )}

      {/* Unscheduled ideas */}
      {unscheduled.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-muted-foreground">
            Unscheduled ({unscheduled.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unscheduled.map((idea) => (
              <CalendarCard key={idea._id} idea={idea} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarCard({ idea, compact }: { idea: CalendarIdea; compact?: boolean }) {
  const statusColor = STATUS_COLORS[idea.status] || "bg-slate-50 border-slate-200";

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
            idea.aiScore >= 8 ? "text-green-600" : idea.aiScore >= 6 ? "text-amber-600" : "text-muted-foreground"
          }`}>
            {idea.aiScore}
          </span>
        )}
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {idea.sector && <Badge variant="secondary" className="text-[10px] h-5">{idea.sector}</Badge>}
          {idea.contentType && <Badge variant="outline" className="text-[10px] h-5">{idea.contentType}</Badge>}
          <StatusBadge status={idea.status} className="text-[10px] h-5" />
        </div>
      )}
    </div>
  );
}

function MonthView({ ideas, ideasByDate, today }: { ideas: CalendarIdea[]; ideasByDate: Map<string, CalendarIdea[]>; today: Date }) {
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
                  <p className="text-[10px] leading-tight line-clamp-1 font-medium">{idea.title}</p>
                  <div className="flex gap-0.5">
                    {idea.channels?.slice(0, 3).map((ch) => (
                      <ChannelIconCompact key={ch} channel={ch} size={10} />
                    ))}
                  </div>
                </div>
              ))}
              {dayIdeas.length > 2 && (
                <p className="text-[9px] text-muted-foreground">+{dayIdeas.length - 2} more</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
