"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  googleAdsApi,
  type GoogleAdAccount,
  type GoogleCampaign,
  type GoogleKeywordStatus,
  type GoogleLocationOption,
  type GoogleMatchType,
  type GoogleRadiusUnit,
} from "@/lib/api/google-ads";
import { GOOGLE_DEMAND_GEN_REPORTING_NOTE, GOOGLE_PMAX_REPORTING_NOTE, googleAdsErrorMessage, googleChannelTypeLabel } from "@/lib/google-ads-view";
import {
  GOOGLE_DEFAULT_MATCH_TYPE,
  GOOGLE_MATCH_TYPES,
  GOOGLE_PAUSED_PLACES_NOTE,
  draftFromRead,
  foldKeyword,
  googleAddressProblem,
  googleKeywordProblem,
  googleLocationLabel,
  googleMatchTypeLabel,
  googleRadiusLabel,
  googleRadiusProblem,
  googleTargetingDescription,
  googleTargetingProblem,
  isSearch,
  keywordCriterionId,
  keywordKey,
  pausedOf,
  radiusKey,
  targetingInputFromDraft,
  googleTargetingSavedSentence,
  type DraftKeyword,
  type TargetingDraft,
} from "@/lib/google-targeting-view";

/**
 * ★★G-14a — the Google panel's targeting step (RMF C.20, C.30, C.260, C.270,
 * C.300, M.140), opened from a campaign's row in `google-ads-panel.tsx`.
 *
 * Every type: locations (Google's own places, searched by name), radii around
 * an address, and languages. Search also: keywords with the match type the
 * merchant picks (PHRASE until they pick another; BROAD only when chosen), and
 * the campaign's negative keywords. A keyword Google already holds can be
 * paused, enabled or removed on its own.
 *
 * ★READ LIVE, SAVED WHOLE. The step starts from what Google holds now (not our
 * row), and a save replaces it (`PUT …/targeting`). A paused criterion is left
 * as it is by a save and shown apart. ★One keyword's own control is offered
 * only while nothing is unsaved: its answer re-reads the step, which would
 * otherwise drop the unsaved edits.
 *
 * ★IT STARTS NOTHING: saving changes what a running campaign may show for, and
 * never its status.
 */
