import type { Metadata } from "next";
import { SharePage } from "@/components/drive/share-page";

/**
 * /share/<token>: where a Drive share link lands (owner decision 2026-11-04). PUBLIC by design: the person opening it has no Peakhour
 * account, and the middleware lists `/share` so the coming-soon gate does not hide it. The page tells the visitor what opening the link
 * records BEFORE the file is served (see components/drive/share-page.tsx). Kept out of search and out of Referer headers: the token in
 * this URL is the credential, and the file's host must not receive it.
 */
export const metadata: Metadata = {
  title: "Shared file | Peakhour.ai",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ShareLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharePage token={token} />;
}
