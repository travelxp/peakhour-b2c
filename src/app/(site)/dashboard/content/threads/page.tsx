import { Suspense } from "react";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { OAuthConnectResult } from "@/components/integrations/oauth-connect-result";
import { ThreadsHub } from "./_components/threads-hub";

export default function ThreadsHubPage() {
  return (
    <PageShell width="wide">
      <PageHeader title="Threads" description="Your Threads profile and everything posted on it." />
      {/* Connect and Reconnect return here: say "Threads connected." and refresh the connection state. */}
      <Suspense fallback={null}>
        <OAuthConnectResult />
      </Suspense>
      <ThreadsHub />
    </PageShell>
  );
}
