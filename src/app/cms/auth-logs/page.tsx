"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TimeRangeSelector } from "@/components/cms/ai/time-range-selector";
import { formatDateTime } from "@/components/cms/ai/format";

interface LogRow {
  timestamp: string;
  event?: string;
  channel?: string;
  platform?: string;
  userId?: string;
  success?: boolean;
  reason?: string;
  requestId?: string;
  metadata?: { ip?: string; userAgent?: string; country?: string; state?: string; city?: string };
}

interface LogsResponse {
  total: number;
  offset: number;
  limit: number;
  rows: LogRow[];
}

const EVENT_OPTIONS = [
  "OTP_SENT", "OTP_VERIFIED", "OTP_FAILED", "OTP_EXPIRED", "OTP_MAX_ATTEMPTS",
  "MAGIC_LINK_REQUEST", "MAGIC_LINK_GENERATED", "MAGIC_LINK_SENT",
  "MAGIC_LINK_VERIFIED", "MAGIC_LINK_FAILED",
  "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT", "SESSION_EXPIRED", "SUSPICIOUS_ACTIVITY",
];

export default function AuthLogsPage() {
  const [days, setDays] = useState("7");
  const [event, setEvent] = useState("all");
  const [success, setSuccess] = useState("all");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["cms-auth-logs", days, event, success, userId, page],
    queryFn: () => {
      const params: Record<string, string> = {
        days,
        limit: String(limit),
        offset: String(page * limit),
      };
      if (event !== "all") params.event = event;
      if (success !== "all") params.success = success;
      if (userId) params.userId = userId;
      return api.get<LogsResponse>("/v1/cms/auth-logs", params);
    },
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const lastPage = Math.max(0, Math.ceil(total / limit) - 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Auth Logs</h2>
        <p className="text-muted-foreground mt-1">
          Combined view of routine (90d) and security (730d) auth events.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <TimeRangeSelector
            value={days}
            onChange={(v) => { setDays(v); setPage(0); }}
            options={[
              { value: "1", label: "Last 24 hours" },
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
              { value: "730", label: "Last 2 years (security)" },
            ]}
          />
          <Select value={event} onValueChange={(v) => { setEvent(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="Event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {EVENT_OPTIONS.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={success} onValueChange={(v) => { setSuccess(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="true">Success only</SelectItem>
              <SelectItem value="false">Failures only</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="User ID (ObjectId)"
            value={userId}
            onChange={(e) => { setUserId(e.target.value); setPage(0); }}
          />
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${total.toLocaleString()} matches`}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Geo</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No logs match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, i) => (
                  <TableRow key={`${row.timestamp}-${i}`}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDateTime(row.timestamp)}</TableCell>
                    <TableCell className="font-mono text-xs">{row.event}</TableCell>
                    <TableCell>
                      {row.success ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">success</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">failure</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{row.channel || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.userId || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {[row.metadata?.city, row.metadata?.state, row.metadata?.country].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.reason || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {page + 1} of {lastPage + 1}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
