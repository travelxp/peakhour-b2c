import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className="flex items-center gap-2 text-sm font-medium text-success-on-tint">
        <CheckCircle2 className="size-5" aria-hidden />
        {done.title}
      </div>
      <p className="text-sm text-muted-foreground">{done.body}</p>
      <p className="text-sm text-muted-foreground">{CLOSE_TAB_HINT}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        {done.integrationsHint && (
          <Button asChild variant="outline">
            <Link href="/dashboard/integrations">See it in Connected accounts</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
