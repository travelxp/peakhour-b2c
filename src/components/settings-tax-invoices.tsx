"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, API_BASE_URL, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Tax details + invoices (multi-entity-billing-tax-plan.md Phase 2). Buyers set
 * their GSTIN (India input credit), VAT id (cross-border reverse charge) and
 * place of supply, and download their self-issued tax invoices. Self-contained
 * so it mounts on the existing billing settings page.
 */

type BillingProfile = {
  legalName?: string;
  gstin?: string;
  vatId?: string;
  placeOfSupplyState?: string;
  billingEmail?: string;
};

type Invoice = {
  _id: string;
  invoiceNumber: string;
  issuedAt: string;
  currency: string;
  grandTotal: string;
  status: string;
};

/** Canonical numeric GST state codes (the same 2 digits a GSTIN embeds) — the
 *  api validates place-of-supply as exactly this code, and the invoice engine
 *  compares it against the seller's GSTIN state for CGST+SGST vs IGST. */
const GST_STATES: Array<[string, string]> = [
  ["01", "Jammu & Kashmir"], ["02", "Himachal Pradesh"], ["03", "Punjab"],
  ["04", "Chandigarh"], ["05", "Uttarakhand"], ["06", "Haryana"],
  ["07", "Delhi"], ["08", "Rajasthan"], ["09", "Uttar Pradesh"],
  ["10", "Bihar"], ["11", "Sikkim"], ["12", "Arunachal Pradesh"],
  ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"],
  ["16", "Tripura"], ["17", "Meghalaya"], ["18", "Assam"],
  ["19", "West Bengal"], ["20", "Jharkhand"], ["21", "Odisha"],
  ["22", "Chhattisgarh"], ["23", "Madhya Pradesh"], ["24", "Gujarat"],
  ["26", "Dadra & Nagar Haveli and Daman & Diu"], ["27", "Maharashtra"],
  ["29", "Karnataka"], ["30", "Goa"], ["31", "Lakshadweep"],
  ["32", "Kerala"], ["33", "Tamil Nadu"], ["34", "Puducherry"],
  ["35", "Andaman & Nicobar Islands"], ["36", "Telangana"],
  ["37", "Andhra Pradesh"], ["38", "Ladakh"],
];

// Mirror the server's PUT /v1/billing/profile validation so a typo fails inline
// instead of landing on (or zero-rating) a statutory invoice.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const VAT_RE = /^[A-Z]{2}[0-9A-Z]{2,13}$/;

function validateForm(f: BillingProfile): string | null {
  const gstin = (f.gstin ?? "").trim().toUpperCase();
  if (gstin && !GSTIN_RE.test(gstin)) {
    return "That GSTIN doesn't look right — it's 15 characters, e.g. 22AAAAA0000A1Z5";
  }
  const vat = (f.vatId ?? "").trim().toUpperCase();
  if (vat && !VAT_RE.test(vat)) {
    return "That VAT number doesn't look right — it starts with a 2-letter country code, e.g. GB123456789";
  }
  if (gstin && f.placeOfSupplyState && gstin.slice(0, 2) !== f.placeOfSupplyState) {
    return `Your GSTIN starts with state code ${gstin.slice(0, 2)} but the selected state is ${f.placeOfSupplyState} — they should match`;
  }
  return null;
}

const NONE_STATE = "none";

