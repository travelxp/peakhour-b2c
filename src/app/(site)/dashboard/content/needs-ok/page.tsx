import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { NEEDS_OK_LABEL, SUB_COPY, NEEDS_OK_HREF } from "@/lib/nav-copy";
import { NeedsOkScreen } from "./_components/needs-ok-screen";

/**
 * /dashboard/content/needs-ok — "Needs your OK": the one list of content waiting for a person (posts, ideas, news drafts, repurposed posts,
 * planned posts, web pages, LinkedIn drafts and the Studio shortlist). Each row opens the screen that approves it today; nothing is approved here.
 * The route and label are exported from nav-copy.ts for the navigation to place.
 */
export default function NeedsOkPage() {
  return (
    <PageShell>
      <PageHeader title={NEEDS_OK_LABEL} description={SUB_COPY[NEEDS_OK_HREF].description} />
      <NeedsOkScreen />
    </PageShell>
  );
}
