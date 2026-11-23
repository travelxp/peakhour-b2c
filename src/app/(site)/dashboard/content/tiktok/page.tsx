import { Suspense } from "react";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { OAuthConnectResult } from "@/components/integrations/oauth-connect-result";
import { TikTokHub } from "./_components/tiktok-hub";

export default function TikTokHubPage() {
  return (
    <PageShell width="wide">
      <PageHeader title="TikTok" description="Your TikTok account, and the posts you have approved for it." />
      {/* Connect and Reconnect return here: say "TikTok connected." and refresh the connection state. */}
      <Suspense fallback={null}>
        <OAuthConnectResult />
      </Suspense>
      <Suspense fallback={null}>
        <TikTokHub />
      </Suspense>
    </PageShell>
  );
}
