"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MetaLaunchError,
  metaAdsApi,
  type MetaAdAccount,
  type MetaAdSet,
  type MetaAdSetEdit,
  type MetaCampaign,
  type MetaCampaignEdit,
} from "@/lib/api/meta-ads";
import { metaAdAccountOptionLabel, metaAdsErrorMessage, metaAdsNeedsReconnect, metaBudgetLabel, metaCreatesInLine, metaInLine } from "@/lib/meta-ads-view";
import {
  EMPTY_NEW_CAMPAIGN,
  META_COUNTRY_CODES,
  META_CREATE_OBJECTIVES,
  META_CTAS,
  META_IMAGE_TYPES,
  buildAdSetEdit,
  buildCampaignEdit,
  budgetKey,
  buildCreateBodies,
  countryName,
  fileToBase64,
  isoToDayInZone,
  metaMinorToInput,
  readTargeting,
  validateNewCampaign,
  type AdSetEditForm,
  type MetaCta,
  type MetaCreateObjective,
  type NewCampaignForm,
} from "@/lib/meta-ads-form";

/**
 * MR-F1 — make a Meta campaign, change it, from the dashboard.
 *
 * ★WHY THIS DOES NOT GO THROUGH THE GROWTH ENGINE. The engine's create path is a proposal the engine
 * writes and a merchant approves (`adapters/ads/meta.ts`): it chooses the audience, budget and creative
 * itself. This is the merchant's own form, so it uses the managed routes the panel already reads and
 * pauses through — the ones that write the `ad_campaigns` row the budget cap, the weekly limit and the
 * kill switch read. A campaign made here is therefore watched exactly like one the engine made.
 *
 * ⏸EVERYTHING IS MADE PAUSED. Nothing here can spend; turning it on is the switch in the list.
 */

/** The image upload failed; its message is already merchant-facing. Any other Error is ours and is not shown raw. */
class UploadFailed extends Error {}

const ADS_KEYS = ["meta-ads-campaigns", "meta-ads-adsets", "meta-ads-ads", "meta-ads-insights"] as const;

function useRefreshAds(accountId: string) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ADS_KEYS) void queryClient.invalidateQueries({ queryKey: [key, accountId] });
  };
}

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} role="alert" className="text-xs text-destructive">
      {text}
    </p>
  ) : null;
}

// ── Countries ────────────────────────────────────────────────────────────

