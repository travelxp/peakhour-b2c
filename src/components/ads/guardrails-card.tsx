"use client";

/**
 * D-05 — THE MERCHANT'S GUARDRAILS: what the growth engine may never do for
 * this business, whatever it would otherwise propose. The api obeys them at
 * every proposal, launch and spend act (peakhour-api `services/growth/
 * guardrails.ts`); this card is where a merchant sets them.
 *
 * ★WRITTEN WHOLE. Save sends every rule shown (`buildGuardrailsPatch`), so an
 * emptied list clears that rule, and Clear all sends `null`. The api normalises
 * the terms and stamps who saved them; the PATCH answer replaces the cache, so
 * the card shows the terms as they are now stored ("Café" → "cafe").
 *
 * D-05b adds the channel ALLOW list — "only these channels", so a channel
 * Peakhour adds later stays off — as the other mode of the one channel rule,
 * and approved-assets-only.
 *
 * D-05c: approved-assets-only is OFFERED only while there is a creative to
 * approve or one approved (`approvedAssetsOffer`) — with none, turning it on
 * stops every ad the engine creates — and both views link to creative review.
 *
 * ★CHANNEL-NEUTRAL, so it sits above the channel tabs on the ads hub, beside
 * the business summary — inside a channel panel it would read as that
 * channel's setting.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, ShieldBan, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ApiError } from "@/lib/api";
import { growthApi } from "@/lib/api/growth";
import {
  buildGuardrailsPatch,
  channelModeWarning,
  channelOptions,
  describeGuardrails,
  draftFromStored,
  guardrailsSaveError,
  hasGuardrails,
  timeZoneOptions,
  type GuardrailsDraft,
} from "@/lib/guardrails-copy";
import {
  CREATIVE_REVIEW_PATH,
  approvedAssetsOffer,
  approvedAssetsWarning,
  approvedByChannelLine,
  nothingToApproveLine,
} from "@/lib/creative-review-copy";
import { useCreativesSummary } from "@/components/ads/creatives-review-entry";

/** Another save landed since Edit was opened; carries the newer record's setAt. */
class GuardrailsChangedError extends Error {
  constructor(readonly freshSetAt: string | undefined) {
    super("Your guardrails were changed while you were editing them.");
    this.name = "GuardrailsChangedError";
  }
}

/** The zone picker's value for "the business's own zone" (Radix needs non-empty). */
const BUSINESS_ZONE = "__business__";

