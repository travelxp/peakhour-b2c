/** The calendar page's tabs, and the `?tab=` value that opens each. Anything else opens the calendar itself. */
export const CALENDAR_TABS = ["calendar", "ideas", "recurring"] as const;
export type CalendarTab = (typeof CALENDAR_TABS)[number];

export const CALENDAR_TAB_LABELS: Record<CalendarTab, string> = {
  calendar: "Calendar",
  ideas: "Planned ideas",
  recurring: "Recurring",
};

export function parseCalendarTab(raw: string | null | undefined): CalendarTab {
  return (CALENDAR_TABS as readonly string[]).includes(raw ?? "") ? (raw as CalendarTab) : "calendar";
}
