import { PageShell } from "@/components/dashboard/page-shell";
import { RepurposedReview } from "./_components/repurposed-review";

/**
 * /dashboard/content/repurposed/:id: one repurposed batch, each channel's text and media, Approve and Reject.
 * Opened from "Needs your OK". The same decision a WhatsApp YES makes; free, no AI call.
 */
export default async function RepurposedBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell width="standard">
      <RepurposedReview id={id} />
    </PageShell>
  );
}
