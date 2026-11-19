import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { Memory } from "@/components/studio/memory";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** What we've learned about you (UX spec S15): every learned line with its evidence, the rules that always win, and the privacy controls. */
export default function StudioLearnedPage() {
  const copy = STUDIO_COPY.shells.learned;
  return (
    <PageShell>
      <PageHeader title={copy.title} description={copy.description} />
      <Memory />
    </PageShell>
  );
}
