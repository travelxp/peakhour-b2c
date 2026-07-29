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
  /** Date stamped on Terms, Privacy and Cookie Policy. Privacy §17 and Cookie §7
   *  define this as the signal of a material change, so bump it ONLY when one of
   *  those three actually changes. */
  legalLastUpdated: "July 29, 2026",
  /** Separate stamp for the Data Deletion and Data Retention pages. They are
   *  informational, change on their own cadence, and the Data Deletion page is
   *  read by Meta app review — sharing `legalLastUpdated` made an unrelated
   *  policy edit look like a change to them. */
  helpLastUpdated: "June 1, 2026",
  /** Operating legal entity for India (data controller / data fiduciary).
   *
   *  IMPORTANT — the India and UK entities share the SAME `legalName`. Rendering
   *  a bare `legalName` in a sentence whose job is to IDENTIFY the entity
   *  produces a tautology ("references to Company mean Media Worldwide Limited"
   *  reads identically for both). Use `ref` wherever the text distinguishes one
   *  entity from the other; `legalName` is only for prose that means "the
   *  company", where either reading is correct. */
  company: {
    legalName: "Media Worldwide Limited",
    /** Disambiguated form — use in any identifying sentence. */
    ref: "Media Worldwide Limited (incorporated in India)",
    address:
      "5th Floor, Tech Web Centre, Link Road, Oshiwara, Mumbai 400102, Maharashtra, India",
  },
  /** Entity that markets and contracts for Peakhour.ai outside India. */
  companyUk: {
    legalName: "Media Worldwide Limited",
    /** Disambiguated form — use in any identifying sentence. */
    ref: "Media Worldwide Limited (registered in England and Wales, company number 06334375)",
    /** Structured form of the number embedded in `ref`. Kept separate because
     *  statutory disclosure (UK Companies Act s.82 / Trading Disclosures Regs)
     *  wants the bare number, not the prose form. The India entity has no
     *  counterpart yet — its CIN has not been supplied. */
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
