import { PageShell } from "@/components/dashboard/page-shell";
import { MetaHub } from "../_meta-hub/meta-hub";

export default function FacebookHubPage() {
  return (
    <PageShell width="wide">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facebook</h1>
        <p className="text-muted-foreground">See how your Page is doing and everything posted on it.</p>
      </div>
      <MetaHub channel="facebook" />
    </PageShell>
  );
}
