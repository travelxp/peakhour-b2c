import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/dashboard/page-shell";

export default function StudioLoading() {
  return (
    <PageShell>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    </PageShell>
  );
}
