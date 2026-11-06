import { redirect } from "next/navigation";
import { insightsHref } from "@/lib/insights";

/**
 * Support results, and the counts of what the WhatsApp assistant reached, are on the Insights tab in the Inbox now ("How conversations
 * are going"). The page held nothing else, so the address redirects; it stays alive for saved links and the WhatsApp page's link.
 */
export default function SupportResultsPage() {
  redirect(insightsHref());
}