export function GoogleTargetingDialog({
  campaign,
  account,
  open,
  onOpenChange,
}: {
  campaign: GoogleCampaign;
  account: GoogleAdAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { business } = useAuth();
  // ★BUSINESS-SCOPED, as the conversion card's key is.
  const queryKey = ["google-ads-targeting", business?._id ?? "none", campaign.id];
  const read = useQuery({
    queryKey,
    queryFn: () => googleAdsApi.getTargeting(campaign.id),
    enabled: open && !!business,
    retry: false,
    staleTime: 0,
  });
  const languages = useQuery({
    queryKey: ["google-ads-languages", account.id],
    queryFn: () => googleAdsApi.listLanguages(account.id),
    enabled: open,
    retry: false,
    staleTime: 10 * 60_000,
  });

  // The type as the api's read names it, once read (review round 1): the keyword route checks the row's type too.
  const channelType = read.data?.channelType ?? campaign.channelType;
  const search = isSearch(channelType);
  // The merchant's unsaved copy, or null: with none, the step shows the latest read as it is.
  const [edits, setEdits] = useState<TargetingDraft | null>(null);
  const draft = edits ?? (read.data ? draftFromRead(read.data.targeting) : null);
  const dirty = edits !== null;
  const edit = (f: (d: TargetingDraft) => TargetingDraft) => {
    if (draft) setEdits(f(draft));
  };
  const close = () => {
    setEdits(null);
    onOpenChange(false);
  };
  // `save` is declared below; a save in flight is not dismissed (review round 1), by Close, Escape or the overlay.
  const requestClose = () => {
    if (!save.isPending) close();
  };

  const save = useMutation({
    mutationFn: (d: TargetingDraft) => googleAdsApi.setTargeting(campaign.id, targetingInputFromDraft(d, channelType)),
    onSuccess: async (res) => {
      toast.success(googleTargetingSavedSentence(res));
      // ★Re-read FIRST, then let the read replace the copy: dropping the edits before the new read lands would show
      //  the old targeting for a moment, as though the save had not taken.
      await queryClient.invalidateQueries({ queryKey });
      setEdits(null);
    },
    onError: (err) => {
      toast.error(googleAdsErrorMessage(err, "Google Ads didn't take that targeting. Try again in a moment."));
      // A save Google did not confirm may have landed: re-read, and keep the merchant's unsaved copy on screen.
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const keywordStatus = useMutation({
    mutationFn: (v: { criterionId: string; status: GoogleKeywordStatus }) => googleAdsApi.setKeywordStatus(campaign.id, v.criterionId, v.status),
    onSuccess: (_d, v) => toast.success(v.status === "PAUSED" ? "Keyword paused." : v.status === "ENABLED" ? "Keyword enabled." : "Keyword removed."),
    onError: (err) => toast.error(googleAdsErrorMessage(err, "Google Ads didn't take that change. Try again in a moment.")),
    // ★RETURNED, so the mutation stays pending until the re-read lands (review round 1): a removed keyword's row is
    //  not offered again in the moment before the read drops it.
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  const [removing, setRemoving] = useState<{ criterionId: string; text: string } | null>(null);

  const problem = draft ? googleTargetingProblem(draft, channelType) : null;
  const paused = read.data ? pausedOf(read.data.targeting) : null;
  const busy = save.isPending || keywordStatus.isPending;
  const keywordControls = !dirty && !busy;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Targeting — {campaign.name}</DialogTitle>
          <DialogDescription>
            {googleChannelTypeLabel(channelType)}. {googleTargetingDescription(channelType)}
          </DialogDescription>
        </DialogHeader>

        {channelType === "PERFORMANCE_MAX" ? <p className="text-xs text-muted-foreground">{GOOGLE_PMAX_REPORTING_NOTE}</p> : null}
        {channelType === "DEMAND_GEN" ? <p className="text-xs text-muted-foreground">{GOOGLE_DEMAND_GEN_REPORTING_NOTE}</p> : null}
        {/* ★A failed RE-read keeps the step and its unsaved edits on screen (review round 1); it says so above them. */}
        {read.isError && draft ? (
          <p className="text-xs text-destructive-on-tint">
            {googleAdsErrorMessage(read.error, "We couldn't re-read this campaign's targeting from Google Ads. What you see is the last read and your edits.")}
          </p>
        ) : null}

        {read.isError && !draft ? (
          <p className="text-sm text-destructive-on-tint">{googleAdsErrorMessage(read.error, "We couldn't read this campaign's targeting from Google Ads. Try again in a moment.")}</p>
        ) : !draft ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <LocationsSection draft={draft} edit={edit} disabled={busy} pausedIds={paused?.ids} />
            <RadiiSection draft={draft} edit={edit} disabled={busy} />
            <LanguagesSection
              draft={draft}
              edit={edit}
              disabled={busy}
              pausedIds={paused?.ids}
              options={languages.data?.languages ?? []}
              failed={languages.isError ? googleAdsErrorMessage(languages.error, "We couldn't load Google's languages.") : null}
            />
            {paused && paused.places > 0 ? (
              <p className="text-xs text-muted-foreground">
                {paused.places} {paused.places === 1 ? "place or language is" : "places or languages are"} {GOOGLE_PAUSED_PLACES_NOTE}
              </p>
            ) : null}
            {search ? (
              <>
                <KeywordsSection
                  title="Keywords"
                  help="The searches this campaign shows for. Pick how closely a search must match each one."
                  list={draft.keywords}
                  onChange={(keywords) => edit((d) => ({ ...d, keywords }))}
                  disabled={busy}
                  pausedKeys={paused?.keywordKeys}
                  controlsOn={keywordControls}
                  onStatus={(k, status) => {
                    const criterionId = k.resourceName ? keywordCriterionId(k.resourceName) : null;
                    if (!criterionId) return;
                    if (status === "REMOVED") setRemoving({ criterionId, text: k.text });
                    else keywordStatus.mutate({ criterionId, status });
                  }}
                />
                {paused && paused.keywords.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Paused keywords — left as they are when you save</Label>
                    <ul className="space-y-1">
                      {paused.keywords.map((k) => {
                        const criterionId = keywordCriterionId(k.resourceName);
                        return (
                          <li key={k.resourceName} className="flex items-center justify-between gap-2 text-sm">
                            <span>
                              {k.text} <Badge variant="outline">{googleMatchTypeLabel(k.matchType)}</Badge>
                            </span>
                            {criterionId ? (
                              <span className="flex gap-1">
                                <Button size="sm" variant="outline" disabled={!keywordControls} onClick={() => keywordStatus.mutate({ criterionId, status: "ENABLED" })}>
                                  Enable
                                </Button>
                                <Button size="sm" variant="ghost" disabled={!keywordControls} onClick={() => setRemoving({ criterionId, text: k.text })}>
                                  Remove
                                </Button>
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {dirty ? <p className="text-xs text-muted-foreground">Save or close to pause, enable or remove a keyword on its own.</p> : null}
                <KeywordsSection
                  title="Negative keywords"
                  help="Searches containing these never show your ads. They narrow what the campaign pays for."
                  list={draft.negativeKeywords}
                  onChange={(negativeKeywords) => edit((d) => ({ ...d, negativeKeywords }))}
                  disabled={busy}
                  pausedKeys={paused?.negativeKeys}
                />
                {paused && paused.negativeKeywords.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Paused in Google Ads, left as they are when you save:{" "}
                    {paused.negativeKeywords.map((k) => `${k.text} (${googleMatchTypeLabel(k.matchType)})`).join(", ")}
                  </p>
                ) : null}
              </>
            ) : null}
            {problem ? <p className="text-sm text-muted-foreground">{problem}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={requestClose} disabled={save.isPending}>
            Close
          </Button>
          <Button disabled={!draft || !!problem || !dirty || busy} onClick={() => draft && save.mutate(draft)}>
            Save targeting
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={removing !== null} onOpenChange={(o) => (o ? null : setRemoving(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &ldquo;{removing?.text}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Google Ads can&apos;t undo a removal. You can add the same words again later as a new keyword.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) keywordStatus.mutate({ criterionId: removing.criterionId, status: "REMOVED" });
                setRemoving(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

type Edit = (f: (d: TargetingDraft) => TargetingDraft) => void;

function Chip({ label, onRemove, disabled }: { label: string; onRemove: () => void; disabled: boolean }) {
  return (
    <Badge variant="secondary" className="gap-1">
      {label}
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} disabled={disabled} className="ml-1">
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

function LocationsSection({ draft, edit, disabled, pausedIds }: { draft: TargetingDraft; edit: Edit; disabled: boolean; pausedIds?: ReadonlySet<string> }) {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [results, setResults] = useState<GoogleLocationOption[] | null>(null);
  const find = useMutation({
    mutationFn: () => googleAdsApi.searchLocations(q.trim(), country.trim() ? country.trim().toUpperCase() : undefined),
    onSuccess: (res) => setResults(res.locations),
    onError: (err) => toast.error(googleAdsErrorMessage(err, "Google Ads didn't answer that search. Try again in a moment.")),
  });
  const chosen = new Set(draft.locations.map((l) => l.geoTargetConstant));
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Locations</Label>
      <div className="flex flex-wrap gap-1">
        {draft.locations.length === 0 ? <span className="text-sm text-muted-foreground">None yet.</span> : null}
        {draft.locations.map((l) => (
          <Chip
            key={l.geoTargetConstant}
            label={googleLocationLabel(l)}
            disabled={disabled}
            onRemove={() => edit((d) => ({ ...d, locations: d.locations.filter((x) => x.geoTargetConstant !== l.geoTargetConstant) }))}
          />
        ))}
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) find.mutate();
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="A country, region, city or postal code" maxLength={80} className="w-72" />
        <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country code (optional)" maxLength={2} className="w-44" />
        <Button type="submit" variant="outline" disabled={disabled || find.isPending || !q.trim()}>
          Find
        </Button>
      </form>
      {results ? (
        results.length === 0 ? (
          <p className="text-sm text-muted-foreground">Google Ads has no place matching that.</p>
        ) : (
          <ul className="space-y-1">
            {results.slice(0, 10).map((r) => (
              <li key={r.geoTargetConstant} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {r.canonicalName ?? r.name}
                  {r.targetType ? <span className="text-muted-foreground"> · {r.targetType}</span> : null}
                </span>
                {pausedIds?.has(r.geoTargetConstant) ? (
                  // The api refuses a save naming a paused place: it is enabled in Google Ads, not here.
                  <span className="text-xs text-muted-foreground">Paused in Google Ads</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled || chosen.has(r.geoTargetConstant)}
                    onClick={() => edit((d) => ({ ...d, locations: [...d.locations, { geoTargetConstant: r.geoTargetConstant, name: r.canonicalName ?? r.name }] }))}
                  >
                    {chosen.has(r.geoTargetConstant) ? "Added" : "Add"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

const EMPTY_RADIUS = { streetAddress: "", cityName: "", postalCode: "", countryCode: "", radius: "", unit: "KILOMETERS" as GoogleRadiusUnit };

function RadiiSection({ draft, edit, disabled }: { draft: TargetingDraft; edit: Edit; disabled: boolean }) {
  const [form, setForm] = useState(EMPTY_RADIUS);
  const address = {
    ...(form.streetAddress.trim() ? { streetAddress: form.streetAddress.trim() } : {}),
    ...(form.cityName.trim() ? { cityName: form.cityName.trim() } : {}),
    ...(form.postalCode.trim() ? { postalCode: form.postalCode.trim() } : {}),
    ...(form.countryCode.trim() ? { countryCode: form.countryCode.trim().toUpperCase() } : {}),
  };
  const radius = Number(form.radius);
  const duplicate = draft.radii.some((r) => radiusKey(r) === radiusKey({ address, radius, radiusUnits: form.unit }));
  const problem =
    form.radius === ""
      ? "Enter the radius."
      : (googleAddressProblem(address) ?? googleRadiusProblem(radius, form.unit) ?? (duplicate ? "That radius is already in the list." : null));
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Radius around an address</Label>
      <div className="flex flex-wrap gap-1">
        {draft.radii.map((r, i) => (
          <Chip key={radiusKey(r)} label={googleRadiusLabel(r)} disabled={disabled} onRemove={() => edit((d) => ({ ...d, radii: d.radii.filter((_, j) => j !== i) }))} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input value={form.streetAddress} onChange={(e) => setForm({ ...form, streetAddress: e.target.value })} placeholder="Street (optional)" maxLength={200} className="w-56" />
        <Input value={form.cityName} onChange={(e) => setForm({ ...form, cityName: e.target.value })} placeholder="City" maxLength={200} className="w-40" />
        <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="Postal code" maxLength={20} className="w-32" />
        <Input value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} placeholder="Country (ES)" maxLength={2} className="w-28" />
        <Input type="number" min="1" step="any" value={form.radius} onChange={(e) => setForm({ ...form, radius: e.target.value })} placeholder="Radius" className="w-24" />
        <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v as GoogleRadiusUnit })}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="KILOMETERS">km</SelectItem>
            <SelectItem value="MILES">miles</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          disabled={disabled || !!problem}
          onClick={() => {
            edit((d) => ({ ...d, radii: [...d.radii, { address, radius, radiusUnits: form.unit }] }));
            setForm(EMPTY_RADIUS);
          }}
        >
          Add
        </Button>
      </div>
      {problem && (form.cityName || form.postalCode || form.streetAddress || form.radius) ? <p className="text-xs text-muted-foreground">{problem}</p> : null}
    </div>
  );
}

function LanguagesSection({
  draft,
  edit,
  disabled,
  options,
  failed,
  pausedIds,
}: {
  draft: TargetingDraft;
  edit: Edit;
  disabled: boolean;
  options: Array<{ languageConstant: string; name: string }>;
  failed: string | null;
  pausedIds?: ReadonlySet<string>;
}) {
  // A paused language is not offered: the api refuses a save naming one (review round 1).
  const chosen = new Set([...draft.languages.map((l) => l.languageConstant), ...(pausedIds ?? [])]);
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Languages</Label>
      <div className="flex flex-wrap gap-1">
        {draft.languages.length === 0 ? <span className="text-sm text-muted-foreground">Any language.</span> : null}
        {draft.languages.map((l) => (
          <Chip
            key={l.languageConstant}
            label={l.name ?? options.find((o) => o.languageConstant === l.languageConstant)?.name ?? l.languageConstant}
            disabled={disabled}
            onRemove={() => edit((d) => ({ ...d, languages: d.languages.filter((x) => x.languageConstant !== l.languageConstant) }))}
          />
        ))}
      </div>
      {failed ? (
        <p className="text-xs text-muted-foreground">{failed}</p>
      ) : (
        <Select
          value=""
          onValueChange={(v) => {
            const o = options.find((x) => x.languageConstant === v);
            if (o && !chosen.has(v)) edit((d) => ({ ...d, languages: [...d.languages, { languageConstant: o.languageConstant, name: o.name }] }));
          }}
          disabled={disabled || options.length === 0}
        >
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Add a language" />
          </SelectTrigger>
          <SelectContent>
            {options
              .filter((o) => !chosen.has(o.languageConstant))
              .map((o) => (
                <SelectItem key={o.languageConstant} value={o.languageConstant}>
                  {o.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function KeywordsSection({
  title,
  help,
  list,
  onChange,
  disabled,
  controlsOn,
  onStatus,
  pausedKeys,
}: {
  title: string;
  help: string;
  list: DraftKeyword[];
  onChange: (next: DraftKeyword[]) => void;
  disabled: boolean;
  /** Keys Google holds paused: adding one again is refused by the api, so it is said here. */
  pausedKeys?: ReadonlySet<string>;
  /** Keywords only: whether one keyword's own pause/remove is offered now. */
  controlsOn?: boolean;
  onStatus?: (k: DraftKeyword, status: GoogleKeywordStatus) => void;
}) {
  const [text, setText] = useState("");
  const [matchType, setMatchType] = useState<GoogleMatchType>(GOOGLE_DEFAULT_MATCH_TYPE);
  const typed = foldKeyword(text);
  const key = keywordKey({ text: typed, matchType });
  const duplicate = list.some((k) => keywordKey(k) === key);
  const problem = text
    ? (googleKeywordProblem(text) ??
      (duplicate ? "That keyword is already in the list." : pausedKeys?.has(key) ? "That one is paused in Google Ads. Enable it rather than adding it again." : null))
    : null;
  const add = () => {
    onChange([...list, { text: typed, matchType }]);
    setText("");
  };
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{title}</Label>
      <p className="text-xs text-muted-foreground">{help}</p>
      <ul className="space-y-1">
        {list.length === 0 ? <li className="text-sm text-muted-foreground">None yet.</li> : null}
        {list.map((k) => (
          <li key={keywordKey(k)} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {k.text} <Badge variant="outline">{googleMatchTypeLabel(k.matchType)}</Badge>
              {k.resourceName ? null : <span className="text-xs text-muted-foreground"> · not saved yet</span>}
            </span>
            <span className="flex gap-1">
              {k.resourceName && onStatus ? (
                <>
                  <Button size="sm" variant="outline" disabled={!controlsOn} onClick={() => onStatus(k, "PAUSED")}>
                    Pause
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!controlsOn} onClick={() => onStatus(k, "REMOVED")}>
                    Remove
                  </Button>
                </>
              ) : (
                // A negative, or a keyword not yet saved: taken out of the list, and the save replaces.
                <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(list.filter((x) => keywordKey(x) !== keywordKey(k)))}>
                  Take out
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!problem && typed) add();
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="linen shirts" maxLength={120} className="w-64" />
        <Select value={matchType} onValueChange={(v) => setMatchType(v as GoogleMatchType)}>
          <SelectTrigger className="w-32" aria-label="Match type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GOOGLE_MATCH_TYPES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline" disabled={disabled || !typed || !!problem}>
          Add
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{GOOGLE_MATCH_TYPES.find((m) => m.value === matchType)?.hint}</p>
      {problem ? <p className="text-xs text-muted-foreground">{problem}</p> : null}
    </div>
  );
}
