import { PageShell } from "@/components/dashboard/page-shell";
import { CommentsWorkspace } from "@/components/meta-comments/comments-workspace";

export default function InstagramCommentsPage() {
  return (
    <PageShell width="standard">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instagram comments</h1>
        <p className="text-muted-foreground">Read the comments on your Instagram posts. Reply, hide or delete them here.</p>
      </div>
      <CommentsWorkspace platform="instagram" />
    </PageShell>
  );
}
