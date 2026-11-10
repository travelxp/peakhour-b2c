"use client";

import Link from "next/link";
import { FileQuestion, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { openCommandMenu } from "@/lib/dashboard-events";
import { NOT_FOUND_DESTINATIONS } from "@/lib/dashboard-not-found";

/** Dashboard 404: keeps the sidebar, suggests destinations, opens search. */
export default function DashboardNotFound() {
  return (
    <Empty role="status">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestion />
        </EmptyMedia>
        {/* The page's one heading: EmptyTitle alone renders a div. */}
        <EmptyTitle>
          <h1>We couldn&apos;t find that page</h1>
        </EmptyTitle>
        <EmptyDescription>
          It may have moved, or the link may be old. Pick one of these, or
          search for what you need.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {NOT_FOUND_DESTINATIONS.map((d) => (
            <Button key={d.href} asChild variant="outline" size="sm" title={d.hint}>
              <Link href={d.href}>{d.label}</Link>
            </Button>
          ))}
        </div>
        <Button onClick={openCommandMenu}>
          <Search className="mr-1.5 size-4" />
          Search the dashboard
        </Button>
      </EmptyContent>
    </Empty>
  );
}
