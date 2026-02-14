import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Shared site / legal metadata — single source of truth */
export const SITE = {
  name: "PeakHour",
  legalLastUpdated: "February 14, 2026",
  contactPrivacy: "privacy@peakhour.ai",
  contactLegal: "legal@peakhour.ai",
} as const;
