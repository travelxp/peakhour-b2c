import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { ThreadsHub } from "./_components/threads-hub";

export default function ThreadsHubPage() {
  return (
    <PageShell width="wide">
      <PageHeader title="Threads" description="Your Threads profile and everything posted on it." />
      <ThreadsHub />
    </PageShell>
  );
}
