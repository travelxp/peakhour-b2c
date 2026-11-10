"use client";

import type { ComponentProps, ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The one toolbar every dashboard list / table page uses: search on the left,
 * then status tabs and filters, then column / view controls pushed to the
 * right. It wraps on phones (search takes a full row first, then the tabs and
 * filters, then the actions), so a page never scrolls sideways.
 *
 * Layout only. The page keeps its own state, query keys and URL params and
 * passes the controls in as slots. The shape follows the Shadcnblocks
 * data-toolbar block (DataToolbar / DataToolbarSearch / DataToolbarActions),
 * built on this repo's `cn` and extended with `tabs` and `filters` slots.
 *
 * Every control passed in must carry its own aria-label; DataToolbarSearch
 * requires one in its type.
 */
interface DataToolbarProps extends Omit<ComponentProps<"div">, "children"> {
  search?: ReactNode;
  tabs?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
}

export function DataToolbar({
  search,
  tabs,
  filters,
  actions,
  className,
  ...props
}: DataToolbarProps) {
  return (
    <div
      data-slot="data-toolbar"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    >
      {search}
      {tabs && (
        <div data-slot="data-toolbar-tabs" className="max-w-full min-w-0">
          {tabs}
        </div>
      )}
      {filters && (
        <div
          data-slot="data-toolbar-filters"
          className="flex min-w-0 flex-wrap items-center gap-2"
        >
          {filters}
        </div>
      )}
      {actions && (
        <div
          data-slot="data-toolbar-actions"
          className="flex flex-wrap items-center gap-2 sm:ml-auto"
        >
          {actions}
        </div>
      )}
    </div>
  );
}

type DataToolbarSearchProps = Omit<ComponentProps<typeof Input>, "type" | "aria-label"> & {
  "aria-label": string;
};

/** The search slot: icon + Input, full width on a phone, flexible above it. */
export function DataToolbarSearch({ className, ...props }: DataToolbarSearchProps) {
  return (
    <div
      data-slot="data-toolbar-search"
      className="relative w-full min-w-0 sm:w-64 sm:flex-none"
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input type="search" className={cn("pl-8", className)} {...props} />
    </div>
  );
}
