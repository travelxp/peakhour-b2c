"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Pencil, X, Check, Plus } from "lucide-react";

// ── Types (mirror routes/dashboard/index.ts SeasonalEventBody) ───

interface SeasonalEvent {
  name: string;
  /** 1..12 */
  month: number;
  relevance?: string;
  /** Year (YYYY) → ISO date (YYYY-MM-DD). Set by the seed for moving
   *  holidays; editable here for ops-style per-year overrides. */
  dates?: Record<string, string>;
}

interface OrgDetails {
  _id: string;
  taxonomy?: {
    seasonalEvents?: SeasonalEvent[];
  } | null;
}

/**
 * Client-side row state during edit. Two shape changes vs the wire
 * `SeasonalEvent`:
 *  - `clientId` — stable React key so removing a middle row doesn't
 *    drift focus + leak input values across rows.
 *  - `dateRows` — per-year dates rendered as an editable array. Lets
 *    the user freely edit both year and date without "mutating a
 *    Record's key" awkwardness. Converted back to a Record at save
 *    time.
 *
 * Both fields are stripped before sending to the api — the server's
 * `.strict()` schema would reject them.
 */
interface DateRow {
  rowId: string;
  year: string;
  date: string;
}

interface EditableSeasonalEvent {
  clientId: string;
  name: string;
  month: number;
  relevance?: string;
  dateRows: DateRow[];
}

function makeClientId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Pick a sensible default year when the owner clicks "Add date".
 * Returns the year AFTER the largest valid year in the current rows,
 * or the current calendar year if there are no valid rows.
 */
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

function attachClientIds(events: SeasonalEvent[]): EditableSeasonalEvent[] {
  return events.map((e) => ({
    clientId: makeClientId(),
    name: e.name,
    month: e.month,
    ...(e.relevance !== undefined ? { relevance: e.relevance } : {}),
    dateRows: e.dates
      ? Object.entries(e.dates)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([year, date]) => ({ rowId: makeClientId(), year, date }))
      : [],
  }));
}

const MONTH_SHORT_NAMES = [
  "", // padding so MONTH_SHORT_NAMES[1] === "Jan"
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

/**
 * Build the date-badge text for an event. When a current-year date
 * exists in the `dates` map (lunar / variable holidays), render the
 * weekday + month + day-of-month so owners see EXACTLY when the
 * event lands this year. Falls back to the modal-month abbreviation
 * for static-date events (where the day-of-month isn't in the schema).
 *
 * Returns `null` when month is out of range — defensive against
 * malformed wire data.
 */
function formatEventDateBadge(event: SeasonalEvent): string | null {
  const currentYear = String(new Date().getUTCFullYear());
  const exact = event.dates?.[currentYear];
  if (exact && /^\d{4}-\d{2}-\d{2}$/.test(exact)) {
    // Parse the ISO date as UTC so weekday + day-of-month don't shift
    // by the viewer's timezone (Diwali on 2026-11-08 is always
    // Sunday regardless of where the viewer sits).
    const d = new Date(`${exact}T00:00:00Z`);
    if (!isNaN(d.getTime())) {
      const weekday = d.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      });
      const month = MONTH_SHORT_NAMES[d.getUTCMonth() + 1];
      const dayNum = d.getUTCDate();
      return `${weekday} · ${month} ${dayNum}`;
    }
  }
  return MONTH_SHORT_NAMES[event.month] ?? null;
}

