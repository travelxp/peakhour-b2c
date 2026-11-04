"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API_BASE_URL } from "@/lib/api";
import { useCreditCharges, useCreditsRateCard } from "@/hooks/use-credits";
import { CHARGES_CSV_PATH, chargeAmount, chargeCount, chargeStatusText, chargeWhen, shopperChargesCopy, shopperReplyPeaks } from "@/lib/charge-record";

/**
 * Every charge, one line each: what was done, when, how many Peaks, and whether it
 * was given back. Read from the ledger itself, so a line is the number that moved
 * the balance. Beside it, an honest paragraph about the charges nobody pressed a
 * button for (a shopper writing to the chat).
 */
export function ChargeRecordCard() {
  const charges = useCreditCharges();
  const rateCard = useCreditsRateCard();
  const [downloading, setDownloading] = useState(false);

  const lines = charges.data?.pages.flatMap((p) => p.charges) ?? [];
  const shopper = shopperChargesCopy(shopperReplyPeaks(rateCard.data?.useCases));

  // Fetched as a blob with the session cookie, not a bare link: an expired session
  // becomes a message here instead of a JSON error in a dead tab.
  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE_URL}${CHARGES_CSV_PATH}`, { credentials: "include" });
      if (!res.ok) {
        toast.error(res.status === 401 ? "Your session expired. Refresh the page and try again." : "We could not make that file. Try again in a moment.");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "peakhour-charges.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("We could not make that file. Try again in a moment.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{shopper.heading}</CardTitle>
          <CardDescription className="mt-1">{shopper.body}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground">{shopper.control}</CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Charge record</CardTitle>
              <CardDescription className="mt-1">
                Every charge, newest first: what was done, when, and how many Peaks. A charge that was given back stays in the list, marked Refunded, and the refund is its own line, with the reason and the charge it is for.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => void download()} disabled={downloading || lines.length === 0}>
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {charges.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : charges.isError ? (
            <p className="p-6 text-sm text-muted-foreground">We could not load your charges. Refresh the page to try again.</p>
          ) : lines.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing has been charged yet. Each charge will appear here.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>What was done</TableHead>
                    <TableHead className="text-right">Peaks</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((c) => (
                    <TableRow key={c.id} data-line-kind={c.kind}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{chargeWhen(c.at)}</TableCell>
                      <TableCell className="font-medium">{c.task}</TableCell>
                      <TableCell className="text-right tabular-nums">{chargeAmount(c.credits)}</TableCell>
                      <TableCell>
                        {c.status === "charged" ? <span className="text-xs text-muted-foreground">{chargeStatusText(c)}</span> : <Badge variant="secondary">{chargeStatusText(c)}</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between gap-3 p-4">
                <p className="text-xs text-muted-foreground">{chargeCount(lines.filter((l) => l.kind === "charge").length, lines.filter((l) => l.kind === "refund").length)} shown</p>
                {charges.hasNextPage && (
                  <Button variant="outline" size="sm" onClick={() => void charges.fetchNextPage()} disabled={charges.isFetchingNextPage}>
                    {charges.isFetchingNextPage ? "Loading…" : "Show more"}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
