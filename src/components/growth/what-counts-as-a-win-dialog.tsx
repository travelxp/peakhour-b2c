"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, Inbox, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/auth-provider";
import { growthApi, type WinOptionsResponse } from "@/lib/api/growth";
import { toastUnhandledApiError } from "@/lib/toast-errors";

/**
 * What counts as a win for this business.
 *
 * ★THE MISSING SETUP STEP BEHIND EVERY OUTCOME CLAIM IN THE PRODUCT. Outcomes,
 * the analytics dashboard and the optimizer all want to say whether the work
 * turned into anything, and none of them could, because nothing anywhere
 * recorded what "anything" means. Quests Travel has 1,447 sessions and 966
 * users over ninety days and zero recorded conversions — not because nobody
 * enquired, but because their analytics property has no key event and nothing
 * ever offered them another way to say so.
 *
 * ★A DIALOG RATHER THAN A PAGE, ON PURPOSE. It is one decision, taken once,
 * reached from the two surfaces that need it. A route and a nav item for that
 * is a permanent piece of furniture for a five-second job — and the nav is
 * being edited elsewhere, so adding to it unasked would collide.
 *
 * ★IT OFFERS ONLY WHAT WE CAN ACTUALLY COUNT. Two options, each with a live
 * counter behind it. A third that merely sounded right — "form submissions",
 * "newsletter signups" — would be the same promise the old "23 new customers at
 * $12 each" copy made, and this dialog exists because that promise had nothing
 * behind it.
 */

type Choice = "analytics_key_event" | "inbox_lead";

/** A default name for the thing being counted, so the field is never empty on
 *  open. The customer's own word wins; this is only a starting point. */
function defaultLabel(choice: Choice, eventName?: string): string {
  if (choice === "inbox_lead") return "new lead";
  if (!eventName) return "enquiry";
  // "generate_lead" → "generate lead". Deliberately NOT title-cased or
  // prettified further: it is a suggestion the customer is expected to
  // overwrite, and dressing up a machine name makes it look decided.
  return eventName.replace(/[_-]+/g, " ").trim() || "enquiry";
}