function CountryPicker({
  value,
  onChange,
  invalid,
  describedBy,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const options = useMemo(
    () => [...new Set([...META_COUNTRY_CODES, ...value])].map((code) => ({ code, name: countryName(code) })),
    [value],
  );
  const addable = options.filter((o) => !value.includes(o.code));
  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Chosen countries">
          {value.map((code) => (
            <li key={code}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {countryName(code)}
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-background/60"
                  aria-label={`Remove ${countryName(code)}`}
                  onClick={() => onChange(value.filter((c) => c !== code))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {/* A plain select: one list, no search needed, and it works the same on a phone. */}
      <select
        aria-label="Add a country"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        value=""
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        className="h-9 w-64 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{value.length ? "Add another country" : "Choose a country"}</option>
        {addable.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── New campaign ─────────────────────────────────────────────────────────

/**
 * ★THE ACCOUNT IS A CHOICE AMONG THE BUSINESS'S OWN. `accounts` is only the ad accounts the business has enabled (never the
 * whole login's), the Select is prefilled with the one the list is filtered to, else the business's default, and it is always
 * shown with two or more. The api refuses any other account as well.
 */
export function NewCampaignDialog({
  accounts,
  defaultAccountId,
  initialAccountId,
  onCreated,
}: {
  /** The business's enabled ad accounts: never empty (the caller renders no dialog without one). */
  accounts: MetaAdAccount[];
  /** The business's default, or null. */
  defaultAccountId: string | null;
  /** The account the campaigns list is filtered to, when it is filtered to one. */
  initialAccountId?: string | null;
  /** The new campaign's id and the account it was created in, so the list can open it. */
  onCreated: (campaignId: string, accountId: string) => void;
}) {
  const [pickedAccountId, setPickedAccountId] = useState<string | null>(null);
  const account =
    accounts.find((a) => a.id === pickedAccountId) ??
    accounts.find((a) => a.id === initialAccountId) ??
    accounts.find((a) => a.id === defaultAccountId) ??
    accounts[0]!;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewCampaignForm>(EMPTY_NEW_CAMPAIGN);
  const [file, setFile] = useState<File | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // ★ONE UPLOAD PER FILE: Meta's library is content-addressed, so a retry after a failed launch reuses the hash
  // instead of putting a duplicate in the merchant's account.
  const uploaded = useRef<{ key: string; hash: string } | null>(null);

  const page = useQuery({
    queryKey: ["meta-ads-page"],
    queryFn: () => metaAdsApi.getPage(),
    enabled: open,
    retry: false,
    staleTime: 60_000,
  });
  const pageRow = page.data?.page ?? null;

  const errors = validateNewCampaign(form, account.currency);
  const set = <K extends keyof NewCampaignForm>(key: K, value: NewCampaignForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const shown = showErrors ? errors : {};

  const reset = () => {
    setForm(EMPTY_NEW_CAMPAIGN);
    setFile(null);
    setShowErrors(false);
    setFailure(null);
    setPickedAccountId(null);
    uploaded.current = null;
  };

  const create = useMutation({
    // ★THE ACCOUNT IS A VARIABLE, not a closure: the Select is disabled while this runs, and whatever finishes invalidates the
    // account it was STARTED for.
    mutationFn: async (account: MetaAdAccount) => {
      if (!file || !pageRow) throw new Error("not ready");
      const key = `${account.id}|${file.name}|${file.size}|${file.lastModified}`;
      if (uploaded.current?.key !== key) {
        const upload = await metaAdsApi
          .uploadImage({
            adAccountId: account.id,
            name: file.name.slice(0, 100),
            contentType: file.type as "image/jpeg" | "image/png",
            data: await fileToBase64(file),
          })
          .catch((err: unknown) => {
            throw new UploadFailed(metaAdsErrorMessage(err, "Couldn't upload that image. Try a different one."));
          });
        uploaded.current = { key, hash: upload.imageHash };
      }
      const bodies = buildCreateBodies(form, {
        adAccountId: account.id,
        currency: account.currency,
        pageId: pageRow.id,
        imageHash: uploaded.current.hash,
      });
      return metaAdsApi.launchCampaign(bodies);
    },
    onSuccess: (made, target) => {
      for (const key of ADS_KEYS) void queryClient.invalidateQueries({ queryKey: [key, target.id] });
      setOpen(false);
      reset();
      toast.success("Campaign created and paused. Turn it on when you're ready.");
      onCreated(made.campaignId, target.id);
    },
    onError: (err: unknown, target) => {
      if (err instanceof MetaLaunchError) {
        const base = metaAdsErrorMessage(err.cause, "Meta didn't accept that campaign.");
        setFailure(
          err.leftBehind
            ? `${base} A paused campaign called "${form.name.trim()}" may be in your Meta account — remove it in Ads Manager before trying again.`
            : `${base} Nothing was created.`,
        );
      } else if (err instanceof UploadFailed) {
        setFailure(err.message);
      } else {
        setFailure(metaAdsErrorMessage(err, "Couldn't create the campaign. Nothing was created."));
      }
      for (const key of ADS_KEYS) void queryClient.invalidateQueries({ queryKey: [key, target.id] });
    },
  });

  const submit = () => {
    setShowErrors(true);
    setFailure(null);
    if (Object.keys(errors).length > 0 || !pageRow) return;
    create.mutate(account);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (create.isPending) return;
        // A closed dialog starts clean: no old form, and no old "may be in your Meta account" warning.
        if (!next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" />
          New campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            It starts paused, so nothing runs or costs anything until you turn it on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {accounts.length > 1 ? (
            <div className="space-y-1.5">
              <Label htmlFor="mc-account">Ad account</Label>
              <Select value={account.id} onValueChange={setPickedAccountId} disabled={create.isPending}>
                <SelectTrigger id="mc-account" className="w-full" aria-label="Ad account">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {metaAdAccountOptionLabel(a)}
                      {a.id === defaultAccountId ? " · default" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="mc-name">Campaign name</Label>
            <Input
              id="mc-name"
              value={form.name}
              maxLength={100}
              aria-invalid={Boolean(shown.name)}
              aria-describedby="mc-name-err"
              onChange={(e) => set("name", e.target.value)}
            />
            <FieldError id="mc-name-err" text={shown.name} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mc-goal">What do you want?</Label>
            <Select value={form.objective} onValueChange={(v) => set("objective", v as MetaCreateObjective)}>
              <SelectTrigger id="mc-goal" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {META_CREATE_OBJECTIVES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {META_CREATE_OBJECTIVES.find((o) => o.value === form.objective)?.hint}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mc-budget">Daily budget ({account.currency})</Label>
            <Input
              id="mc-budget"
              inputMode="decimal"
              value={form.dailyBudget}
              placeholder="10"
              className="w-40"
              aria-invalid={Boolean(shown.dailyBudget)}
              aria-describedby="mc-budget-err"
              onChange={(e) => set("dailyBudget", e.target.value)}
            />
            <FieldError id="mc-budget-err" text={shown.dailyBudget} />
            <p className="text-xs text-muted-foreground">
              Meta charges your ad account directly, in {account.currency}. This is the most it spends in a day.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Who should see it?</legend>
            <div className="space-y-1.5">
              <Label>Countries</Label>
              <CountryPicker
                value={form.countries}
                onChange={(next) => set("countries", next)}
                invalid={Boolean(shown.countries)}
                describedBy="mc-countries-err"
              />
              <FieldError id="mc-countries-err" text={shown.countries} />
            </div>
            <div className="flex gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="mc-age-min">Youngest age</Label>
                <Input
                  id="mc-age-min"
                  inputMode="numeric"
                  value={form.ageMin}
                  className="w-24"
                  aria-invalid={Boolean(shown.ageMin)}
                  aria-describedby="mc-age-min-err"
                  onChange={(e) => set("ageMin", e.target.value)}
                />
                <FieldError id="mc-age-min-err" text={shown.ageMin} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mc-age-max">Oldest age</Label>
                <Input
                  id="mc-age-max"
                  inputMode="numeric"
                  value={form.ageMax}
                  className="w-24"
                  aria-invalid={Boolean(shown.ageMax)}
                  aria-describedby="mc-age-max-err"
                  onChange={(e) => set("ageMax", e.target.value)}
                />
                <FieldError id="mc-age-max-err" text={shown.ageMax} />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Your ad</legend>
            {page.isLoading ? (
              <Skeleton className="h-5 w-64" />
            ) : page.isError ? (
              <p role="status" className="text-sm text-destructive">
                {metaAdsErrorMessage(page.error, "Couldn't read your Facebook Page just now. Close this and try again.")}
              </p>
            ) : pageRow ? (
              <p className="text-sm text-muted-foreground">
                Shown as <span className="font-medium text-foreground">{pageRow.name ?? "your saved Facebook Page"}</span>
              </p>
            ) : (
              <p role="status" className="text-sm text-destructive">
                No Facebook Page is saved for this business, and Meta ads are shown as a Page. Choose one under
                Connected accounts, then try again.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="mc-image">Image</Label>
              <Input
                id="mc-image"
                type="file"
                accept={META_IMAGE_TYPES.join(",")}
                aria-invalid={Boolean(shown.image)}
                aria-describedby="mc-image-err"
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  setFile(picked);
                  set("image", picked ? { type: picked.type, size: picked.size } : null);
                }}
              />
              <FieldError id="mc-image-err" text={shown.image} />
              <p className="text-xs text-muted-foreground">JPEG or PNG, up to 3 MB.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mc-headline">Headline</Label>
              <Input
                id="mc-headline"
                value={form.headline}
                maxLength={80}
                aria-invalid={Boolean(shown.headline)}
                aria-describedby="mc-headline-err"
                onChange={(e) => set("headline", e.target.value)}
              />
              <FieldError id="mc-headline-err" text={shown.headline} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mc-text">Text</Label>
              <Textarea
                id="mc-text"
                rows={3}
                value={form.text}
                maxLength={500}
                aria-invalid={Boolean(shown.text)}
                aria-describedby="mc-text-err"
                onChange={(e) => set("text", e.target.value)}
              />
              <FieldError id="mc-text-err" text={shown.text} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mc-link">Web address people go to</Label>
              <Input
                id="mc-link"
                type="url"
                inputMode="url"
                value={form.link}
                placeholder="https://"
                aria-invalid={Boolean(shown.link)}
                aria-describedby="mc-link-err"
                onChange={(e) => set("link", e.target.value)}
              />
              <FieldError id="mc-link-err" text={shown.link} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mc-cta">Button</Label>
              <Select value={form.cta} onValueChange={(v) => set("cta", v as MetaCta)}>
                <SelectTrigger id="mc-cta" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {META_CTAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </fieldset>

          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}
        </div>

        <DialogFooter className="sm:items-center">
          {/* ★WHERE THE MONEY GOES, next to the button that spends it: the ad account this campaign is created in. */}
          <p className="text-xs text-muted-foreground sm:mr-auto" data-testid="creates-in">
            {metaCreatesInLine(account)}
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending || page.isLoading} aria-busy={create.isPending}>
            {create.isPending ? "Creating…" : "Create paused campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit ─────────────────────────────────────────────────────────────────

export function EditCampaignButton({
  account,
  campaign,
}: {
  account: MetaAdAccount;
  campaign: MetaCampaign;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`Edit campaign ${campaign.name}`}
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-3.5" />
      </Button>
      {open ? <EditCampaignSheet account={account} campaign={campaign} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function EditCampaignSheet({
  account,
  campaign,
  onClose,
}: {
  account: MetaAdAccount;
  campaign: MetaCampaign;
  onClose: () => void;
}) {
  const refresh = useRefreshAds(account.id);
  const campaignBudget = budgetKey(campaign);
  const hasBudget = campaignBudget !== null;
  const budgetKind = campaignBudget === "dailyBudget" ? "daily" : "lifetime";
  const [name, setName] = useState(campaign.name);
  const [budget, setBudget] = useState(
    metaMinorToInput(campaignBudget ? campaign[campaignBudget] : undefined, account.currency),
  );
  const [error, setError] = useState<string | null>(null);

  const adSets = useQuery({
    queryKey: ["meta-ads-adsets", account.id, campaign.id],
    queryFn: () => metaAdsApi.listAdSets(account.id, campaign.id),
    retry: false,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: (body: MetaCampaignEdit) => metaAdsApi.editCampaign(campaign.id, body),
    onSuccess: () => {
      refresh();
      toast.success("Campaign saved.");
      onClose();
    },
    onError: (err: unknown) => setError(metaAdsErrorMessage(err, "Couldn't save that. Nothing was changed.")),
  });

  const submit = () => {
    setError(null);
    const body = buildCampaignEdit(campaign, { name, budget }, account.currency);
    if (body === null) {
      onClose();
      return;
    }
    if ("error" in body) {
      setError(body.error);
      return;
    }
    save.mutate(body);
  };

  return (
    <Sheet open onOpenChange={(next) => (!next && !save.isPending ? onClose() : undefined)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit campaign</SheetTitle>
          <SheetDescription>
            Changes go to Meta straight away. Turning the campaign on or off is the switch in the list.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4">
          <section className="space-y-3" aria-label="Campaign">
            <div className="space-y-1.5">
              <Label htmlFor="ec-name">Campaign name</Label>
              <Input id="ec-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            </div>
            {hasBudget ? (
              <div className="space-y-1.5">
                <Label htmlFor="ec-budget">
                  {budgetKind === "daily" ? "Daily budget" : "Total budget"} ({account.currency})
                </Label>
                <Input
                  id="ec-budget"
                  inputMode="decimal"
                  value={budget}
                  className="w-40"
                  onChange={(e) => setBudget(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Raising it is checked against your weekly spending limit. Lowering it never is.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This campaign&apos;s budget is set on its ad sets, below.
              </p>
            )}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button size="sm" onClick={submit} disabled={save.isPending} aria-busy={save.isPending}>
              {save.isPending ? "Saving…" : "Save campaign"}
            </Button>
            <p className="text-xs text-muted-foreground" data-testid="in-account">
              {metaInLine(account)}
            </p>
          </section>

          <section className="space-y-4" aria-label="Ad sets">
            <h3 className="text-sm font-medium">Audience and schedule</h3>
            {adSets.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : adSets.isError ? (
              <p role="status" className="text-sm text-muted-foreground">
                {metaAdsErrorMessage(adSets.error, "Couldn't load this campaign's ad sets.")}
                {metaAdsNeedsReconnect(adSets.error) ? " Reconnect Meta from Connected accounts." : ""}
              </p>
            ) : (adSets.data?.adSets ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">This campaign has no ad sets yet.</p>
            ) : (
              (adSets.data?.adSets ?? []).map((s) => (
                <AdSetEditor key={s.id} account={account} adSet={s} onSaved={refresh} />
              ))
            )}
          </section>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AdSetEditor({
  account,
  adSet,
  onSaved,
}: {
  account: MetaAdAccount;
  adSet: MetaAdSet;
  onSaved: () => void;
}) {
  const was = readTargeting(adSet.targeting);
  const adSetBudget = budgetKey(adSet);
  const hasBudget = adSetBudget !== null;
  const [form, setForm] = useState<AdSetEditForm>({
    countries: was.countries,
    ageMin: was.ageMin,
    ageMax: was.ageMax,
    budget: metaMinorToInput(adSetBudget ? adSet[adSetBudget] : undefined, account.currency),
    start: isoToDayInZone(adSet.startTime, account.timezone),
    end: isoToDayInZone(adSet.endTime, account.timezone),
  });
  const [error, setError] = useState<string | null>(null);
  const budgetLine = metaBudgetLabel(adSet, account.currency, "adSet");

  const save = useMutation({
    mutationFn: (body: MetaAdSetEdit) => metaAdsApi.editAdSet(adSet.id, body),
    onSuccess: () => {
      onSaved();
      toast.success("Ad set saved.");
    },
    onError: (err: unknown) => setError(metaAdsErrorMessage(err, "Couldn't save that. Nothing was changed.")),
  });

  const submit = () => {
    setError(null);
    const body = buildAdSetEdit(adSet, form, account.currency, account.timezone);
    if (body === null) {
      toast("Nothing to save.");
      return;
    }
    if ("error" in body) {
      setError(body.error);
      return;
    }
    save.mutate(body);
  };
  const id = (suffix: string) => `as-${adSet.id}-${suffix}`;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{adSet.name}</p>
        <p className="text-xs text-muted-foreground">
          {adSet.status} · {budgetLine.text}
        </p>
      </div>

      {was.finerGeo ? (
        <p className="text-xs text-muted-foreground">
          This ad set targets specific cities or regions. Change where it runs in Meta Ads Manager; you can still
          change the ages here.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label>Countries</Label>
          <CountryPicker value={form.countries} onChange={(countries) => setForm((f) => ({ ...f, countries }))} />
        </div>
      )}
      <div className="flex gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={id("min")}>Youngest age</Label>
          <Input
            id={id("min")}
            inputMode="numeric"
            className="w-24"
            value={form.ageMin}
            onChange={(e) => setForm((f) => ({ ...f, ageMin: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("max")}>Oldest age</Label>
          <Input
            id={id("max")}
            inputMode="numeric"
            className="w-24"
            value={form.ageMax}
            onChange={(e) => setForm((f) => ({ ...f, ageMax: e.target.value }))}
          />
        </div>
      </div>

      {hasBudget ? (
        <div className="space-y-1.5">
          <Label htmlFor={id("budget")}>
            {adSetBudget === "dailyBudget" ? "Daily budget" : "Total budget"} ({account.currency})
          </Label>
          <Input
            id={id("budget")}
            inputMode="decimal"
            className="w-40"
            value={form.budget}
            onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={id("start")}>Starts</Label>
          <Input
            id={id("start")}
            type="date"
            value={form.start}
            onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("end")}>Ends</Label>
          <Input
            id={id("end")}
            type="date"
            value={form.end}
            onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Days are in your ad account&apos;s time zone{account.timezone ? ` (${account.timezone})` : ""}.
      </p>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button size="sm" onClick={submit} disabled={save.isPending} aria-busy={save.isPending}>
        {save.isPending ? "Saving…" : "Save ad set"}
      </Button>
    </div>
  );
}
