import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * Root 404 page — fires for any URL that doesn't match a route or for
 * explicit `notFound()` calls inside server components. Renders the same
 * `Empty` chrome as ErrorFallback / EmptyState so the look stays consistent
 * across error, empty, and not-found states.
 */
export default function NotFound() {
  return (
    <div className="container mx-auto p-6 md:p-10">
      <Empty role="status">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            The page you&apos;re looking for doesn&apos;t exist or has moved.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Home</Link>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
