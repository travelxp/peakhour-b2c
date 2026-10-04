import type { ReactNode } from "react";
import { ActiveStoreProvider } from "@/providers/active-store-provider";
import { StorePicker } from "@/components/commerce/store-picker";

/**
 * Commerce pages share one picked store (business with two or more stores);
 * see lib/commerce-store.ts. The picker renders nothing for a single store.
 */
export default function CommerceLayout({ children }: { children: ReactNode }) {
  return (
    <ActiveStoreProvider>
      <StorePicker />
      {children}
    </ActiveStoreProvider>
  );
}
