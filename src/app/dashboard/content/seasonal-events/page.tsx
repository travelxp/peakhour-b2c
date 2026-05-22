"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────────

interface SeasonalEvent {
  name: string;
  /** 1..12 */
  month: number;
  relevance?: string;
  /** Year (YYYY) → ISO date (YYYY-MM-DD) — set for moving holidays. */
  dates?: Record<string, string>;
}

interface OrgDetails {
  _id: string;
  taxonomy?: {
    seasonalEvents?: SeasonalEvent[];
  } | null;
}

interface DateRow {
  rowId: string;
  year: string;
  date: string;
}

const MONTH_SHORT_NAMES = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function makeClientId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nextYearForRows(rows: DateRow[]): string {
  let maxValid = 0;
  for (const r of rows) {
    if (/^\d{4}$/.test(r.year)) {
      const n = parseInt(r.year, 10);
      if (n > maxValid) maxValid = n;
    }
  }
  const candidate = maxValid > 0 ? maxValid + 1 : new Date().getUTCFullYear();
  return candidate >= 1000 && candidate <= 9999 ? String(candidate) : "";
}

interface EventDateInfo {
  /** Display string for the primary date badge — e.g. "Sun · Nov 8"
   *  for precise events or "Nov" for static-month events. `null` when
   *  the event's month is out of range (malformed wire data). */
  primary: string | null;
  /** Human countdown to the next occurrence — e.g. "in 3 weeks",
   *  "tomorrow", "today". `null` when no useful next-occurrence date
   *  can be computed (e.g., a current-year date already passed and
   *  no next-year `dates[]` entry exists). */
  countdown: string | null;
  /** True when the badge text is derived from a precise YYYY-MM-DD
   *  in `dates[]`. False for the modal-month fallback. */
  precise: boolean;
}

/**
 * Build the date + countdown badge data for an event.
 *
 * Resolution order (mirrors the seasonal generator's `resolveEventOccurrence`
 * in peakhour-api):
 *   1. `dates[currentYear]` if it parses AND lies today-or-later
 *   2. `dates[currentYear + 1]` if it parses (year-wrap for events
 *      whose current-year date has already passed)
 *   3. Modal-month fallback for static-date events — synthesises a
 *      target of the 1st-of-month for the upcoming occurrence (this
 *      year if the month is today-or-later, next year otherwise).
 *      The badge shows just the month abbreviation; the countdown
 *      reads "in N weeks/months" using the synthesised target.
 *
 * Countdown buckets:
 *   - same UTC day  → "today"
 *   - 1 day         → "tomorrow"
 *   - 2..6 days     → "in N days"
 *   - 7..29 days    → "in N week[s]" (rounded)
 *   - 30+ days      → "in N month[s]" (rounded; 1y+ also rendered in months)
 */
