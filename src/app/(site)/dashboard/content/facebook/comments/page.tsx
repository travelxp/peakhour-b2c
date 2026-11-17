import { PageShell } from "@/components/dashboard/page-shell";
import { CommentsWorkspace } from "@/components/meta-comments/comments-workspace";

export default function FacebookCommentsPage() {
  return (
    <PageShell width="standard">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facebook comments</h1>
        <p className="text-muted-foreground">Read the comments on your Page posts. Reply, hide or delete them here.</p>
      </div>
      <CommentsWorkspace platform="facebook" />
    </PageShell>
  );
}
