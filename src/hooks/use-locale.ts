"use client";

import { useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  formatDate as _formatDate,
  formatDateTime as _formatDateTime,
  formatCurrency as _formatCurrency,
  formatNumber as _formatNumber,
  formatRelativeTime as _formatRelativeTime,
} from "@/lib/locale";

/**
 * Convenience hook that binds locale helpers to the current user's preferences.
 *
 * Usage:
 *   const { formatDate, formatCurrency } = useLocale();
 *   return <span>{formatDate(item.publishedAt)}</span>;
 */
export function useLocale() {
  const { user, org } = useAuth();
  const prefs = user?.preferences ?? null;
  const orgCurrency = org?.currency ?? null;

  const formatDate = useCallback(
    (date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions) =>
      _formatDate(date, prefs, options),
    [prefs],
  );

  const formatDateTime = useCallback(
    (date: string | Date | null | undefined) => _formatDateTime(date, prefs),
    [prefs],
  );

  const formatCurrency = useCallback(
    (amount: number) => _formatCurrency(amount, prefs, orgCurrency),
    [prefs, orgCurrency],
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      _formatNumber(value, prefs, options),
    [prefs],
  );

  const formatRelativeTime = useCallback(
    (date: string | Date | null | undefined) => _formatRelativeTime(date, prefs),
    [prefs],
  );

  return { formatDate, formatDateTime, formatCurrency, formatNumber, formatRelativeTime };
}