function getEventDateInfo(event: SeasonalEvent, now: Date = new Date()): EventDateInfo {
  // Anchor "today" at UTC midnight so the bucket math is timezone-stable.
  const todayMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const currentYear = now.getUTCFullYear();

  function parseDate(iso: string | undefined): Date | null {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const d = new Date(`${iso}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatPrecise(d: Date): string {
    const weekday = d.toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
    const month = MONTH_SHORT_NAMES[d.getUTCMonth() + 1];
    const dayNum = d.getUTCDate();
    return `${weekday} · ${month} ${dayNum}`;
  }

  function formatCountdown(targetMs: number): string {
    const diffDays = Math.round((targetMs - todayMs) / 86_400_000);
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "tomorrow";
    if (diffDays < 0) return "passed"; // defensive; shouldn't hit on the year-wrap path
    if (diffDays < 7) return `in ${diffDays} days`;
    if (diffDays < 30) {
      const weeks = Math.max(1, Math.round(diffDays / 7));
      return `in ${weeks} week${weeks === 1 ? "" : "s"}`;
    }
    const months = Math.max(1, Math.round(diffDays / 30));
    return `in ${months} month${months === 1 ? "" : "s"}`;
  }

  // Precise path — try current-year first, fall back to year-wrap.
  const currentExact = parseDate(event.dates?.[String(currentYear)]);
  if (currentExact && currentExact.getTime() >= todayMs) {
    return {
      primary: formatPrecise(currentExact),
      countdown: formatCountdown(currentExact.getTime()),
      precise: true,
    };
  }
  const nextExact = parseDate(event.dates?.[String(currentYear + 1)]);
  if (nextExact) {
    return {
      primary: formatPrecise(nextExact),
      countdown: formatCountdown(nextExact.getTime()),
      precise: true,
    };
  }

  // Modal-month fallback — no precise date available. Synthesise a
  // first-of-month target for the countdown so operators still get an
  // "in N weeks/months" sense. Badge stays as just the month.
  const monthName = MONTH_SHORT_NAMES[event.month] ?? null;
  if (!monthName) {
    return { primary: null, countdown: null, precise: false };
  }
  // Pick this year if the modal month hasn't passed today, else next.
  const monthIndex = event.month - 1; // 0..11
  const thisYearTargetMs = Date.UTC(currentYear, monthIndex, 1);
  // "Has passed" = the modal month has fully ended. If today is in the
  // modal month or earlier, this year still applies.
  const targetMs =
    thisYearTargetMs + 31 * 86_400_000 < todayMs
      ? Date.UTC(currentYear + 1, monthIndex, 1)
      : Math.max(thisYearTargetMs, todayMs);
  return {
    primary: monthName,
    countdown: formatCountdown(targetMs),
    precise: false,
  };
}

// ── Page ─────────────────────────────────────────────────────────

/**
 * Seasonal Events page — list-row layout matching the trusted-sources
 * pattern (icon + name/meta on the left, 3-dot action menu on the
 * right). Each row's Edit / Delete actions live behind the 3-dot
 * dropdown; the page header carries an "Add event" button that opens
 * the same Dialog as Edit (empty initial state).
 *
 * Save semantics: each Edit / Delete / Add is its own atomic
 * `PUT /v1/dashboard/org` with the full updated array. No
 * page-level edit mode — the row is the unit of work.
 */
export default function SeasonalEventsPage() {
  const { org } = useAuth();
  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor state — `null` editorIndex means "new event"; a number is
  // the index of the event being edited.
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorIndex, setEditorIndex] = useState<number | null>(null);

  // Delete-confirm state
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!org?._id) return;
    setLoading(true);
    setError("");
    api
      .get<OrgDetails>("/v1/dashboard/org")
      .then(setOrgDetails)
      .catch(() => setError("Failed to load seasonal events. Please try again."))
      .finally(() => setLoading(false));
  }, [org?._id]);

  const events = orgDetails?.taxonomy?.seasonalEvents ?? [];

  async function persistEvents(next: SeasonalEvent[], successMessage: string) {
    try {
      await api.put("/v1/dashboard/org", {
        taxonomy: { seasonalEvents: next },
      });
      const updated = await api.get<OrgDetails>("/v1/dashboard/org");
      setOrgDetails(updated);
      toast.success(successMessage);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Save failed. Please try again.");
      throw err;
    }
  }

  async function handleSaveEvent(updatedEvent: SeasonalEvent) {
    // Editor delivers the wire-shape SeasonalEvent. Splice in at
    // editorIndex or append for new.
    const next =
      editorIndex === null
        ? [...events, updatedEvent]
        : events.map((e, i) => (i === editorIndex ? updatedEvent : e));
    await persistEvents(
      next,
      editorIndex === null
        ? `Added ${updatedEvent.name}`
        : `Updated ${updatedEvent.name}`,
    );
  }

  async function handleConfirmDelete() {
    if (deleteIndex === null) return;
    const target = events[deleteIndex];
    setDeleting(true);
    try {
      const next = events.filter((_, i) => i !== deleteIndex);
      await persistEvents(next, `Removed ${target.name}`);
      setDeleteIndex(null);
    } catch {
      // toast already fired in persistEvents; just keep the dialog
      // open so the operator can retry or cancel.
    } finally {
      setDeleting(false);
    }
  }

  function openEditor(index: number | null) {
    setEditorIndex(index);
    setEditorOpen(true);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading seasonal events">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  // Sort by month for a calendar-ish read order; same-month events
  // preserve their stored order. Track the original index so per-row
  // actions can splice the source array correctly even after sort.
  const indexedEvents = events.map((e, i) => ({ event: e, originalIndex: i }));
  indexedEvents.sort((a, b) => a.event.month - b.event.month);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
            Seasonal Events
          </h2>
          <p className="text-muted-foreground mt-1 max-w-prose">
            Cultural, national, and commercial moments the AI uses to plan
            seasonal content. Onboarding seeds these from your country&apos;s
            calendar; add, edit, or remove events to fine-tune what the
            seasonal generator sees. Exact dates show for the current year
            when a moving holiday (Diwali, Eid, Easter, …) has been mapped.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => openEditor(null)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add event
        </Button>
      </header>

      {error ? (
        <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {indexedEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No seasonal events yet. Click <span className="font-medium">Add event</span>{" "}
            to add a holiday, festival, or commercial moment relevant to your audience.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {indexedEvents.map(({ event: e, originalIndex }) => (
            <EventRow
              key={`${e.name}-${originalIndex}`}
              event={e}
              onEdit={() => openEditor(originalIndex)}
              onDelete={() => setDeleteIndex(originalIndex)}
            />
          ))}
        </div>
      )}

      <SeasonalEventEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editorIndex !== null ? events[editorIndex] : null}
        onSave={handleSaveEvent}
      />

      <AlertDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => !open && setDeleteIndex(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {deleteIndex !== null ? events[deleteIndex]?.name : "event"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The seasonal generator will no longer surface this event for your
              business. You can re-add it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Prevent the dialog auto-close before our async runs
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Row component ────────────────────────────────────────────────

function EventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: SeasonalEvent;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dateInfo = getEventDateInfo(event);
  const movingYears = event.dates ? Object.keys(event.dates).sort() : [];

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <div
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md border text-muted-foreground"
      >
        <CalendarDays className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-medium">{event.name}</h3>
          {dateInfo.primary ? (
            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
              {dateInfo.primary}
            </Badge>
          ) : null}
          {dateInfo.countdown ? (
            // Secondary countdown chip — kept muted so the date stays
            // the primary affordance. "passed" renders neutral too;
            // it's defensive (shouldn't fire on the year-wrap path).
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {dateInfo.countdown}
            </Badge>
          ) : null}
          {movingYears.length > 0 ? (
            <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
              moving · {movingYears.length}y mapped
            </Badge>
          ) : null}
        </div>
        {event.relevance ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {event.relevance}
          </p>
        ) : null}
      </div>

      <div className="shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${event.name}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Editor dialog (add or edit) ──────────────────────────────────

function SeasonalEventEditor({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: SeasonalEvent | null;
  onSave: (event: SeasonalEvent) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [month, setMonth] = useState(1);
  const [relevance, setRelevance] = useState("");
  const [dateRows, setDateRows] = useState<DateRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Re-seed form fields each time the dialog opens — handles both
  // edit (initial !== null) and add (initial === null) cases without
  // a separate mount/unmount cycle.
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setMonth(initial.month);
      setRelevance(initial.relevance ?? "");
      setDateRows(
        initial.dates
          ? Object.entries(initial.dates)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([year, date]) => ({ rowId: makeClientId(), year, date }))
          : [],
      );
    } else {
      setName("");
      setMonth(1);
      setRelevance("");
      setDateRows([]);
    }
  }, [open, initial]);

  function updateDateRow(rowId: string, patch: Partial<Pick<DateRow, "year" | "date">>) {
    setDateRows((rows) => rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }
  function removeDateRow(rowId: string) {
    setDateRows((rows) => rows.filter((r) => r.rowId !== rowId));
  }
  function addDateRow() {
    setDateRows((rows) => [
      ...rows,
      { rowId: makeClientId(), year: nextYearForRows(rows), date: "" },
    ]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    try {
      const dates: Record<string, string> = {};
      for (const row of dateRows) {
        if (!/^\d{4}$/.test(row.year)) continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
        dates[row.year] = row.date;
      }
      const wire: SeasonalEvent = {
        name: trimmedName,
        month,
      };
      const trimmedRelevance = relevance.trim();
      if (trimmedRelevance) wire.relevance = trimmedRelevance;
      if (Object.keys(dates).length > 0) wire.dates = dates;

      await onSave(wire);
      onOpenChange(false);
    } catch {
      // Parent toasted the error; keep the dialog open so the
      // operator can retry or cancel.
    } finally {
      setSaving(false);
    }
  }

  const datesAtCap = dateRows.length >= 20;
  const uniqueYears = new Set(
    dateRows.filter((r) => /^\d{4}$/.test(r.year)).map((r) => r.year),
  );
  const isDuplicateAt = (idx: number, year: string) => {
    if (!/^\d{4}$/.test(year)) return false;
    for (let j = 0; j < idx; j++) {
      if (dateRows[j].year === year) return true;
    }
    return false;
  };
  // Block submit when the form would silently drop a date row at save
  // time. Previously the duplicate-year case just highlighted the row
  // and let the form submit with last-wins semantics — the earlier
  // entry would silently disappear. Now the editor refuses to save
  // until the duplicate is resolved.
  const hasDuplicateYear = dateRows.some((r, i) => isDuplicateAt(i, r.year));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit event" : "Add seasonal event"}</DialogTitle>
          <DialogDescription>
            {initial
              ? "Refine the name, month, relevance, or per-year dates."
              : "Add a holiday, festival, or commercial moment to your calendar."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="event-name" className="text-xs font-medium text-muted-foreground">
              Name
            </label>
            <Input
              id="event-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Diwali"
              maxLength={128}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="event-month" className="text-xs font-medium text-muted-foreground">
              Month
            </label>
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(parseInt(v, 10))}
            >
              <SelectTrigger id="event-month" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_SHORT_NAMES.slice(1).map((label, idx) => (
                  <SelectItem key={label} value={String(idx + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="event-relevance" className="text-xs font-medium text-muted-foreground">
              Relevance (optional)
            </label>
            <Input
              id="event-relevance"
              type="text"
              value={relevance}
              onChange={(e) => setRelevance(e.target.value)}
              placeholder="What does this event mean for your audience?"
              maxLength={256}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Per-year dates {uniqueYears.size > 0 ? `(${uniqueYears.size}y mapped)` : "(optional, lunar/variable)"}
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={addDateRow}
                disabled={datesAtCap}
                className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground"
              >
                <Plus className="h-3 w-3" /> Add date
              </Button>
            </div>
            {dateRows.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">
                None — the modal month is the fallback.
              </p>
            ) : (
              <div className="space-y-1.5 rounded bg-muted/30 p-2">
                {dateRows.map((row, rowIdx) => {
                  const yearOk = /^\d{4}$/.test(row.year);
                  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(row.date);
                  const isDup = isDuplicateAt(rowIdx, row.year);
                  const yearInvalid = (!yearOk && row.year !== "") || isDup;
                  return (
                    <div key={row.rowId} className="flex items-center gap-1.5 text-xs">
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={row.year}
                        placeholder="YYYY"
                        aria-label={isDup ? `Duplicate year ${row.year}` : "Year"}
                        title={
                          isDup
                            ? `Year ${row.year} is set twice — only the last entry saves.`
                            : undefined
                        }
                        onChange={(ev) => updateDateRow(row.rowId, { year: ev.target.value })}
                        className={`h-7 w-16 font-mono text-[11px] ${yearInvalid ? "border-destructive" : ""}`}
                      />
                      <span className="text-muted-foreground">:</span>
                      <Input
                        type="date"
                        value={row.date}
                        aria-label="Date"
                        onChange={(ev) => updateDateRow(row.rowId, { date: ev.target.value })}
                        className={`h-7 flex-1 font-mono text-[11px] ${!dateOk && row.date ? "border-destructive" : ""}`}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeDateRow(row.rowId)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        aria-label="Remove date row"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {hasDuplicateYear ? (
            <p className="text-xs text-destructive">
              Two per-year date rows share the same year. Resolve the duplicate
              to save.
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim() || hasDuplicateYear}
            >
              {saving ? "Saving..." : initial ? "Save" : "Add event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
