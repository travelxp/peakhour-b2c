"use client";

/**
 * Ask Peakhour — page-context provider.
 *
 * Exposes the current page as a normalized `AskPageContext` (routeKey + path +
 * optional entity ids) that the `useAsk` transport sends with every turn, so the
 * server activates the right engines and pre-scopes tools. Pages publish their
 * own entity ids (e.g. the selected GA4 propertyId) via `useSetAskEntityIds`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export interface AskPageContext {
  routeKey: string;
  path?: string;
  title?: string;
  entityIds?: Record<string, string>;
}

interface AskContextValue {
  /** Read the latest page context (used by the transport at send time). */
  getPageContext: () => AskPageContext;
  setEntityIds: (ids: Record<string, string | undefined>) => void;
}

const AskCtx = createContext<AskContextValue | null>(null);

/** ObjectId (24 hex) | UUID | numeric id — dynamic route segments to drop. */
const ID_SEGMENT = /^(?:[0-9a-fA-F]{24}|[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}|\d+)$/;

/**
 * Normalize a dashboard pathname to a stable routeKey the server's engine
 * registry matches on: "/dashboard/insights/analytics" → "insights.analytics",
 * "/dashboard/overview" → "overview", "/dashboard" → "dashboard". Dynamic id
 * segments are stripped so per-entity detail pages don't explode the routeKey
 * space: "/dashboard/strategist/6650ab…" → "strategist".
 */
export function routeKeyFromPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("dashboard");
  const rest = (idx >= 0 ? parts.slice(idx + 1) : parts).filter((seg) => !ID_SEGMENT.test(seg));
  if (rest.length === 0) return "dashboard";
  return rest.join(".");
}

export function AskContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [entityIds, setEntityIdsState] = useState<Record<string, string>>({});

  // Refs so getPageContext (called by the transport at send time, not on render)
  // always reads the freshest path + entity ids without re-creating the transport.
  // Updated in effects (React 19 forbids writing refs during render).
  const pathRef = useRef(pathname);
  const entityRef = useRef(entityIds);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    entityRef.current = entityIds;
  }, [entityIds]);

  const setEntityIds = useCallback((ids: Record<string, string | undefined>) => {
    setEntityIdsState((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(ids)) {
        if (v === undefined || v === "") delete next[k];
        else next[k] = v;
      }
      return next;
    });
  }, []);

  const getPageContext = useCallback((): AskPageContext => {
    const path = pathRef.current;
    const ids = entityRef.current;
    return {
      routeKey: routeKeyFromPath(path),
      path,
      ...(Object.keys(ids).length > 0 ? { entityIds: { ...ids } } : {}),
    };
  }, []);

  const value = useMemo(() => ({ getPageContext, setEntityIds }), [getPageContext, setEntityIds]);
  return <AskCtx.Provider value={value}>{children}</AskCtx.Provider>;
}

export function useAskContext(): AskContextValue {
  const ctx = useContext(AskCtx);
  if (!ctx) throw new Error("useAskContext must be used within <AskContextProvider>");
  return ctx;
}

/**
 * Publish this page's entity ids to Ask while the component is mounted, and
 * remove those keys on unmount. Removal is by key NAME, so use surface-unique
 * keys (propertyId, siteUrl, ideaId…) — two publishers sharing a key name can
 * step on each other. e.g. the Analytics page: `useSetAskEntityIds({ propertyId, siteUrl })`.
 */
export function useSetAskEntityIds(ids: Record<string, string | undefined>) {
  const { setEntityIds } = useAskContext();
  const key = JSON.stringify(ids);
  useEffect(() => {
    setEntityIds(ids);
    return () => {
      const cleared: Record<string, undefined> = {};
      for (const k of Object.keys(ids)) cleared[k] = undefined;
      setEntityIds(cleared);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setEntityIds]);
}
