import { redirect } from "next/navigation";
import { DEMAND_REDIRECT_HREF, carryQuery } from "@/lib/insights";

/** "What shoppers asked for" is the Insights tab in the Inbox now, on Product demand. The address stays alive for saved links, with its query string. */
export default async function CommerceDemandPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(carryQuery(DEMAND_REDIRECT_HREF, await searchParams));
}