export function TaxAndInvoices() {
  const qc = useQueryClient();

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery<{ billingProfile: BillingProfile }>({
    queryKey: ["/v1/billing/profile"],
    queryFn: () => api.get<{ billingProfile: BillingProfile }>("/v1/billing/profile"),
  });
  const {
    data: invoices,
    isLoading: invoicesLoading,
    error: invoicesError,
  } = useQuery<Invoice[]>({
    queryKey: ["/v1/billing/invoices"],
    queryFn: () => api.get<Invoice[]>("/v1/billing/invoices"),
  });

  const [form, setForm] = useState<BillingProfile>({});
  // Only hydrate from the server while the user hasn't typed — a focus/reconnect
  // refetch must never wipe in-progress edits.
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (profile?.billingProfile && !dirtyRef.current) setForm(profile.billingProfile);
  }, [profile]);

  const save = useMutation({
    mutationFn: (body: BillingProfile) => api.put("/v1/billing/profile", body),
    onSuccess: () => {
      toast.success("Tax details saved");
      dirtyRef.current = false;
      qc.invalidateQueries({ queryKey: ["/v1/billing/profile"] });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Couldn't save tax details"),
  });

  const set = (k: keyof BillingProfile, v: string) => {
    dirtyRef.current = true;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const onSave = () => {
    const err = validateForm(form);
    if (err) {
      toast.error(err);
      return;
    }
    save.mutate({
      ...form,
      gstin: (form.gstin ?? "").trim().toUpperCase(),
      vatId: (form.vatId ?? "").trim().toUpperCase(),
    });
  };

  const [downloading, setDownloading] = useState<string | null>(null);
  // Fetch the PDF as a blob (cookie auth) instead of a raw <a href> — an
  // expired session then surfaces as a toast, not a JSON error in a dead tab,
  // and mobile Safari gets a proper download.
  const download = async (inv: Invoice) => {
    setDownloading(inv._id);
    try {
      const res = await fetch(`${API_BASE_URL}/v1/billing/invoices/${inv._id}/pdf`, {
        credentials: "include",
      });
      if (!res.ok) {
        toast.error(
          res.status === 401
            ? "Your session expired — refresh the page and try again"
            : "Couldn't download the invoice. Please try again.",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoiceNumber.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't download the invoice. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const rows = invoices ?? [];

  return (
    <div className="rounded-2xl border bg-muted/30 px-5 pt-4 pb-5 space-y-6">
      <div>
        <h3 className="font-semibold">Tax details</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Add your GSTIN (India) or VAT number (UK/EU) so it appears on your tax invoices.
        </p>
      </div>

      {profileError ? (
        <p className="text-destructive text-sm">Couldn&apos;t load your tax details — refresh to try again.</p>
      ) : profileLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { k: "legalName" as const, label: "Registered name", ph: "Acme Pvt Ltd" },
              { k: "gstin" as const, label: "GSTIN (India)", ph: "22AAAAA0000A1Z5" },
              { k: "vatId" as const, label: "VAT number (UK/EU)", ph: "GB123456789" },
              { k: "billingEmail" as const, label: "Billing email", ph: "billing@acme.com" },
            ].map((f) => (
              <div key={f.k} className="space-y-1">
                <label htmlFor={`tax-${f.k}`} className="text-xs font-medium text-muted-foreground">
                  {f.label}
                </label>
                <Input
                  id={`tax-${f.k}`}
                  value={form[f.k] ?? ""}
                  placeholder={f.ph}
                  onChange={(e) => set(f.k, e.target.value)}
                />
              </div>
            ))}
            <div className="space-y-1">
              <label htmlFor="tax-pos" className="text-xs font-medium text-muted-foreground">
                State (place of supply, India)
              </label>
              <Select
                value={form.placeOfSupplyState || NONE_STATE}
                onValueChange={(v) => set("placeOfSupplyState", v === NONE_STATE ? "" : v)}
              >
                <SelectTrigger id="tax-pos">
                  <SelectValue placeholder="Select your state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_STATE}>Not applicable</SelectItem>
                  {GST_STATES.map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {code} — {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onSave} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save tax details"}
            </Button>
          </div>
        </>
      )}

      <div className="pt-2">
        <h3 className="font-semibold">Invoices</h3>
        {invoicesError ? (
          <p className="text-destructive text-sm mt-1">Couldn&apos;t load your invoices — refresh to try again.</p>
        ) : invoicesLoading ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-muted/60" />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm mt-1">Your tax invoices will appear here after your first payment.</p>
        ) : (
          <div className="mt-3 divide-y rounded-xl border">
            {rows.map((inv) => (
              <div key={inv._id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm truncate">{inv.invoiceNumber}</div>
                  <div className="text-muted-foreground text-xs">
                    {new Date(inv.issuedAt).toLocaleDateString()} · {inv.currency} {inv.grandTotal}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{inv.status}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloading === inv._id}
                    onClick={() => download(inv)}
                  >
                    {downloading === inv._id ? "Downloading…" : "Download"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