export default function SeasonalEventsPage() {
  const { org } = useAuth();
  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editEvents, setEditEvents] = useState<EditableSeasonalEvent[]>([]);

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

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      // Rebuild the wire shape from the editable form. The api's
      // SeasonalEventBody is .strict() — clientId / rowId / dateRows
      // never reach the server.
      const cleaned = editEvents
        .map((e) => {
          const dates: Record<string, string> = {};
          for (const row of e.dateRows) {
            if (!/^\d{4}$/.test(row.year)) continue;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
            dates[row.year] = row.date;
          }
          const hasDates = Object.keys(dates).length > 0;
          return {
            name: e.name.trim(),
            month: e.month,
            ...(e.relevance && e.relevance.trim()
              ? { relevance: e.relevance.trim() }
              : {}),
            ...(hasDates ? { dates } : {}),
          };
        })
        .filter((e) => e.name.length > 0);

      // Guard against accidentally wiping the whole array.
      const originalCount = orgDetails?.taxonomy?.seasonalEvents?.length ?? 0;
      if (originalCount > 0 && cleaned.length === 0) {
        const confirmed =
          typeof window !== "undefined" &&
          window.confirm(
            `This will remove all ${originalCount} seasonal events from your business. Continue?`,
          );
        if (!confirmed) {
          setSaving(false);
          return;
        }
      }

      await api.put("/v1/dashboard/org", { taxonomy: { seasonalEvents: cleaned } });
      const updated = await api.get<OrgDetails>("/v1/dashboard/org");
      setOrgDetails(updated);
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to save seasonal events. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading seasonal events">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
            Seasonal Events
          </h2>
          <p className="text-muted-foreground mt-1">
            Cultural, national, and commercial moments the AI uses to plan
            seasonal content. Onboarding seeds these from your country&apos;s
            calendar; you can add, edit, or remove events here. Exact dates
            show for the current year when a moving holiday (Diwali, Eid,
            Easter, …) has been mapped.
          </p>
        </div>
        {/* Edit / Save controls hoisted to the page header so the inner
            Card doesn't repeat the "Seasonal Events" title (which would
            duplicate the page H2). */}
        <div className="shrink-0">
          {!editing ? (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              onClick={() => {
                setEditing(true);
                setEditEvents(attachClientIds(orgDetails?.taxonomy?.seasonalEvents || []));
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="max-w-3xl">
        <Card>
          <CardContent className="space-y-2 p-4">
            {editing ? (
              <EditableSeasonalEvents events={editEvents} onChange={setEditEvents} />
            ) : (
              <ReadOnlySeasonalEvents
                events={orgDetails?.taxonomy?.seasonalEvents || []}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReadOnlySeasonalEvents({ events }: { events: SeasonalEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No seasonal events yet. Click Edit to add holidays, festivals, or
        commercial moments relevant to your audience.
      </p>
    );
  }
  // Sort by month for a calendar-ish read order. Same-month events
  // preserve their declared sort order.
  const sorted = [...events].sort((a, b) => a.month - b.month);
  return (
    <div className="space-y-1.5">
      {sorted.map((e, i) => {
        const dateBadge = formatEventDateBadge(e);
        const movingYears = e.dates ? Object.keys(e.dates).sort() : [];
        return (
          <div
            key={`${e.name}-${i}`}
            className="rounded-md border bg-card p-2.5 text-sm"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">{e.name}</span>
              {dateBadge ? (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {dateBadge}
                </Badge>
              ) : null}
              {movingYears.length > 0 ? (
                <Badge variant="secondary" className="text-[10px]">
                  moving · {movingYears.length}y mapped
                </Badge>
              ) : null}
            </div>
            {e.relevance ? (
              <p className="mt-1 text-xs text-muted-foreground">{e.relevance}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EditableSeasonalEvents({
  events,
  onChange,
}: {
  events: EditableSeasonalEvent[];
  onChange: (events: EditableSeasonalEvent[]) => void;
}) {
  function updateById(
    clientId: string,
    patch: Partial<Omit<EditableSeasonalEvent, "clientId" | "dateRows">>,
  ) {
    onChange(events.map((e) => (e.clientId === clientId ? { ...e, ...patch } : e)));
  }
  function removeById(clientId: string) {
    onChange(events.filter((e) => e.clientId !== clientId));
  }
  function addBlank() {
    onChange([
      ...events,
      { clientId: makeClientId(), name: "", month: 1, dateRows: [] },
    ]);
  }
  function updateDateRow(
    clientId: string,
    rowId: string,
    patch: Partial<Pick<DateRow, "year" | "date">>,
  ) {
    onChange(
      events.map((e) =>
        e.clientId === clientId
          ? {
              ...e,
              dateRows: e.dateRows.map((r) =>
                r.rowId === rowId ? { ...r, ...patch } : r,
              ),
            }
          : e,
      ),
    );
  }
  function removeDateRow(clientId: string, rowId: string) {
    onChange(
      events.map((e) =>
        e.clientId === clientId
          ? { ...e, dateRows: e.dateRows.filter((r) => r.rowId !== rowId) }
          : e,
      ),
    );
  }
  function addDateRow(clientId: string) {
    onChange(
      events.map((e) =>
        e.clientId === clientId
          ? {
              ...e,
              dateRows: [
                ...e.dateRows,
                { rowId: makeClientId(), year: nextYearForRows(e.dateRows), date: "" },
              ],
            }
          : e,
      ),
    );
  }

  return (
    <div className="space-y-2">
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No events yet. Add your first one below.
        </p>
      ) : (
        events.map((e, i) => {
          const rowLabel = e.name || `Event ${i + 1}`;
          const datesAtCap = e.dateRows.length >= 20;
          const uniqueYears = new Set(
            e.dateRows.filter((r) => /^\d{4}$/.test(r.year)).map((r) => r.year),
          );
          const isDuplicateAt = (idx: number, year: string) => {
            if (!/^\d{4}$/.test(year)) return false;
            for (let j = 0; j < idx; j++) {
              if (e.dateRows[j].year === year) return true;
            }
            return false;
          };
          return (
            <div key={e.clientId} className="rounded-md border bg-card p-2.5 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="text"
                  value={e.name}
                  placeholder="Event name (e.g. Diwali)"
                  aria-label={`${rowLabel} — name`}
                  onChange={(ev) => updateById(e.clientId, { name: ev.target.value })}
                  className="h-8 text-sm flex-1 min-w-48"
                />
                <Select
                  value={String(e.month)}
                  onValueChange={(v) => updateById(e.clientId, { month: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-8 w-22" aria-label={`${rowLabel} — month`}>
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
                {uniqueYears.size > 0 ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {uniqueYears.size}y mapped
                  </Badge>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeById(e.clientId)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${rowLabel}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                type="text"
                value={e.relevance || ""}
                placeholder="What does this event mean for your audience? (optional)"
                aria-label={`${rowLabel} — relevance`}
                onChange={(ev) => updateById(e.clientId, { relevance: ev.target.value })}
                className="h-8 text-sm"
              />
              <div className="rounded bg-muted/30 px-2 py-1.5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Per-year dates {datesAtCap ? "(max 20)" : "(optional, lunar/variable)"}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => addDateRow(e.clientId)}
                    disabled={datesAtCap}
                    className="h-6 text-[10px] gap-1 px-1.5 text-muted-foreground"
                    aria-label={`Add per-year date to ${rowLabel}`}
                  >
                    <Plus className="h-3 w-3" /> Add date
                  </Button>
                </div>
                {e.dateRows.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">
                    None — the modal month is the fallback.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {e.dateRows.map((row, rowIdx) => {
                      const yearOk = /^\d{4}$/.test(row.year);
                      const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(row.date);
                      const isDup = isDuplicateAt(rowIdx, row.year);
                      const yearInvalid = (!yearOk && row.year !== "") || isDup;
                      return (
                        <div
                          key={row.rowId}
                          className="flex items-center gap-1.5 text-[11px]"
                        >
                          <Input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            value={row.year}
                            placeholder="YYYY"
                            aria-label={
                              isDup
                                ? `${rowLabel} — year ${row.year} duplicates an earlier row (last wins)`
                                : `${rowLabel} — year for date row`
                            }
                            title={
                              isDup
                                ? `Year ${row.year} is set twice for this event — only the last entry saves.`
                                : undefined
                            }
                            onChange={(ev) =>
                              updateDateRow(e.clientId, row.rowId, { year: ev.target.value })
                            }
                            className={`h-7 w-16 font-mono text-[11px] ${
                              yearInvalid ? "border-destructive" : ""
                            }`}
                          />
                          <span className="text-muted-foreground">:</span>
                          <Input
                            type="date"
                            value={row.date}
                            aria-label={`${rowLabel} — date for year ${row.year || "?"}`}
                            onChange={(ev) =>
                              updateDateRow(e.clientId, row.rowId, { date: ev.target.value })
                            }
                            className={`h-7 font-mono text-[11px] flex-1 max-w-48 ${
                              !dateOk && row.date ? "border-destructive" : ""
                            }`}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeDateRow(e.clientId, row.rowId)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove year ${row.year || "row"} from ${rowLabel}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={addBlank}
        className="gap-1.5"
        disabled={events.length >= 64}
      >
        <Plus className="h-3.5 w-3.5" /> Add event
      </Button>
      {events.length >= 64 ? (
        <p className="text-[10px] text-muted-foreground">
          Maximum of 64 events. Remove one to add another.
        </p>
      ) : null}
    </div>
  );
}
