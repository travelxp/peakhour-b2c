"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useCommerceStores } from "@/hooks/use-commerce-stores";
import { resolveActiveStore, storeKeyFor, withStore, type CommerceStore } from "@/lib/commerce-store";

interface ActiveStore {
  /** The business's stores, primary first. */
  stores: CommerceStore[];
  /** The store the commerce pages show. */
  store: CommerceStore | null;
  /** Sent as `?merchantId=` only when the business has two or more stores. */
  merchantId: string | undefined;
  pick: (merchantId: string) => void;
  /** `path` naming the active store, when there is one to name. */
  path: (path: string) => string;
}

const NONE: ActiveStore = {
  stores: [],
  store: null,
  merchantId: undefined,
  pick: () => {},
  path: (p) => p,
};

const ActiveStoreContext = createContext<ActiveStore>(NONE);

/**
 * Which store the commerce pages show (see lib/commerce-store.ts). Mounted by
 * the commerce layout; a commerce hook used anywhere else gets NONE, which
 * sends no store and so reads what it always read.
 */
export function ActiveStoreProvider({ children }: { children: ReactNode }) {
  const { business } = useAuth();
  const businessId = business?._id;
  const { data: stores = [] } = useCommerceStores();
  // Picks made on this page, per business; before one is made, the pick saved
  // in localStorage (a per-viewer convenience: it can be empty or throw, and the
  // primary store is then the answer).
  const [picked, setPicked] = useState<Record<string, string>>({});
  const saved = businessId ? (picked[businessId] ?? readSaved(businessId)) : null;

  const pick = useCallback(
    (merchantId: string) => {
      if (!businessId) return;
      setPicked((prev) => ({ ...prev, [businessId]: merchantId }));
      try {
        localStorage.setItem(storeKeyFor(businessId), merchantId);
      } catch {
        /* the pick still holds for this page */
      }
    },
    [businessId],
  );

  const value = useMemo<ActiveStore>(() => {
    const { store, merchantId } = resolveActiveStore(stores, saved);
    return { stores, store, merchantId, pick, path: (p) => withStore(p, merchantId) };
  }, [stores, saved, pick]);

  return <ActiveStoreContext.Provider value={value}>{children}</ActiveStoreContext.Provider>;
}

function readSaved(businessId: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(storeKeyFor(businessId));
  } catch {
    return null;
  }
}

export function useActiveStore(): ActiveStore {
  return useContext(ActiveStoreContext);
}
