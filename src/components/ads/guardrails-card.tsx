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
 * ★CHANNEL-NEUTRAL, so it sits above the channel tabs on the ads hub, beside
 * the business summary — inside a channel panel it would read as that
 * channel's setting.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, ShieldBan, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  GUARDRAIL_CHANNELS,
  buildGuardrailsPatch,
  describeGuardrails,
  draftFromStored,
  guardrailsSaveError,
  hasGuardrails,
  type GuardrailsDraft,
} from "@/lib/guardrails-copy";

/** Another save landed since Edit was opened. */
class GuardrailsChangedError extends Error {
  constructor() {
    super("Your guardrails were changed while you were editing them. Cancel, then edit again to see the latest.");
    this.name = "GuardrailsChangedError";
  }
}

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
  const [draft, setDraft] = useState<GuardrailsDraft | null>(null);
  /** The stored record's `setAt` when Edit was opened, to catch a save made
   *  elsewhere in the meantime (review R1). */
  const [baseSetAt, setBaseSetAt] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const save = useMutation({
    mutationFn: async (patch: Parameters<typeof growthApi.updateSettings>[0]) => {
      // ★WRITTEN WHOLE, SO CHECKED FRESH (review R1): a save replaces the
      //  record, and one made elsewhere since Edit was opened would be
      //  silently reverted by this form's older copy of it.
      if (patch.guardrails !== null) {
        const fresh = await growthApi.settings();
        if (fresh.settings.guardrails?.setAt !== baseSetAt) {
          queryClient.setQueryData(["growth-settings"], fresh);
          throw new GuardrailsChangedError();
        }
      }
      return growthApi.updateSettings(patch);
    },
    onSuccess: (res, patch) => {
      queryClient.setQueryData(["growth-settings"], res);
      setDraft(null);
      setFormError(null);
      setClearOpen(false);
      toast.success(patch.guardrails === null ? "Guardrails cleared." : "Guardrails saved.");
    },
    onError: (err) => {
      if (err instanceof GuardrailsChangedError) {
        setFormError(err.message);
        return;
      }
      toast.error(guardrailsSaveError(err instanceof ApiError ? err : null));
    },
  });

  // ★NO DATA — which covers a query paused offline (pending, not loading:
  //  rendering then would claim "No guardrails set" from nothing) — and NOT
  //  `isError` (review R1): a failed background refetch keeps the cached data,
  //  and hiding the card then would drop an open form.
  if (!settings.data) return null;

  const lines = describeGuardrails(stored);
  const set = (over: Partial<GuardrailsDraft>) => setDraft((d) => (d ? { ...d, ...over } : d));

  const submit = () => {
    if (!draft) return;
    const built = buildGuardrailsPatch(draft);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    setFormError(null);
    save.mutate({ guardrails: built.patch });
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
            <p className="text-sm text-muted-foreground">No guardrails set.</p>
          ))}

        {draft && (
          <div className="space-y-6">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Never advertise on</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {GUARDRAIL_CHANNELS.map((c) => {
                  const id = `guardrail-channel-${c.key}`;
                  return (
                    <div key={c.key} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={draft.deniedChannels.includes(c.key)}
                        onCheckedChange={(v) =>
                          set({
                            deniedChannels: v
                              ? [...draft.deniedChannels, c.key]
                              : draft.deniedChannels.filter((k) => k !== c.key),
                          })
                        }
                      />
                      <Label htmlFor={id} className="font-normal">
                        {c.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </fieldset>

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
                <Input
                  id="guardrail-zone"
                  className="w-64"
                  value={draft.timeZone}
                  onChange={(e) => set({ timeZone: e.target.value })}
                  placeholder="Your business's time zone"
                />
                <p className="text-xs text-muted-foreground">
                  Quiet hours and blackout dates are read in this zone, e.g. Europe/London. Leave it empty to use your
                  business&rsquo;s own.
                </p>
              </div>
            )}

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={submit} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save guardrails
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setFormError(null);
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
              Peakhour will be free to suggest and run ads on every channel, with any wording, at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction onClick={() => save.mutate({ guardrails: null })}>Clear all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
