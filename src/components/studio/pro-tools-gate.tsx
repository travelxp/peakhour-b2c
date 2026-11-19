"use client";

import Link from "next/link";
import { Wrench } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { useStudioPrefs } from "@/hooks/use-studio";
import { STUDIO_ROUTES } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { Button } from "@/components/ui/button";

/**
 * Wraps a Pro-tools-only screen (UX spec section 3). With the flag off, a direct visit shows an empty state that says why, not a 404.
 * The flag is read defensively (`useStudioPrefs`): off until the api says otherwise. Waits for the read instead of flashing "off".
 */
export function ProToolsGate({ children }: { children: React.ReactNode }) {
  const { proTools, loading } = useStudioPrefs();
  if (loading) return <Skeleton className="h-48 rounded-lg" />;
  if (proTools) return <>{children}</>;
  return (
    <div className="space-y-3">
      <EmptyState icon={Wrench} title={STUDIO_COPY.proTools.offTitle} description={STUDIO_COPY.proTools.offDescription} />
      <div className="flex justify-center">
        <Button asChild variant="outline" className="h-11">
          <Link href={STUDIO_ROUTES.home}>{STUDIO_COPY.proTools.backToIdeas}</Link>
        </Button>
      </div>
    </div>
  );
}