export function WhatCountsAsAWinDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { business } = useAuth();
  const queryClient = useQueryClient();

  const options = useQuery({
    queryKey: ["growth-win-options", business?._id ?? "none"],
    // ★NOT FETCHED UNTIL THE DIALOG IS OPEN. Listing key events is a live call
    // to Google's Admin API; firing it on every render of a page that merely
    // LINKS here would spend a customer's quota on a screen nobody opened.
    enabled: open,
    queryFn: () => growthApi.winOptions(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const [choice, setChoice] = useState<Choice | null>(null);
  const [eventName, setEventName] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  /** Whether the customer has typed their own name for it. Once they have, no
   *  later default may overwrite it — changing the key event must not silently
   *  rename something they deliberately called "demo request". */
  const [labelTouched, setLabelTouched] = useState(false);

  const current = options.data?.current ?? null;
  const events = options.data?.keyEvents.events ?? [];

  /**
   * Seed the form from whatever is already saved, the moment the fetch lands.
   *
   * ★ADJUSTED DURING RENDER, NOT IN AN EFFECT. The values depend on a request,
   * so there is nothing to seed at mount — but doing it in an effect is a
   * cascading render (React's own guidance, and the lint rule that enforces it
   * here). Keying on the fetched value means it runs once per distinct answer
   * and never fights the customer's typing afterwards.
   *
   * ★AND THERE IS NO RESET-ON-CLOSE, DELIBERATELY. Both callers render this as
   * `{open && <WhatCountsAsAWinDialog …/>}`, so closing unmounts it and the
   * next open starts clean. A caller that kept it mounted would need one — it
   * is called out here rather than guarded, because the guard would be an
   * effect again.
   */
  const seedKey = options.data ? JSON.stringify(current) : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seedKey !== null && seededFor !== seedKey) {
    setSeededFor(seedKey);
    setChoice(current?.source ?? null);
    setEventName(current?.eventName ?? "");
    setLabel(current?.label ?? "");
    setLabelTouched(current !== null);
  }

  function pick(next: Choice, event?: string) {
    setChoice(next);
    if (next === "inbox_lead") setEventName("");
    else if (event !== undefined) setEventName(event);
    if (!labelTouched) setLabel(defaultLabel(next, event ?? eventName));
  }

  const save = useMutation({
    mutationFn: () =>
      growthApi.updateSettings({
        winDefinition:
          choice === null
            ? null
            : {
                source: choice,
                ...(choice === "analytics_key_event" ? { eventName } : {}),
                label: label.trim(),
              },
      }),
    onSuccess: () => {
      // Outcomes reads this on every render, and the analytics page decides
      // whether to show a conversions figure from it.
      void queryClient.invalidateQueries({ queryKey: ["growth-outcomes"] });
      void queryClient.invalidateQueries({ queryKey: ["growth-win-options"] });
      void queryClient.invalidateQueries({ queryKey: ["growth-settings"] });
      toast.success(`We'll count ${label.trim() || "wins"} from now on.`, {
        description:
          "Outcomes will start reporting them — historical periods count them too, wherever the data goes back.",
      });
      onOpenChange(false);
    },
    onError: (err) => toastUnhandledApiError(err, "save what counts as a win"),
  });

  const valid =
    choice !== null &&
    label.trim().length > 0 &&
    (choice === "inbox_lead" || eventName.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && save.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="size-4" aria-hidden="true" />
            What counts as a win?
          </DialogTitle>
          <DialogDescription>
            Tell us what a good outcome looks like for your business and we&apos;ll count it
            everywhere — instead of showing you a zero because nobody ever said.
          </DialogDescription>
        </DialogHeader>

        {options.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : options.isError ? (
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t load your options just now. Try again in a moment.
          </p>
        ) : (
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            <AnalyticsSection
              keyEvents={options.data.keyEvents}
              events={events}
              selectedEvent={choice === "analytics_key_event" ? eventName : ""}
              onPick={(e) => pick("analytics_key_event", e)}
            />

            <section className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">
                Or count it from your inbox
              </h3>
              <button
                type="button"
                aria-pressed={choice === "inbox_lead"}
                onClick={() => pick("inbox_lead")}
                className={`flex w-full items-start gap-2.5 rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                  choice === "inbox_lead" ? "border-primary bg-muted/40" : ""
                }`}
              >
                <Inbox className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    A new lead in your Inbox
                    {choice === "inbox_lead" && (
                      <Check className="size-3.5 text-primary" aria-hidden="true" />
                    )}
                  </span>
                  {/* ★NOTHING TO CONNECT AND NOTHING TO CONFIGURE. This is the
                      option that works for a business with no analytics at all,
                      which is why it is offered rather than assumed away. */}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Every enquiry that reaches your Inbox — from WhatsApp, a form, or a reply.
                    Nothing to set up.
                  </span>
                </span>
              </button>
            </section>

            {choice && (
              <div className="space-y-1.5 border-t pt-3">
                <Label htmlFor="win-label">What do you call it?</Label>
                <Input
                  id="win-label"
                  value={label}
                  maxLength={80}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    setLabelTouched(true);
                  }}
                  placeholder="enquiry"
                />
                {/* ★THIS IS WHY THE FIELD EXISTS. Without it Outcomes reads
                    "23 generate_lead this week", which is the machine's name
                    for the thing rather than the customer's. */}
                <p className="text-xs text-muted-foreground">
                  We&apos;ll use your word for it: &ldquo;12 {label.trim() || "enquiries"} this
                  month&rdquo;.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {/* Clearing is offered only when there is something to clear, and it
              unsets rather than storing a "none" — so "nobody has chosen" stays
              the single reading of absence. */}
          {current ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={save.isPending}
              onClick={() => {
                setChoice(null);
                save.mutate();
              }}
            >
              Stop counting
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!valid || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Count this"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The analytics half.
 *
 * ★FOUR STATES, AND THREE OF THEM ARE NOT "NO OPTIONS". A property with key
 * events; a property with none; no property picked; and no connection at all.
 * Rendering the last three identically would tell somebody to go and create a
 * key event when the real problem is that we never asked, or that they have
 * one and simply have not chosen a property.
 */
function AnalyticsSection({
  keyEvents,
  events,
  selectedEvent,
  onPick,
}: {
  keyEvents: WinOptionsResponse["keyEvents"];
  events: Array<{ eventName: string; custom: boolean }>;
  selectedEvent: string;
  onPick: (eventName: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">Count it in your analytics</h3>

      {!keyEvents.available ? (
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            {keyEvents.reason === "not_connected"
              ? "Google Analytics isn't connected, so we can't read what your site already counts."
              : keyEvents.reason === "no_property"
                ? "Analytics is connected but no property is picked yet, so there's nothing for us to read."
                : "We couldn't reach Google just now — the inbox option below still works."}
          </p>
          {keyEvents.reason !== "lookup_failed" && (
            <Button asChild size="sm" variant="outline">
              <Link
                href={
                  keyEvents.reason === "not_connected"
                    ? "/dashboard/integrations"
                    : "/dashboard/insights/analytics"
                }
              >
                {keyEvents.reason === "not_connected" ? "Connect analytics" : "Pick a property"}
              </Link>
            </Button>
          )}
        </div>
      ) : events.length === 0 ? (
        // ★"WE ASKED AND THERE ARE NONE" IS THE ANSWER THAT EXPLAINS THE ZERO.
        // It is also the common case for a small business, and it is genuinely
        // fixed in GA4 rather than here — so it links out rather than pretending
        // we can create one.
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            Your analytics property has no key events, which is exactly why nothing has ever
            been counted. You can mark one in Google Analytics — Admin → Events → toggle
            &ldquo;Mark as key event&rdquo; — and it&apos;ll appear here.
          </p>
          <Button asChild size="sm" variant="outline">
            <a href="https://analytics.google.com" target="_blank" rel="noreferrer">
              Open Analytics
              <ExternalLink className="ml-1.5 size-3" aria-hidden="true" />
            </a>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <button
              key={e.eventName}
              type="button"
              aria-pressed={selectedEvent === e.eventName}
              onClick={() => onPick(e.eventName)}
              className={`flex w-full items-center justify-between gap-2 rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                selectedEvent === e.eventName ? "border-primary bg-muted/40" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-sm">{e.eventName}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {e.custom ? "You marked this one" : "Set up by Google Analytics"}
                </span>
              </span>
              {selectedEvent === e.eventName && (
                <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
