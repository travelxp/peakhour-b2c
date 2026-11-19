import type { Metadata } from "next";
import { ComingSoon } from "@/components/studio/coming-soon";
import { STUDIO_COPY } from "@/lib/studio-copy";

/**
 * Approval by link, no login (UX spec S18, Pro tools). PUBLIC like the Drive share link: the person has no Peakhour account, so it lives
 * under /share, not under the signed-in dashboard (the spec names /dashboard/studio/s/[token], which a signed-out visitor could not open).
 * A shell for now: the token is never read, and nothing is shown that could leak a picture. The token in the URL is the credential, so
 * the page stays out of search and out of Referer headers.
 */
export const metadata: Metadata = {
  title: "Does this look right? | Peakhour.ai",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function StudioApprovalLinkPage() {
  const copy = STUDIO_COPY.shells.approvalLink;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <ComingSoon title={STUDIO_COPY.shells.comingSoonTitle} description={copy.description} />
    </main>
  );
}
