"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { googleAdsApi, type GoogleAdAccount, type GoogleAccountReportRow, type GoogleReport, type GoogleReportKey } from "@/lib/api/google-ads";
import { localIsoDay } from "@/lib/google-ads-view";
import {
  GOOGLE_ACCOUNT_NOT_SERVED_NOTE,
  GOOGLE_REPORT_COLUMNS,
  GOOGLE_REPORT_DEFAULT_RANGE_LABEL,
  GOOGLE_REPORT_TABS,
  GOOGLE_REPORT_TRUNCATED_NOTE,
  GOOGLE_REPORTS_MEASUREMENT_NOTE,
  googleAccountHasNotServed,
  googleReportEmptySentence,
  googleReportErrorMessage,
  googleReportRangeProblem,
  googleReportRowKey,
  type GoogleReportColumn,
} from "@/lib/google-reports-view";

/**
 * ★★G-14d — Google's own reports on the Google panel: the six tables Google's
 * Required Minimum Functionality asks for (R.10 Account, R.20 Campaign, R.40
 * Ad, R.50 Keyword, R.70 Search term, R.130 Bidding strategy), every required
 * column shown by default (`lib/google-reports-view.ts` owns the columns and
 * the words).
 *
 * ★ONE TABLE AT A TIME, READ LIVE. Each table is one Google Ads query, one
 * operation against the project's daily quota (peakhour-api
 * `services/ads/google-reports.ts` has the live-or-cache decision), so only
 * the table on screen is read, kept five minutes, and nothing is prefetched.
 *
 * ★LAST 30 DAYS BY DEFAULT, or a custom range (RMF's date-range
 * recommendation). Days are the account's: Google reads a range in the
 * account's time zone.
 *
 * Its own file so the panel only mounts it (G14a mounts into the same panel).
 */

const REPORT_STALE_MS = 5 * 60_000;

type AppliedRange = { from: string; to: string } | null;

export function GoogleReportsSection({ account }: { account: GoogleAdAccount }) {
  const [tab, setTab] = useState<GoogleReportKey>("account");
  const [mode, setMode] = useState<"last30" | "custom">("last30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<AppliedRange>(null);
  const today = localIsoDay(new Date());
  const problem = mode === "custom" ? googleReportRangeProblem(from, to, today) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Ads reports</CardTitle>
        <CardDescription>{GOOGLE_REPORTS_MEASUREMENT_NOTE}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Dates</Label>
            <Select
              value={mode}
              onValueChange={(v) => {
                const next = v === "custom" ? "custom" : "last30";
                setMode(next);
                if (next === "last30") setApplied(null);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last30">{GOOGLE_REPORT_DEFAULT_RANGE_LABEL}</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "custom" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="google-report-from" className="text-xs text-muted-foreground">
                  From
                </Label>
                <Input id="google-report-from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="google-report-to" className="text-xs text-muted-foreground">
                  To
                </Label>
                <Input id="google-report-to" type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </div>
              <Button type="button" variant="outline" disabled={problem !== null} onClick={() => setApplied({ from, to })}>
                Show
              </Button>
              {problem && (from || to) ? <p className="w-full text-xs text-muted-foreground">{problem}</p> : null}
            </>
          ) : null}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as GoogleReportKey)}>
          <TabsList className="flex h-auto flex-wrap">
            {GOOGLE_REPORT_TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Keyed by table, account and range: only the table on screen is read. */}
        <ReportTable key={`${account.id}-${tab}-${applied ? `${applied.from}_${applied.to}` : "last30"}`} account={account} report={tab} range={applied} />
      </CardContent>
    </Card>
  );
}

function ReportTable({ account, report, range }: { account: GoogleAdAccount; report: GoogleReportKey; range: AppliedRange }) {
  const meta = GOOGLE_REPORT_TABS.find((t) => t.key === report)!;
  const query = useQuery({
    queryKey: ["google-ads-report", account.id, report, range?.from ?? null, range?.to ?? null],
    queryFn: () => googleAdsApi.getReport(report, account.id, range ?? undefined),
    retry: false,
    staleTime: REPORT_STALE_MS,
    // ★EACH READ IS A GOOGLE ADS OPERATION (review round 1): a tab refocus
    //  or a remount past the stale time is not a merchant asking again.
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // ★`isPending`, NOT `isLoading` (review round 1): a query paused offline has
  //  no data and no error, and `isLoading` is false then — the table would
  //  read as an account that never served.
  if (query.isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  // A failed read is NOT an empty report.
  if (query.isError) return <p className="text-sm text-destructive-on-tint">{googleReportErrorMessage(query.error)}</p>;
  const data = query.data as GoogleReport | undefined;
  const rows = data?.rows ?? [];
  const columns = GOOGLE_REPORT_COLUMNS[report] as ReadonlyArray<GoogleReportColumn<(typeof rows)[number]>>;
  const notServed = report === "account" && rows.length > 0 && googleAccountHasNotServed(rows as GoogleAccountReportRow[]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{meta.note}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{googleReportEmptySentence(report)}</p>
      ) : (
        <>
          {notServed ? <p className="text-sm text-muted-foreground">{GOOGLE_ACCOUNT_NOT_SERVED_NOTE}</p> : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={c.numeric ? "text-right" : undefined}>
                      {c.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={googleReportRowKey(report, row, i)}>
                    {columns.map((c) => (
                      <TableCell key={c.key} className={c.numeric ? "text-right tabular-nums" : undefined}>
                        {c.cell(row, account.currencyCode)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data?.truncated ? <p className="text-xs text-muted-foreground">{GOOGLE_REPORT_TRUNCATED_NOTE}</p> : null}
        </>
      )}
    </div>
  );
}
