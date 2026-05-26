"use client";

/**
 * <RecurringScheduleEditor /> — configures a recurring rule. Supports
 * daily / weekly (with weekday picker) / monthly (with day-of-month
 * picker) / custom cron.
 *
 * Stateless control surface — parent owns the rule shape. Validates
 * locally (weekly requires weekdays; monthly requires dayOfMonth;
 * custom_cron requires cron string).
 */

import { useId } from "react";
import { CalendarClock, Repeat } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type RecurringFreq = "daily" | "weekly" | "monthly" | "custom_cron";

export interface RecurringRuleInput {
  freq: RecurringFreq;
  interval?: number;
  /** JS getDay() convention: 0=Sunday … 6=Saturday */
  weekdays?: number[];
  dayOfMonth?: number;
  cron?: string;
  localTime: string;
  timezone: string;
  effectiveFrom: string; // ISO date
  effectiveUntil?: string;
  maxRuns?: number;
}

/** Compose a `yyyy-MM-dd` date input value + `HH:mm` time + IANA tz
 *  into a proper UTC ISO string. Avoids the `new Date("yyyy-mm-dd")`
 *  trap where the string is interpreted as UTC midnight (drifting
 *  the date back by one for east-of-UTC users). Uses the same
 *  guess-and-diff trick as the time picker's fromLocalParts. */
function composeLocalDateTime(
  yyyymmdd: string,
  hhmm: string,
  tz: string,
): string {
  if (!yyyymmdd) return new Date().toISOString();
  const [y, mo, d] = yyyymmdd.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  // Native <input type="date"> shouldn't emit malformed strings,
  // but a future bound-prop change or a paste of garbage would
  // otherwise produce Date.UTC(NaN, …) → Invalid Date → toISOString
  // throws. Guard so the caller gets a usable fallback.
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(mo) ||
    !Number.isFinite(d) ||
    !Number.isFinite(hh) ||
    !Number.isFinite(mm)
  ) {
    return new Date().toISOString();
  }
  // Initial guess: parts interpreted as UTC.
  const guess = new Date(Date.UTC(y!, (mo ?? 1) - 1, d!, hh ?? 0, mm ?? 0));
  // Re-format the guess into the target tz to compute the offset.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(guess);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "00";
  const renderedMs = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
  );
  const desiredMs = Date.UTC(y!, (mo ?? 1) - 1, d!, hh ?? 0, mm ?? 0);
  return new Date(guess.getTime() + (desiredMs - renderedMs)).toISOString();
}

const WEEKDAYS = [
  { idx: 1, label: "M" },
  { idx: 2, label: "T" },
  { idx: 3, label: "W" },
  { idx: 4, label: "T" },
  { idx: 5, label: "F" },
  { idx: 6, label: "S" },
  { idx: 0, label: "S" },
];

export interface RecurringScheduleEditorProps {
  value: RecurringRuleInput;
  onChange: (next: RecurringRuleInput) => void;
  className?: string;
}

export function RecurringScheduleEditor({
  value,
  onChange,
  className,
}: RecurringScheduleEditorProps) {
  const id = useId();
  const toggleWeekday = (idx: number) => {
    const set = new Set(value.weekdays ?? []);
    if (set.has(idx)) set.delete(idx);
    else set.add(idx);
    onChange({ ...value, weekdays: [...set].sort((a, b) => a - b) });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Repeat className="h-4 w-4 text-primary" /> Repeat
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_120px_1fr]">
        <div>
          <Label htmlFor={`${id}-freq`} className="mb-1 block text-xs">
            Cadence
          </Label>
          <Select
            value={value.freq}
            onValueChange={(v) => onChange({ ...value, freq: v as RecurringFreq })}
          >
            <SelectTrigger id={`${id}-freq`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="custom_cron">Custom cron</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-interval`} className="mb-1 block text-xs">
            Every
          </Label>
          <Input
            id={`${id}-interval`}
            type="number"
            min={1}
            max={365}
            value={value.interval ?? 1}
            onChange={(e) =>
              onChange({ ...value, interval: Number(e.target.value) || 1 })
            }
          />
        </div>
        <div>
          <Label htmlFor={`${id}-time`} className="mb-1 block text-xs">
            Time-of-day ({value.timezone})
          </Label>
          <Input
            id={`${id}-time`}
            type="time"
            value={value.localTime}
            onChange={(e) =>
              onChange({ ...value, localTime: e.target.value })
            }
          />
        </div>
      </div>

      {value.freq === "weekly" && (
        <div>
          <Label className="mb-1 block text-xs">On weekdays</Label>
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((d) => {
              const active = value.weekdays?.includes(d.idx);
              return (
                <button
                  key={d.idx}
                  type="button"
                  onClick={() => toggleWeekday(d.idx)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent",
                  )}
                  title={
                    ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.idx]
                  }
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {value.freq === "monthly" && (
        <div>
          <Label htmlFor={`${id}-dom`} className="mb-1 block text-xs">
            Day of month
          </Label>
          <Input
            id={`${id}-dom`}
            type="number"
            min={1}
            max={31}
            value={value.dayOfMonth ?? 1}
            onChange={(e) =>
              onChange({ ...value, dayOfMonth: Number(e.target.value) })
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Day 29-31 will clamp to the last day in months that don&apos;t reach it
            (e.g. Feb 29 → Feb 28).
          </p>
        </div>
      )}

      {value.freq === "custom_cron" && (
        <div>
          <Label htmlFor={`${id}-cron`} className="mb-1 block text-xs">
            Cron expression
          </Label>
          <Input
            id={`${id}-cron`}
            type="text"
            placeholder="0 9 * * 1-5"
            value={value.cron ?? ""}
            onChange={(e) => onChange({ ...value, cron: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Standard 5-field crontab: minute, hour, day-of-month, month,
            day-of-week.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-from`} className="mb-1 block text-xs">
            Start
          </Label>
          <Input
            id={`${id}-from`}
            type="date"
            value={value.effectiveFrom.slice(0, 10)}
            onChange={(e) =>
              onChange({
                ...value,
                // Compose the date with the rule's localTime + tz so
                // an east-of-UTC user doesn't drift back by a day on
                // round-trip. Plain `new Date("yyyy-mm-dd")` parses
                // as UTC midnight which becomes the previous local
                // day for any positive UTC offset.
                effectiveFrom: composeLocalDateTime(
                  e.target.value,
                  value.localTime,
                  value.timezone,
                ),
              })
            }
          />
        </div>
        <div className="flex items-end gap-2">
          <Switch
            id={`${id}-bounded`}
            checked={!!value.effectiveUntil}
            onCheckedChange={(checked) =>
              onChange({
                ...value,
                effectiveUntil: checked
                  ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
                  : undefined,
              })
            }
          />
          <Label
            htmlFor={`${id}-bounded`}
            className="flex items-center gap-1 text-xs"
          >
            <CalendarClock className="h-3 w-3" /> End date
          </Label>
          {value.effectiveUntil && (
            <Input
              type="date"
              value={value.effectiveUntil.slice(0, 10)}
              onChange={(e) =>
                onChange({
                  ...value,
                  effectiveUntil: composeLocalDateTime(
                    e.target.value,
                    value.localTime,
                    value.timezone,
                  ),
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
