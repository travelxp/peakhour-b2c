import type { UserPreferences } from "./auth";

// ── Map user dateFormat tokens to Intl options + locale hints ────

type DateFormatToken = NonNullable<UserPreferences["dateFormat"]>;

const DATE_FORMAT_OPTIONS: Record<DateFormatToken, Intl.DateTimeFormatOptions> = {
  "DD/MM/YYYY": { day: "2-digit", month: "2-digit", year: "numeric" },
  "MM/DD/YYYY": { month: "2-digit", day: "2-digit", year: "numeric" },
  "YYYY-MM-DD": { year: "numeric", month: "2-digit", day: "2-digit" },
  "DD-MM-YY ddd": { day: "2-digit", month: "2-digit", year: "2-digit", weekday: "short" },
};

// Locale hints so Intl produces the right field order
const DATE_FORMAT_LOCALE: Record<DateFormatToken, string> = {
  "DD/MM/YYYY": "en-GB",
  "MM/DD/YYYY": "en-US",
  "YYYY-MM-DD": "sv-SE",
  "DD-MM-YY ddd": "en-GB",
};

// ── Resolve effective settings ──────────────────────────────────

function getSettings(prefs: UserPreferences | null | undefined) {
  return {
    dateFormat: prefs?.dateFormat as DateFormatToken | undefined,
    timezone: prefs?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    currency: prefs?.currency || undefined,
    numberLocale: prefs?.numberFormat || undefined, // undefined = browser default
  };
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Format a date using user preferences or browser locale.
 * Pass custom `options` to override (e.g. for weekday/month names).
 */
export function formatDate(
  date: string | Date | null | undefined,
  prefs: UserPreferences | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  const s = getSettings(prefs);

  if (options) {
    // Custom options override — still respect timezone
    return new Intl.DateTimeFormat(s.numberLocale, {
      timeZone: s.timezone,
      ...options,
    }).format(d);
  }

  if (s.dateFormat) {
    const locale = DATE_FORMAT_LOCALE[s.dateFormat];
    const opts: Intl.DateTimeFormatOptions = {
      ...DATE_FORMAT_OPTIONS[s.dateFormat],
      timeZone: s.timezone,
    };

    // DD-MM-YY ddd needs post-processing to match exact format
    if (s.dateFormat === "DD-MM-YY ddd") {
      const parts = new Intl.DateTimeFormat(locale, opts).formatToParts(d);
      const day = parts.find((p) => p.type === "day")?.value ?? "";
      const month = parts.find((p) => p.type === "month")?.value ?? "";
      const year = parts.find((p) => p.type === "year")?.value ?? "";
      const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
      return `${day}-${month}-${year} ${weekday}`;
    }

    return new Intl.DateTimeFormat(locale, opts).format(d);
  }

  // Fallback: browser locale
  return new Intl.DateTimeFormat(s.numberLocale, {
    timeZone: s.timezone,
  }).format(d);
}

/** Format date + time (e.g. "24/03/2026 14:30") */
export function formatDateTime(
  date: string | Date | null | undefined,
  prefs: UserPreferences | null | undefined,
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  const s = getSettings(prefs);
  const locale = s.dateFormat
    ? DATE_FORMAT_LOCALE[s.dateFormat]
    : s.numberLocale;

  const opts: Intl.DateTimeFormatOptions = {
    ...(s.dateFormat ? DATE_FORMAT_OPTIONS[s.dateFormat] : {}),
    hour: "numeric",
    minute: "2-digit",
    timeZone: s.timezone,
  };

  return new Intl.DateTimeFormat(locale, opts).format(d);
}

/** Format currency amount (user pref → org currency → USD fallback) */
export function formatCurrency(
  amount: number,
  prefs: UserPreferences | null | undefined,
  orgCurrency?: string | null,
): string {
  const s = getSettings(prefs);
  const currency = s.currency || orgCurrency || "USD";

  return new Intl.NumberFormat(s.numberLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format a number with locale-appropriate separators */
export function formatNumber(
  value: number,
  prefs: UserPreferences | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  const s = getSettings(prefs);
  return new Intl.NumberFormat(s.numberLocale, options).format(value);
}

/** Format relative time (e.g. "2 hours ago", "in 3 days") */
export function formatRelativeTime(
  date: string | Date | null | undefined,
  prefs: UserPreferences | null | undefined,
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  const s = getSettings(prefs);
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const absDiff = Math.abs(diffMs);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60_000],
    ["minute", 3_600_000],
    ["hour", 86_400_000],
    ["day", 2_592_000_000],
    ["month", 31_536_000_000],
    ["year", Infinity],
  ];

  for (const [unit, threshold] of units) {
    if (absDiff < threshold) {
      const divisors: Record<string, number> = {
        second: 1_000,
        minute: 60_000,
        hour: 3_600_000,
        day: 86_400_000,
        month: 2_592_000_000,
        year: 31_536_000_000,
      };
      const value = Math.round(diffMs / divisors[unit]);
      return new Intl.RelativeTimeFormat(s.numberLocale, { numeric: "auto" }).format(
        value,
        unit,
      );
    }
  }

  return formatDate(d, prefs);
}
