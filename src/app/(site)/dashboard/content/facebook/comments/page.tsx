import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { CommentsWorkspace } from "@/components/meta-comments/comments-workspace";

export default function FacebookCommentsPage() {
  return (
    <PageShell width="standard">
      <PageHeader title="Facebook comments" description="Read the comments on your Page posts. Reply, hide or delete them here." />
      <CommentsWorkspace platform="facebook" />
    </PageShell>
  );
}
