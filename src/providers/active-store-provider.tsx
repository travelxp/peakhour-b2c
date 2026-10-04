"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useCommerceStores } from "@/hooks/use-commerce-stores";
import { resolveActiveStore, storeKeyFor, withStore, type CommerceStore } from "@/lib/commerce-store";
import { LoadingScreen } from "@/components/molecules/loading-screen";

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
  const { data: stores = [], isSuccess, isError } = useCommerceStores();
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

  // ★NOTHING BELOW RUNS UNTIL THE STORE IS KNOWN. Every commerce query reads
  // the picked store; rendered before the list arrives, each would fetch the
  // primary store, show it with no picker to say so, then refetch the picked
  // one, and an action approved in between would carry a mismatched store.
  // Holding the pages here, rather than disabling each query, keeps their
  // loading states honest (a disabled query is not "loading" in react-query).
  // A failed list (an older api) settles too: no store is then named.
  const settled = !businessId || isSuccess || isError;
  if (!settled) return <LoadingScreen message="Loading your store…" />;

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
