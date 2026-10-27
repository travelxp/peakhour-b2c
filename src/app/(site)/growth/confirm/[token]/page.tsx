import type { Metadata } from "next";
import { MandateConfirm } from "@/components/growth-v2/mandate-confirm";

/**
 * /growth/confirm/<token>: the page behind the link in `growth_mandate_confirm_v1` (H5).
 *
 * The template's link host is https://peakhour.ai/growth/confirm/{token}. PUBLIC by design: the person opening it from WhatsApp
 * may not be signed in; the one-time code on this page is what confirms. Kept out of search and out of Referer headers so the
 * token is not passed on.
 */
export const metadata: Metadata = {
  title: "Confirm your plan | Peakhour.ai",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function GrowthConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <MandateConfirm token={token} />;
}
