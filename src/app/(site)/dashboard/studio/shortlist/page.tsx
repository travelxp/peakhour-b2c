import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { ShortlistScreen } from "@/components/studio/shortlist-screen";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** The Shortlist (UX spec S9): everything hearted, waiting to be made final. The Make final bar is the Studio layout's. */
export default function StudioShortlistPage() {
  const copy = STUDIO_COPY.shells.shortlist;
  return (
    <PageShell>
      <PageHeader title={copy.title} description={copy.description} />
      <ShortlistScreen />
    </PageShell>
  );
}
