import Link from "next/link";
import { FlowButton, FlowNotice } from "@/components/marketing/flow/flow-kit";
import { CLOSE_TAB_HINT, type DoneCopy } from "./claim-copy";

/**
 * The hosted claim page's success state. Split out of shopify-claim.tsx so it can be rendered on its own.
 *
 * The page opens in a tab the Shopify app made, so the merchant's way back is that app: the line says so, and "Go to
 * dashboard" stays for anyone who wants Peakhour itself.
 */
export function ClaimDone({ done }: { done: DoneCopy }) {
  return (
    <div className="space-y-3">
      <FlowNotice tone="ok" role="status">
        <p className="font-bold">{done.title}</p>
        <p className="mt-1">{done.body}</p>
      </FlowNotice>
      <p className="text-sm text-muted-foreground">{CLOSE_TAB_HINT}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <FlowButton asChild className="sm:flex-1">
          <Link href="/dashboard">Go to dashboard</Link>
        </FlowButton>
        {done.integrationsHint && (
          <FlowButton asChild variant="ghost" className="sm:flex-1">
            <Link href="/dashboard/integrations">See it in Connected accounts</Link>
          </FlowButton>
        )}
      </div>
    </div>
  );
}