export function GuardrailsCard() {
  const queryClient = useQueryClient();
  // Shares the cache key with the declaration card and the optimizer board.
  const settings = useQuery({
    queryKey: ["growth-settings"],
    queryFn: () => growthApi.settings(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const stored = settings.data?.settings.guardrails;
  const creatives = useCreativesSummary();
  const [draft, setDraft] = useState<GuardrailsDraft | null>(null);
  /** The stored record's `setAt` when Edit was opened, to catch a save made
   *  elsewhere in the meantime (review R1). */
  const [baseSetAt, setBaseSetAt] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  /** A save elsewhere was found at Save or Clear (review R2): the merchant
   *  chooses to load it (losing this form's edits) or to apply theirs over it.
   *  ★`action` is which they asked for (review R3): "anyway" after Clear all
   *  must clear, not save the form's old rules back. */
  const [conflict, setConflict] = useState<{ freshSetAt: string | undefined; action: "save" | "clear" } | null>(null);
  /** The stored zone when Edit was opened (review R3): a conflict replaces the
   *  cache, and the draft's kept zone must stay an option and stay its own. */
  const [baseZone, setBaseZone] = useState<string | undefined>(undefined);
  const zones = useMemo(() => {
    try {
      return timeZoneOptions(Intl.supportedValuesOf("timeZone"));
    } catch {
      return ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Dubai"];
    }
  }, []);

  const save = useMutation({
    mutationFn: async ({ patch, expectedSetAt }: { patch: Parameters<typeof growthApi.updateSettings>[0]; expectedSetAt: string | undefined }) => {
      // ★WRITTEN WHOLE, SO CHECKED FRESH (review R1) — Clear all included
      //  (review R2): a save replaces the record, and one made elsewhere since
      //  this form or dialog was opened would be silently reverted.
      //  ⏸A read then a write, not one conditional write: the window between
      //  them is a request's length, on a human-paced form. Closing it needs
      //  an api-side condition on setAt (a follow-up, named in the PR).
      const fresh = await growthApi.settings();
      if (fresh.settings.guardrails?.setAt !== expectedSetAt) {
        queryClient.setQueryData(["growth-settings"], fresh);
        throw new GuardrailsChangedError(fresh.settings.guardrails?.setAt);
      }
      return growthApi.updateSettings(patch);
    },
    onSuccess: (res, { patch }) => {
      queryClient.setQueryData(["growth-settings"], res);
      setDraft(null);
      setFormError(null);
      setConflict(null);
      setClearOpen(false);
      toast.success(patch.guardrails === null ? "Guardrails cleared." : "Guardrails saved.");
    },
    onError: (err, { patch }) => {
      if (err instanceof GuardrailsChangedError) {
        setClearOpen(false);
        setConflict({ freshSetAt: err.freshSetAt, action: patch.guardrails === null ? "clear" : "save" });
        return;
      }
      toast.error(guardrailsSaveError(err instanceof ApiError ? err : null));
    },
  });

  // ★~400 items, built once per zone set (review R3), not on every keystroke.
  //  The draft's kept zone and the stored one are always options.
  const keptZone = baseZone ?? stored?.timeZone;
  const zoneItems = useMemo(
    () => [
      <SelectItem key={BUSINESS_ZONE} value={BUSINESS_ZONE}>
        Your business&rsquo;s time zone
      </SelectItem>,
      ...(keptZone && !zones.includes(keptZone)
        ? [
            <SelectItem key={`kept-${keptZone}`} value={keptZone}>
              {keptZone}
            </SelectItem>,
          ]
        : []),
      ...zones.map((z) => (
        <SelectItem key={z} value={z}>
          {z}
        </SelectItem>
      )),
    ],
    [zones, keptZone],
  );

  // ★NO DATA — which covers a query paused offline (pending, not loading:
  //  rendering then would claim "No guardrails set" from nothing) — and NOT
  //  `isError` (review R1): a failed background refetch keeps the cached data,
  //  and hiding the card then would drop an open form.
  if (!settings.data) return null;

  const lines = describeGuardrails(stored);
  const assetsWarning = approvedAssetsWarning(creatives.data, stored?.approvedAssetsOnly === true);
  const channelLine = approvedByChannelLine(creatives.data);
  const assetsOffer = approvedAssetsOffer(
    creatives.data,
    stored?.approvedAssetsOnly === true || draft?.approvedAssetsOnly === true,
  );
  // (zoneItems is memoised above the early return.)
  const set = (over: Partial<GuardrailsDraft>) => setDraft((d) => (d ? { ...d, ...over } : d));
  // The list the channel boxes edit, and its setter — one place keyed by mode.
  const channelList = draft ? (draft.channelMode === "allow" ? draft.allowedChannels : draft.deniedChannels) : [];
  const writeChannels = (next: string[]) =>
    set(draft?.channelMode === "allow" ? { allowedChannels: next } : { deniedChannels: next });
  const modeWarning = draft ? channelModeWarning(draft.channelMode, stored) : null;

  const submit = (expectedSetAt: string | undefined = baseSetAt) => {
    if (!draft) return;
    const built = buildGuardrailsPatch(draft);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    setFormError(null);
    setConflict(null);
    save.mutate({ patch: { guardrails: built.patch }, expectedSetAt });
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldBan className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden />
            <div>
              {/* ★Named "Growth settings" because that is where the api's
                  refusals send the merchant (review R1). */}
              <h3 className="font-medium">Growth settings · Guardrails</h3>
              <p className="text-sm text-muted-foreground">
                What Peakhour must never do for this business, whatever it would otherwise suggest.
              </p>
            </div>
          </div>
          {!draft && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(draftFromStored(stored));
                setBaseSetAt(stored?.setAt);
                setBaseZone(stored?.timeZone);
              }}
            >
              {hasGuardrails(stored) ? "Edit" : "Set guardrails"}
            </Button>
          )}
        </div>

        {!draft &&
          (lines.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {/* ★Only ended blackouts are stored (review R2): "No guardrails
                  set" beside an Edit button and a Clear all said two things. */}
              {hasGuardrails(stored) ? "No rules in force — only past blackout dates are saved." : "No guardrails set."}
            </p>
          ))}

        {!draft && assetsWarning && (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
            {assetsWarning}{" "}
            <Link href={CREATIVE_REVIEW_PATH} className="underline underline-offset-2">
              Review creatives
            </Link>
          </p>
        )}

        {draft && (
          <div className="space-y-6">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Channel rule</legend>
              {/* ★ONE CHANNEL RULE, TWO WAYS TO SAY IT (D-05b). "Only these"
                  is not "never those" turned round: a channel Peakhour adds
                  later is on under the first and off under the second. */}
              <RadioGroup
                value={draft.channelMode}
                onValueChange={(v) => {
                  // ★A stale refusal of the other mode must not linger (review R2).
                  setFormError(null);
                  set({ channelMode: v === "allow" ? "allow" : "deny" });
                }}
                className="gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="guardrail-mode-deny" value="deny" />
                  <Label htmlFor="guardrail-mode-deny" className="font-normal">
                    Every channel except the ones I turn off
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="guardrail-mode-allow" value="allow" />
                  <Label htmlFor="guardrail-mode-allow" className="font-normal">
                    Only the channels I choose &mdash; new channels stay off until I add them
                  </Label>
                </div>
              </RadioGroup>
            </fieldset>

            {/* ★THE LEGEND SAYS WHAT A TICK MEANS (review R1): the same box is
                "blocked" in one mode and "the only one allowed" in the other,
                and a screen reader announces the group by its legend. */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {draft.channelMode === "allow" ? "Advertise only on" : "Never advertise on"}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {channelOptions(channelList, stored).map((c) => {
                  const id = `guardrail-channel-${c.key}`;
                  return (
                    <div key={c.key} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={channelList.includes(c.key)}
                        onCheckedChange={(v) =>
                          writeChannels(v ? [...channelList, c.key] : channelList.filter((k) => k !== c.key))
                        }
                      />
                      <Label htmlFor={id} className="font-normal">
                        {c.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
              {modeWarning && (
                <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
                  {modeWarning}
                </p>
              )}
            </fieldset>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {/* ★D-05c: NOT OFFERED WHILE THERE IS NOTHING TO APPROVE, and not
                    while that is unknown — always while it is on, so it can be
                    turned off. */}
                <Switch
                  id="guardrail-approved-assets"
                  checked={draft.approvedAssetsOnly}
                  disabled={assetsOffer !== "offer"}
                  onCheckedChange={(v) => set({ approvedAssetsOnly: v })}
                />
                <Label htmlFor="guardrail-approved-assets">Only use creatives I have approved</Label>
              </div>
              {assetsOffer === "offer" ? (
                <p className="text-xs text-muted-foreground">
                  {/* ★SAYS WHAT "ON" COSTS (review R1): with nothing approved, the
                      engine creates no ad of its own at all. */}
                  Ads Peakhour creates on its own will carry only the wording and landing page of a creative you
                  approved, as you approved it &mdash; so until you approve one, it creates none. Ads you set up
                  yourself are not affected.{" "}
                  {channelLine ? `${channelLine} ` : ""}
                  <Link href={CREATIVE_REVIEW_PATH} className="underline underline-offset-2">
                    Review your creatives
                  </Link>
                </p>
              ) : assetsOffer === "nothing_to_approve" ? (
                <p className="text-xs text-muted-foreground">
                  {creatives.data ? nothingToApproveLine(creatives.data) : null}{" "}
                  <Link href={CREATIVE_REVIEW_PATH} className="underline underline-offset-2">
                    See your creatives
                  </Link>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {creatives.isError ? (
                    <>
                      We couldn&rsquo;t check whether you have creatives to approve, so this can&rsquo;t be turned on
                      right now.{" "}
                      {/* ★A way back from a failed check (review R2): it does not refetch on focus. */}
                      <button type="button" className="underline underline-offset-2" onClick={() => creatives.refetch()}>
                        Try again
                      </button>
                    </>
                  ) : (
                    "Checking your creatives…"
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="guardrail-terms">Words and names no ad may use</Label>
              <Textarea
                id="guardrail-terms"
                rows={4}
                value={draft.termsText}
                onChange={(e) => set({ termsText: e.target.value })}
                placeholder={"One per line — a competitor, a claim you can't make…"}
              />
              <p className="text-xs text-muted-foreground">
                Matched as whole words in any case, with or without spaces or accents.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="guardrail-quiet"
                  checked={draft.quietEnabled}
                  onCheckedChange={(v) => set({ quietEnabled: v })}
                />
                <Label htmlFor="guardrail-quiet">Quiet hours — no spend starts or rises</Label>
              </div>
              {draft.quietEnabled && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="time"
                    aria-label="Quiet hours start"
                    className="w-32"
                    value={draft.quietStart}
                    onChange={(e) => set({ quietStart: e.target.value })}
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="time"
                    aria-label="Quiet hours end"
                    className="w-32"
                    value={draft.quietEnd}
                    onChange={(e) => set({ quietEnd: e.target.value })}
                  />

                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Blackout dates — no spend starts or rises</p>
              {draft.blackouts.map((b, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    aria-label="Blackout from"
                    className="w-40"
                    value={b.from}
                    onChange={(e) =>
                      set({ blackouts: draft.blackouts.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) })
                    }
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="date"
                    aria-label="Blackout to"
                    className="w-40"
                    value={b.to}
                    onChange={(e) =>
                      set({ blackouts: draft.blackouts.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })
                    }
                  />
                  <Input
                    aria-label="Blackout label"
                    placeholder="Label (optional)"
                    className="w-48"
                    maxLength={80}
                    value={b.label}
                    onChange={(e) =>
                      set({ blackouts: draft.blackouts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove blackout"
                    onClick={() => set({ blackouts: draft.blackouts.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => set({ blackouts: [...draft.blackouts, { from: "", to: "", label: "" }] })}
              >
                <Plus className="mr-1 h-4 w-4" /> Add blackout
              </Button>
            </div>

            {(draft.quietEnabled || draft.blackouts.length > 0) && (
              <div className="space-y-1">
                <Label htmlFor="guardrail-zone">Time zone</Label>
                {/* ★A PICKER, NOT FREE TEXT (review R2): "EST" or "asia/kolkata"
                    read, and would be stored as typed — EST without daylight
                    saving. The stored zone is always an option, readable here
                    or not (see draftFromStored). */}
                <Select
                  value={draft.timeZone || BUSINESS_ZONE}
                  onValueChange={(v) => set({ timeZone: v === BUSINESS_ZONE ? "" : v })}
                >
                  <SelectTrigger id="guardrail-zone" className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{zoneItems}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Quiet hours and blackout dates are read in this zone. Choose &ldquo;Your business&rsquo;s time
                  zone&rdquo; to use the one Peakhour has for your business. Blackouts that have ended are removed when
                  you save.
                </p>
              </div>
            )}

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            {conflict && (
              <div role="alert" className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm">
                <p>
                  Someone else saved guardrails while you were editing.{" "}
                  {conflict.action === "clear" ? "Clearing now would remove theirs too." : "Saving yours would replace theirs."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const fresh = queryClient.getQueryData<typeof settings.data>(["growth-settings"]);
                      setDraft(draftFromStored(fresh?.settings.guardrails));
                      setBaseSetAt(conflict.freshSetAt);
                      setBaseZone(fresh?.settings.guardrails?.timeZone);
                      setConflict(null);
                    }}
                  >
                    Load theirs
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setBaseSetAt(conflict.freshSetAt);
                      if (conflict.action === "clear") {
                        setConflict(null);
                        save.mutate({ patch: { guardrails: null }, expectedSetAt: conflict.freshSetAt });
                      } else {
                        submit(conflict.freshSetAt);
                      }
                    }}
                  >
                    {conflict.action === "clear" ? "Clear anyway" : "Save mine anyway"}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => submit()} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save guardrails
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setFormError(null);
                  setConflict(null);
                }}
                disabled={save.isPending}
              >
                Cancel
              </Button>
              {hasGuardrails(stored) && (
                <Button variant="ghost" className="ml-auto text-destructive" onClick={() => setClearOpen(true)} disabled={save.isPending}>
                  Clear all
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear every guardrail?</AlertDialogTitle>
            <AlertDialogDescription>
              Peakhour will be free to suggest and run ads on every channel, with any wording or creative, at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction onClick={() => save.mutate({ patch: { guardrails: null }, expectedSetAt: baseSetAt })}>
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
