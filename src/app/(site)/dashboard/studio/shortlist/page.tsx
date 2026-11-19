import { Heart } from "lucide-react";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { EmptyState } from "@/components/molecules/empty-state";
import { STUDIO_ROUTES } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** Route shell (UX spec): the designed empty state. The list arrives with the lane that fills it. */
export default function StudioShortlistPage() {
  const copy = STUDIO_COPY.shells.shortlist;
  return (
    <PageShell>
      <PageHeader title={copy.title} description={copy.description} />
      <EmptyState
        icon={Heart}
        title={copy.emptyTitle}
        description={copy.emptyDescription}
        action={{ label: copy.emptyAction, href: STUDIO_ROUTES.home }}
      />
    </PageShell>
  );
}
