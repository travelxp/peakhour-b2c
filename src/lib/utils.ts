import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Shared site / legal metadata — single source of truth */
export const SITE = {
  name: "Peakhour",
  legalLastUpdated: "June 1, 2026",
  /** Operating legal entity (data controller / data fiduciary). */
  company: {
    legalName: "Celebrities Management Private Limited",
    address:
      "5th Floor, Tech Web Centre, Link Road, Oshiwara, Mumbai 400102, Maharashtra, India",
  },
  contactPrivacy: "privacy@peakhour.ai",
  contactLegal: "legal@peakhour.ai",
  contactGeneral: "hello@peakhour.ai",
  /** India DPDP Act, 2023 — published Grievance Officer contact. */
  grievanceOfficer: {
    name: "Grievance Officer",
    email: "grievance@peakhour.ai",
  },
} as const;
