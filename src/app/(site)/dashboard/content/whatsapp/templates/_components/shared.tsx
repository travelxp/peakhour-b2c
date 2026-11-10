"use client";

import { toast } from "sonner";

// ── Types (mirror /v1/meta/whatsapp/studio responses) ───────────────────────
export type TemplateStatus = "draft" | "submitted" | "approved" | "rejected" | "paused" | "disabled";

export type Category = "MARKETING" | "UTILITY" | "AUTHENTICATION";

interface WAButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}

export interface Components {
  header?: { format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"; text?: string };
  body: { text: string };
  footer?: { text: string };
  buttons?: WAButton[];
}

export interface BizTemplate {
  _id: string;
  name: string;
  language: string;
  category: Category;
  status: TemplateStatus;
  quality?: string;
  components?: Components;
  rejectionReason?: string;
  attempts?: number;
  updatedAt?: string;
}

export interface LintIssue { severity: "error" | "warning"; field: string; message: string }

export interface Editor {
  id?: string;
  name: string;
  language: string;
  category: Category;
  components: Components;
}

export const STUDIO = "/v1/meta/whatsapp/studio";

export const EMPTY_EDITOR: Editor = {
  name: "",
  language: "en",
  category: "UTILITY",
  components: { body: { text: "" } },
};

export const STATUS_VARIANT: Record<TemplateStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  submitted: { label: "In review", className: "bg-warning/15 text-warning-on-tint" },
  approved: { label: "Approved", className: "bg-success/15 text-success-on-tint" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive-on-tint" },
  paused: { label: "Paused", className: "bg-warning/15 text-warning-on-tint" },
  disabled: { label: "Disabled", className: "bg-muted text-muted-foreground" },
};

// ── ★★THE PINNED WARNINGS THIS PAGE HAS RAISED — MODULE STATE, NOT COMPONENT
//    STATE ──────────────────────────────────────────────────────────────────
//
// 🚫★★A `duration: Infinity` TOAST OUTLIVES THE COMPONENT THAT RAISED IT. The
//  `Toaster` lives in the site layout, so these survive a route change — while
//  refs inside the page do not. Navigating away and back reset the bookkeeping
//  and left the warning on screen with nothing tracking it: a later clean
//  resubmit no longer retired it, and a later business switch no longer
//  dismissed it. The tracking has to have the same lifetime as the thing it
//  tracks, which is the page load.
//
// ★KEYED BY TEMPLATE, VALUED BY THE TOAST'S OWN ID — the two differ because
//  each raising gets a fresh toast id, which is what stops a dismissal of the
//  old one landing on the new one.
export const pinnedNotices = new Map<string, string>();

/** Retire every pinned warning this page raised, and forget them. */
export function dismissPinnedNotices() {
  for (const id of pinnedNotices.values()) toast.dismiss(id);
  pinnedNotices.clear();
}

// ⏸★★AND THE RETIREMENT ONLY RUNS WHILE THIS PAGE IS MOUNTED, which is a
//  residual rather than an oversight. The `Toaster` is in the `(site)` layout
//  and never unmounts, so switching business — or signing out — from ANOTHER
//  route leaves a pinned warning naming a template that is not in the list any
//  more.
//
// 🚫★★DRIVING IT FROM THE AUTH PROVIDER IS NOT THE ANSWER: it would put one
//  page's toast bookkeeping into the thing every page depends on, and the next
//  page with a pinned toast would add a second entry to it.
//
// ⏸★THE ANSWER IS THAT A FACT THIS DURABLE DOES NOT BELONG IN A TOAST AT ALL.
//  It is a property of the ROW — Meta holds a category this template's record
//  disagrees with — and the api already reports it per submit as
//  `categoryApplied`. Surfacing it on the card retires the pinned toast, the
//  bookkeeping and this residual together. ★The toast has a close button in the
//  meantime.
