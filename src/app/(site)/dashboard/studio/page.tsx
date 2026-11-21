import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { BatchStartEntry } from "@/components/studio/batch-start";
import { IdeasFeed } from "@/components/studio/ideas-feed";
import { STUDIO_COPY } from "@/lib/studio-copy";

/**
 * Studio home (UX spec S1): post ideas for you. Free, rule-based, and it works when no AI use case is switched on. The shortlist bar and
 * the running-jobs strip arrive with the lanes that make previews.
 */
export default function StudioPage() {
  return (
    <PageShell>
      <PageHeader title={STUDIO_COPY.title} description={STUDIO_COPY.ideas.intro} actions={<BatchStartEntry />} />
      <IdeasFeed />
    </PageShell>
  );
}
