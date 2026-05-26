"use client";

/**
 * <ScheduleTimePicker /> — best-in-world date+time+timezone control.
 *
 * Three quick-action chips above the inputs: "Next hour", "Tomorrow
 * morning", "Next Tuesday 9am" — covers ~80% of intent. Below: native
 * date + time inputs with the timezone displayed inline, plus a
 * collapsible advanced section for an explicit IANA timezone change.
 *
 * Native `<input type="date">` + `<input type="time">` give us OS-level
 * accessibility + locale formatting for free; no react-day-picker
 * dependency. We treat the inputs as the user's LOCAL wall-clock in the
 * declared timezone and convert to UTC at the boundary.
 *
 * Controlled component: parent owns the Date value (UTC) and the
 * timezone (IANA). The component re-renders both inputs whenever the
 * parent re-renders.
 */

import { useMemo, useState } from "react";
import { Calendar, Clock, ChevronDown, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { detectTimezone, formatTimeLabel } from "@/lib/scheduler/format";

export interface ScheduleTimePickerProps {
  /** Currently-selected scheduled instant (UTC). */
  value: Date;
  /** IANA timezone the user is composing in (`Asia/Kolkata`, …). */
  timezone: string;
  onChange: (next: { date: Date; timezone: string }) => void;
  /** Show the timezone-override row. Defaults to true. */
  allowTimezoneOverride?: boolean;
  className?: string;
}

/** Convert a UTC instant + IANA timezone into the local
 *  `yyyy-MM-ddTHH:mm` string the native input expects. */
function toLocalParts(d: Date, tz: string): { date: string; time: string } {
  // Format to ISO-ish parts in the target timezone via Intl.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** Convert local wall-clock parts + timezone back to a UTC Date.
 *  We construct a fake-UTC date from the parts, then compute the
 *  zone offset at that moment by re-rendering it in the target
 *  timezone and diffing — robust against DST transitions. */
function fromLocalParts(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // Start with a guess: the parts interpreted as UTC.
  const guess = new Date(Date.UTC(y!, (mo ?? 1) - 1, d!, hh ?? 0, mm ?? 0));
  // Render guess in target tz; compute the offset between the local
  // string that came out and the local string we wanted.
  const rendered = toLocalParts(guess, tz);
  const renderedMs = Date.UTC(
    Number(rendered.date.slice(0, 4)),
    Number(rendered.date.slice(5, 7)) - 1,
    Number(rendered.date.slice(8, 10)),
    Number(rendered.time.slice(0, 2)),
    Number(rendered.time.slice(3, 5)),
  );
  const desiredMs = Date.UTC(y!, (mo ?? 1) - 1, d!, hh ?? 0, mm ?? 0);
  return new Date(guess.getTime() + (desiredMs - renderedMs));
}

interface QuickAction {
  label: string;
  compute: (now: Date) => Date;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Next hour",
    compute: (now) => {
      const next = new Date(now);
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next;
    },
  },
  {
    label: "Tomorrow 9 am",
    compute: (now) => {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      return next;
    },
  },
  {
    label: "Next Tuesday 9 am",
    compute: (now) => {
      const next = new Date(now);
      const day = next.getDay();
      // Sunday=0, Monday=1, Tuesday=2.
      const delta = ((2 - day + 7) % 7) || 7;
      next.setDate(next.getDate() + delta);
      next.setHours(9, 0, 0, 0);
      return next;
    },
  },
];

export function ScheduleTimePicker({
  value,
  timezone,
  onChange,
  allowTimezoneOverride = true,
  className,
}: ScheduleTimePickerProps) {
  const [tzOpen, setTzOpen] = useState(false);
  const detected = useMemo(() => detectTimezone(), []);
  const parts = useMemo(() => toLocalParts(value, timezone), [value, timezone]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Quick-action chip row */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((q) => (
          <Button
            key={q.label}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-full px-3 text-xs"
            onClick={() => onChange({ date: q.compute(new Date()), timezone })}
          >
            {q.label}
          </Button>
        ))}
      </div>

      {/* Native date + time + inline timezone */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto]">
        <div>
          <Label
            htmlFor="schedule-date"
            className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Calendar className="h-3.5 w-3.5" /> Date
          </Label>
          <Input
            id="schedule-date"
            type="date"
            value={parts.date}
            onChange={(e) =>
              onChange({
                date: fromLocalParts(e.target.value, parts.time, timezone),
                timezone,
              })
            }
          />
        </div>
        <div>
          <Label
            htmlFor="schedule-time"
            className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Clock className="h-3.5 w-3.5" /> Time
          </Label>
          <Input
            id="schedule-time"
            type="time"
            value={parts.time}
            onChange={(e) =>
              onChange({
                date: fromLocalParts(parts.date, e.target.value, timezone),
                timezone,
              })
            }
          />
        </div>
        {allowTimezoneOverride && (
          <div className="flex flex-col">
            <Label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Globe className="h-3.5 w-3.5" /> Timezone
            </Label>
            <button
              type="button"
              onClick={() => setTzOpen((o) => !o)}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm text-foreground hover:bg-accent"
              aria-expanded={tzOpen}
            >
              <span className="truncate">{timezone}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
          </div>
        )}
      </div>

      {tzOpen && allowTimezoneOverride && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <Label
            htmlFor="schedule-tz"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            IANA timezone identifier (e.g. <code>Asia/Kolkata</code>)
          </Label>
          <Input
            id="schedule-tz"
            type="text"
            defaultValue={timezone}
            placeholder={detected}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== timezone) {
                onChange({ date: value, timezone: v });
                setTzOpen(false);
              }
            }}
          />
          {detected !== timezone && (
            <button
              type="button"
              onClick={() => {
                onChange({ date: value, timezone: detected });
                setTzOpen(false);
              }}
              className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
            >
              Use your local timezone ({detected})
            </button>
          )}
        </div>
      )}

      {/* Tiny preview row — confirms the resolved local time so the
          user catches AM/PM mistakes before scheduling. */}
      <div className="text-xs text-muted-foreground">
        Publishes at <b>{formatTimeLabel(value, timezone)}</b> {timezone}
      </div>
    </div>
  );
}
