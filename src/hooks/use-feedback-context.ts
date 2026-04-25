"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

/** Map dashboard segment → module name + default entity type */
const MODULE_MAP: Record<string, { module: string; entityType?: string }> = {
  content: { module: "content", entityType: "draft" },
  strategist: { module: "strategist", entityType: "idea" },
  calendar: { module: "calendar" },
  ads: { module: "ads", entityType: "campaign" },
  integrations: { module: "integrations", entityType: "connection" },
  optimizer: { module: "optimizer", entityType: "experiment" },
  outcomes: { module: "outcomes" },
  overview: { module: "overview" },
  settings: { module: "settings" },
};

/** 24 hex characters = MongoDB ObjectId */
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export interface FeedbackContext {
  url: string;
  module: string;
  entityType?: string;
  entityId?: string;
  userAgent: string;
  viewport: string;
}

/**
 * Automatically captures context from the current page
 * for the feedback submission form.
 */
export function useFeedbackContext(): FeedbackContext {
  const pathname = usePathname();

  return useMemo(() => {
    const url = typeof window !== "undefined" ? window.location.href : pathname;
    const userAgent =
      typeof navigator !== "undefined" ? navigator.userAgent : "";
    const viewport =
      typeof window !== "undefined"
        ? `${window.innerWidth}x${window.innerHeight}`
        : "";

    // Parse: /dashboard/{module}/{entityId?}
    const segments = pathname.split("/").filter(Boolean);
    const dashIdx = segments.indexOf("dashboard");

    let moduleName = "other";
    let entityType: string | undefined;
    let entityId: string | undefined;

    if (dashIdx >= 0 && segments[dashIdx + 1]) {
      const moduleSegment = segments[dashIdx + 1];
      const mapped = MODULE_MAP[moduleSegment];
      if (mapped) {
        moduleName = mapped.module;

        // Check for entity ID in the next segment
        const possibleId = segments[dashIdx + 2];
        if (possibleId && OBJECT_ID_RE.test(possibleId)) {
          entityType = mapped.entityType;
          entityId = possibleId;
        }
      }
    }

    return { url, module: moduleName, entityType, entityId, userAgent, viewport };
  }, [pathname]);
}
