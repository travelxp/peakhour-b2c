"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * Tax details + invoices (multi-entity-billing-tax-plan.md Phase 2). Buyers set
 * their GSTIN (India input credit), VAT id (UK reverse charge) and place of
 * supply, and download their self-issued tax invoices. Self-contained so it
 * mounts on the existing billing settings page.
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

export function TaxAndInvoices() {
  const qc = useQueryClient();

  const { data: profile } = useQuery<{ billingProfile: BillingProfile }>({
    queryKey: ["/v1/billing/profile"],
    queryFn: () => api.get<{ billingProfile: BillingProfile }>("/v1/billing/profile"),
  });
  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["/v1/billing/invoices"],
    queryFn: () => api.get<Invoice[]>("/v1/billing/invoices"),
  });

  const [form, setForm] = useState<BillingProfile>({});
  useEffect(() => {
    if (profile?.billingProfile) setForm(profile.billingProfile);
  }, [profile]);

  const save = useMutation({
    mutationFn: (body: BillingProfile) => api.put("/v1/billing/profile", body),
    onSuccess: () => {
      toast.success("Tax details saved");
      qc.invalidateQueries({ queryKey: ["/v1/billing/profile"] });
    },
    onError: () => toast.error("Couldn't save tax details"),
  });

  const set = (k: keyof BillingProfile, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const rows = invoices ?? [];

  return (
    <div className="rounded-2xl border bg-muted/30 px-5 pt-4 pb-5 space-y-6">
      <div>
        <h3 className="font-semibold">Tax details</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Add your GSTIN (India) or VAT number (UK) so it appears on your tax invoices.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { k: "legalName" as const, label: "Registered name", ph: "Acme Pvt Ltd" },
          { k: "gstin" as const, label: "GSTIN (India)", ph: "22AAAAA0000A1Z5" },
          { k: "vatId" as const, label: "VAT number (UK/EU)", ph: "GB123456789" },
          { k: "placeOfSupplyState" as const, label: "State (place of supply)", ph: "MH" },
          { k: "billingEmail" as const, label: "Billing email", ph: "billing@acme.com" },
        ].map((f) => (
          <div key={f.k} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <Input value={form[f.k] ?? ""} placeholder={f.ph} onChange={(e) => set(f.k, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save tax details"}
        </Button>
      </div>

      <div className="pt-2">
        <h3 className="font-semibold">Invoices</h3>
        {rows.length === 0 ? (
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
                  <a href={`${API_BASE_URL}/v1/billing/invoices/${inv._id}/pdf`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">Download</Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
