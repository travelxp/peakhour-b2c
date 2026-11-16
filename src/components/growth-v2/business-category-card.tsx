"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useDashboardOrg, useCanChangeCategory, DASHBOARD_ORG_KEY } from "@/hooks/use-dashboard-org";
import { useAuth } from "@/providers/auth-provider";
import { categoryChangeWords, categoryLabel, type CategoryChangeResult } from "@/lib/business-category";

/**
 * The business category (FR), on "Your business". A first guess can be wrong (a travel business read as "Other" is never offered
 * bookings and gets the default playbook), and this is where the merchant corrects it. An owner or admin saves; anyone else reads it.
 * Changing it saves at once; a plan that exists is never moved without the link and code (the api proposes the move and says so).
 */
export function BusinessCategoryCard() {
  const can = useCanChangeCategory();
  const { business } = useAuth();
  const { data } = useDashboardOrg();
  const qc = useQueryClient();
  const options = data?.businessCategoryOptions ?? [];
  const current = data?.businessCategory ?? "";
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  // an unsaved pick belongs to the business it was made on: switching business drops it
  const businessId = business?._id ?? "";
  const [pickedFor, setPickedFor] = useState(businessId);
  if (pickedFor !== businessId) {
    setPickedFor(businessId);
    setPicked(null);
    setSaid(null);
  }
  // a pick that the refetch has caught up with is no longer a pick
  const value = picked !== null && picked !== current ? picked : current;

  async function save() {
    if (!value || value === current) return;
    setSaving(true);
    setSaid(null);
    try {
      const r = await api.put<{ updated: boolean; category?: CategoryChangeResult }>("/v1/dashboard/org", { businessCategory: value });
      setSaid(r.category ? categoryChangeWords(r.category) : { text: "Saved.", tone: "ok" });
      // `picked` is kept until `current` catches up, so the select never snaps back to the old category (or stays there if the refetch fails)
      // the cohorts, the playbook and the offered goals all follow the category; a refetch that fails is not a save that failed
      await Promise.all([qc.invalidateQueries({ queryKey: [DASHBOARD_ORG_KEY] }), qc.invalidateQueries({ queryKey: ["growth-v2"] })]).catch(() => undefined);
    } catch (e) {
      setSaid({ text: e instanceof ApiError && e.status === 403 ? "Only an owner or admin can change the category." : "We could not save that. Try again in a moment.", tone: "warn" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Business category</CardTitle>
        <CardDescription>It decides which goals Peakhour can offer you and which playbook your plan starts from. If we guessed wrong, change it here.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">{categoryLabel(current, options) ?? "Not set yet."}</p>
        ) : can ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="business-category" className="sr-only">
              Business category
            </label>
            <select id="business-category" className="h-9 rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => {
                setPicked(e.target.value);
                setSaid(null);
              }} disabled={saving}>
              {current === "" ? <option value="">Choose one</option> : null}
              {current !== "" && !options.some((o) => o.value === current) ? <option value={current}>{categoryLabel(current, options)}</option> : null}
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" onClick={save} disabled={saving || !value || value === current}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium">{categoryLabel(current, options) ?? "Not set yet."}</p>
            <p className="text-xs text-muted-foreground">Only an owner or admin can change this.</p>
          </>
        )}
        {said ? (
          <p role="status" className={said.tone === "warn" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {said.text}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
