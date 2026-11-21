import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { MetaHub } from "../_meta-hub/meta-hub";

export default function InstagramHubPage() {
  return (
    <PageShell width="wide">
      <PageHeader title="Instagram" description="See how your account is doing and everything posted on it." />
      <MetaHub channel="instagram" />
    </PageShell>
  );
}
