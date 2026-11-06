import { redirect } from "next/navigation";
import { DEMAND_REDIRECT_HREF } from "@/lib/insights";

/** "What shoppers asked for" is the Insights tab in the Inbox now, on Product demand. The address stays alive for saved links. */
export default function CommerceDemandPage() {
  redirect(DEMAND_REDIRECT_HREF);
}
