"use client";

import { usePathname } from "next/navigation";
import { Store } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveStore } from "@/providers/active-store-provider";

const PLATFORM_LABEL: Record<string, string> = { shopify: "Shopify", woocommerce: "WooCommerce" };

/**
 * Which store the commerce pages show, for a business with more than one.
 *
 * ★RENDERS NOTHING WITH ONE STORE. A single-store business has nothing to pick,
 * and a picker with one option is a control that does nothing. With two or
 * more, every commerce figure, queue and dial below it is that store's.
 *
 * ★AND NOT ON THE ASSISTANT PAGE. Its preview grounds on the business's primary
 * store (the api route takes no store), so a picker there would claim a scope
 * the answers do not have.
 */
const UNSCOPED_PAGES = ["/dashboard/commerce/assistant"];

export function StorePicker() {
  const pathname = usePathname();
  const { stores, store, pick } = useActiveStore();
  if (stores.length < 2 || !store) return null;
  if (UNSCOPED_PAGES.some((p) => pathname?.startsWith(p))) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm md:px-6">
      <Store className="size-4 text-muted-foreground" aria-hidden />
      <label htmlFor="commerce-store" className="text-muted-foreground">
        Store
      </label>
      <Select value={store.merchantId} onValueChange={pick}>
        <SelectTrigger id="commerce-store" className="h-8 w-auto min-w-48 max-w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {stores.map((s) => (
            <SelectItem key={s.merchantId} value={s.merchantId}>
              {s.name}
              <span className="ml-2 text-xs text-muted-foreground">
                {PLATFORM_LABEL[s.platform] ?? s.platform}
                {s.currency ? ` · ${s.currency}` : ""}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
