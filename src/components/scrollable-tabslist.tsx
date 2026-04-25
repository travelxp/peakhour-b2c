import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ScrollableTabsListProps {
  children: ReactNode;
  className?: string;
}

const ScrollableTabsList = ({ children, className }: ScrollableTabsListProps) => {
  return (
    <div className={cn("overflow-hidden rounded-full", className)}>
      <ScrollArea className="whitespace-nowrap">
        {children}
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>
    </div>
  );
};

export { ScrollableTabsList };
