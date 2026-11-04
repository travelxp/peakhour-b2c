"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CategoryPicker } from "@/components/presence/edit/category-picker";
import type { PresenceListing } from "@/lib/presence-panels";
import {
  categoriesValue,
  charsLeft,
  descriptionValue,
  hoursDraft,
  hoursValue,
  phoneDraft,
  phoneValue,
  specialDraft,
  specialValue,
  type SpecialDraft,
  riskWarning,
  websiteValue,
  withCategory,
  type Built,
  type CategoryOption,
  type DayDraft,
  type DrawnSection,
  type EditField,
  type NetworkCapability,
  type PhoneDraft,
} from "@/lib/presence-edit";

const DAY_NAMES: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

interface Props {
  section: DrawnSection;
  cap: NetworkCapability;
  listing: PresenceListing;
  listingId: string;
  submitting: boolean;
  onSubmit: (field: EditField, value: unknown) => void;
  onCancel: () => void;
}

/**
 * The form for ONE field. Every form submits exactly one field (so a risky field is never mixed with another), builds the WHOLE value (lists
 * are sent whole), and says "Review change", never "Save": a submit makes a proposal, and a person approves it.
 * Values and their checks are `lib/presence-edit.ts`; the api checks again.
 */
export function FieldForm({ section, cap, listing, listingId, submitting, onSubmit, onCancel }: Props) {
  const { field } = section;
  const [message, setMessage] = useState<string | null>(null);
  const [understood, setUnderstood] = useState(!section.risky);

  const [hours, setHours] = useState<DayDraft[]>(() => hoursDraft(listing.regularHours));
  const [description, setDescription] = useState(listing.description ?? "");
  const [phones, setPhones] = useState<PhoneDraft>(() => phoneDraft(listing.contact as { phone?: string; additionalPhones?: string[] } | null));
  const [days, setDays] = useState<SpecialDraft[]>(() => specialDraft(listing.specialHours));
  const [website, setWebsite] = useState(listing.contact?.website ?? "");
  const [closed, setClosed] = useState(true);
  const [name, setName] = useState(listing.name);
  const [address, setAddress] = useState({
    line1: listing.address?.line1 ?? "",
    line2: listing.address?.line2 ?? "",
    city: listing.address?.city ?? "",
    region: listing.address?.region ?? "",
    postalCode: listing.address?.postalCode ?? "",
    country: listing.address?.country ?? "",
  });
  // Categories are held by label on the listing (the network's id is not stored), so the form starts empty and a person picks from the list.
  const [extra, setExtra] = useState<CategoryOption[]>([]);
  const [primary, setPrimary] = useState<CategoryOption | null>(null);

  function finish<T>(built: Built<T>) {
    if (!built.ok) return setMessage(built.message);
    setMessage(null);
    onSubmit(field, built.value);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    switch (field) {
      case "regularHours":
        return finish(hoursValue(hours));
      case "description":
        return finish(descriptionValue(description, cap.limits.descriptionMaxLength));
      case "phone":
        return finish(phoneValue(phones, cap.limits));
      case "website":
        return finish(websiteValue(website));
      case "temporaryClosure":
        return finish({ ok: true, value: { closed } });
      case "additionalCategories":
        return finish(categoriesValue(extra, cap.limits));
      case "primaryCategory":
        return primary ? finish({ ok: true, value: primary }) : setMessage("Pick a category from the list.");
      case "name": {
        const v = name.trim();
        if (!v) return setMessage("Enter your business name.");
        if (cap.limits.nameMaxLength !== undefined && v.length > cap.limits.nameMaxLength) return setMessage("That name is too long.");
        return finish({ ok: true, value: v });
      }
      case "address": {
        if (!address.line1.trim() || !/^[A-Za-z]{2}$/.test(address.country.trim())) return setMessage("Enter the street address and a two-letter country code.");
        const clean = Object.fromEntries(Object.entries(address).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ""));
        return finish({ ok: true, value: { ...clean, country: address.country.trim().toUpperCase() } });
      }
      case "specialHours":
        return finish(specialValue(days));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border bg-muted/30 p-4">
      {section.risky && (
        <div className="space-y-1 rounded-md border border-warning/40 p-3">
          {riskWarning(field, cap.label).map((w, i) => (
            <p key={i} className="text-xs text-warning-on-tint">
              {w}
            </p>
          ))}
          <label className="flex items-center gap-2 pt-1 text-xs">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />I understand
          </label>
        </div>
      )}

      {field === "regularHours" && (
        <div className="space-y-2">
          {hours.map((d, di) => (
            <div key={d.day} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm">{DAY_NAMES[d.day]}</span>
              {d.periods.length === 0 && <span className="text-sm text-muted-foreground">Closed</span>}
              {d.periods.map((p, pi) => (
                <span key={pi} className="flex items-center gap-1">
                  <Input aria-label={`${DAY_NAMES[d.day]} opens`} type="time" className="w-28" value={p.open} onChange={(e) => setHours(hours.map((x, i) => (i === di ? { ...x, periods: x.periods.map((y, j) => (j === pi ? { ...y, open: e.target.value } : y)) } : x)))} />
                  <span className="text-xs">to</span>
                  <Input aria-label={`${DAY_NAMES[d.day]} closes`} type="time" className="w-28" value={p.close} onChange={(e) => setHours(hours.map((x, i) => (i === di ? { ...x, periods: x.periods.map((y, j) => (j === pi ? { ...y, close: e.target.value } : y)) } : x)))} />
                  <Button type="button" size="sm" variant="ghost" onClick={() => setHours(hours.map((x, i) => (i === di ? { ...x, periods: x.periods.filter((_, j) => j !== pi) } : x)))}>
                    Remove
                  </Button>
                </span>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setHours(hours.map((x, i) => (i === di ? { ...x, periods: [...x.periods, { open: "09:00", close: "17:00" }] } : x)))}>
                {d.periods.length ? "Add a period" : "Open this day"}
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">The whole week is sent, so a day with no period is closed.</p>
        </div>
      )}

      {field === "specialHours" && (
        <div className="space-y-2">
          {days.length === 0 && <p className="text-sm text-muted-foreground">No holiday hours set.</p>}
          {days.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input aria-label="Date" type="date" className="w-40" value={d.date} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
              <Input aria-label="What the day is" className="w-40" placeholder="Name (optional)" value={d.note} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={d.closed} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, closed: e.target.checked } : x)))} /> Closed
              </label>
              {!d.closed && (
                <>
                  <Input aria-label="Opens" type="time" className="w-28" value={d.open} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} />
                  <span className="text-xs">to</span>
                  <Input aria-label="Closes" type="time" className="w-28" value={d.close} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} />
                </>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={() => setDays(days.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => setDays([...days, { date: "", closed: true, open: "09:00", close: "17:00", note: "" }])}>
            Add a day
          </Button>
          <p className="text-xs text-muted-foreground">The whole list is sent, so a day you remove here is removed. You need your regular opening hours set first.</p>
        </div>
      )}

      {field === "description" && (
        <div className="space-y-1">
          <Textarea aria-label="Description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {charsLeft(description, cap.limits.descriptionMaxLength)} Leave out web links, prices and offers: they are not allowed in a description.
          </p>
        </div>
      )}

      {field === "phone" && (
        <div className="space-y-2">
          <Input aria-label="Main phone number" value={phones.primary} onChange={(e) => setPhones({ ...phones, primary: e.target.value })} placeholder="Main number" />
          {phones.additional.map((n, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={`Other number ${i + 1}`} value={n} onChange={(e) => setPhones({ ...phones, additional: phones.additional.map((x, j) => (j === i ? e.target.value : x)) })} />
              <Button type="button" size="sm" variant="ghost" onClick={() => setPhones({ ...phones, additional: phones.additional.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => setPhones({ ...phones, additional: [...phones.additional, ""] })}>
            Add another number
          </Button>
          <p className="text-xs text-muted-foreground">The whole list is sent, so a number you remove here is removed.</p>
        </div>
      )}

      {field === "website" && <Input aria-label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />}

      {field === "temporaryClosure" && (
        <div className="space-y-1 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="closure" checked={closed} onChange={() => setClosed(true)} /> Temporarily closed
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="closure" checked={!closed} onChange={() => setClosed(false)} /> Open again
          </label>
        </div>
      )}

      {field === "name" && <Input aria-label="Business name" value={name} onChange={(e) => setName(e.target.value)} />}

      {field === "address" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(["line1", "line2", "city", "region", "postalCode", "country"] as const).map((k) => (
            <Input key={k} aria-label={k} placeholder={{ line1: "Street address", line2: "Address line 2", city: "Town or city", region: "State or region", postalCode: "Postcode", country: "Country code, for example GB" }[k]} value={address[k]} onChange={(e) => setAddress({ ...address, [k]: e.target.value })} />
          ))}
        </div>
      )}

      {field === "additionalCategories" && cap.options.categories && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">The whole list is sent, so pick every category you want to keep.</p>
          {extra.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {extra.map((c) => (
                <li key={c.id}>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setExtra(extra.filter((x) => x.id !== c.id))}>
                    {c.label} (remove)
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <CategoryPicker listingId={listingId} network={cap.network} exclude={extra.map((c) => c.id)} onPick={(c) => setExtra(withCategory(extra, c))} />
        </div>
      )}

      {field === "primaryCategory" && cap.options.categories && (
        <div className="space-y-2">
          <p className="text-sm">{primary ? `Chosen: ${primary.label}` : listing.primaryCategory ? `Now: ${listing.primaryCategory}` : "No main category set."}</p>
          <CategoryPicker listingId={listingId} network={cap.network} exclude={primary ? [primary.id] : []} onPick={setPrimary} />
        </div>
      )}

      {(field === "additionalCategories" || field === "primaryCategory") && !cap.options.categories && (
        <p className="text-xs text-muted-foreground">The list of categories is not available for this listing yet.</p>
      )}

      {message && (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting || !understood}>
          {submitting ? "Preparing..." : "Review change"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
