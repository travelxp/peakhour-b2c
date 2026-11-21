import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { MetaHub } from "../_meta-hub/meta-hub";

export default function FacebookHubPage() {
  return (
    <PageShell width="wide">
      <PageHeader title="Facebook" description="See how your Page is doing and everything posted on it." />
      <MetaHub channel="facebook" />
    </PageShell>
  );
}
