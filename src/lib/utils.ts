import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Shared site / legal metadata — single source of truth */
export const SITE = {
  name: "Peakhour.ai",
  /** Canonical public origin — drives metadataBase, sitemap, robots, OG URLs.
   *  Override per-env with NEXT_PUBLIC_SITE_URL; defaults to production. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://peakhour.ai",
  tagline: "The AI business platform for growing brands",
  legalLastUpdated: "June 1, 2026",
  /** Operating legal entity for India (data controller / data fiduciary). */
  company: {
    legalName: "Media Worldwide Limited",
    address:
      "5th Floor, Tech Web Centre, Link Road, Oshiwara, Mumbai 400102, Maharashtra, India",
  },
  /** Entity that markets and contracts for Peakhour.ai outside India.
   *  Same legal name as the India entity — the country of incorporation and the
   *  company registration number are what distinguish the two on documents. */
  companyUk: {
    legalName: "Media Worldwide Limited",
    companyNumber: "06334375",
    address:
      "2nd Floor, 2 Warner House, Harrovian Business Village, Bessborough Road, Harrow, Middlesex, England, HA1 3EX",
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
