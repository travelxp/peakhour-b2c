import { PageShell } from "@/components/dashboard/page-shell";
import { MetaHub } from "../_meta-hub/meta-hub";

export default function InstagramHubPage() {
  return (
    <PageShell width="wide">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instagram</h1>
        <p className="text-muted-foreground">See how your account is doing and everything posted on it.</p>
      </div>
      <MetaHub channel="instagram" />
    </PageShell>
  );
}
