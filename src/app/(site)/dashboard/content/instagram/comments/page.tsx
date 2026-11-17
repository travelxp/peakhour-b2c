import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { CommentsWorkspace } from "@/components/meta-comments/comments-workspace";

export default function InstagramCommentsPage() {
  return (
    <PageShell width="standard">
      <PageHeader title="Instagram comments" description="Read the comments on your Instagram posts. Reply, hide or delete them here." />
      <CommentsWorkspace platform="instagram" />
    </PageShell>
  );
}
