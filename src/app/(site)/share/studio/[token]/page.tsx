import type { Metadata } from "next";
import { ApprovalPage } from "@/components/studio/approval-page";

/**
 * Approval by link, no login (UX spec S18, Pro tools). PUBLIC like the Drive share link: the person has no Peakhour account, so it lives under /share, not under the signed-in
 * dashboard (the spec names /dashboard/studio/s/[token], which a signed-out visitor could not open). The page asks the api for the one picture the token opens (a token-scoped
 * read) and shows nothing else. The token in the URL is the credential, so the page stays out of search and out of Referer headers.
 */
export const metadata: Metadata = {
  title: "Does this look right? | Peakhour.ai",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function StudioApprovalLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ApprovalPage token={token} />;
}
