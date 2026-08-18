"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { LeadFormPicker } from "@/components/ads/lead-form-picker";
import { growthApi } from "@/lib/api/growth";
import {
  LATEST_POLITICAL_DECLARATION_NOTICE,
  noticeTextFor,
  POLITICAL_DECLARATION_POLICY_URL,
} from "@/lib/ads-copy";
import {
  toastUnhandledApiError,
  toastAdAccountNotAuthorized,
  toastAdAccountForbidden,
  RECONNECT_NUANCE,
} from "@/lib/toast-errors";
import {
  reconnectHref,
  ADS_LINKEDIN_PATH,
  LINKEDIN_ADS_PROVIDER,
} from "@/lib/integrations-connect";
import {
  linkedInAdsApi,
  type BoostObjective,
} from "@/lib/api/linkedin-ads";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Rocket } from "lucide-react";
import { AudiencePreview, useAudienceProposal } from "./audience-preview";

/**
 * Boost-to-Campaign dialog (G1) — turns a ranked organic post into a
 * REAL LinkedIn campaign via POST /v1/linkedin/ads/boost.
 *
 * Safety framing baked into the copy: the campaign is created as a
 * LinkedIn DRAFT under a DRAFT group. Nothing spends from this dialog
 * — activation (the one spend-enabling action) lives in the Ads
 * Manager behind its own confirm.
 */

/**
 * Where the Connect / Reconnect CTAs send the user. The `returnTo` is
 * forwarded by the Integrations page into the OAuth authorize call, so the
 * callback lands them back on the LinkedIn hub they were boosting from —
 * the old flow dropped them on /dashboard/settings, several clicks from the
 * post they came to boost.
 */
const RECONNECT_HREF = reconnectHref("/dashboard/content/linkedin", LINKEDIN_ADS_PROVIDER);

/**
 * Objectives a BOOST can use.
 *
 * ★`lead_generation` IS BACK, AND ONLY BECAUSE THERE IS SOMETHING TO ATTACH.
 * LinkedIn requires a lead gen form URN on every creative under a lead-gen
 * campaign; until Lead forms existed nothing in the product could produce one,
 * so this option was removed after it had spent a while guaranteeing a
 * failure. It is now gated on a LIVE form rather than hidden — a business with
 * no form is told what to make, which is a different thing from being told the
 * objective does not exist.
 */
const OBJECTIVES: Array<{ value: BoostObjective; label: string }> = [
  { value: "engagement", label: "Engagement (boost the post)" },
  { value: "brand_awareness", label: "Brand awareness" },
  { value: "website_traffic", label: "Website traffic" },
  { value: "lead_generation", label: "Lead generation (collect enquiries)" },
];

/** How long the boost will wait for the durable declaration write before
 *  closing anyway. Long enough for a normal PATCH, short enough that a stalled
 *  one can't hide a campaign that already exists. */
const DURABLE_WRITE_CAP_MS = 2500;

export function BoostCampaignDialog({
  open,
  onOpenChange,
  postUrn,
  defaultName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postUrn: string;
  defaultName: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [objective, setObjective] = useState<BoostObjective>("engagement");
  const [askId, setAskId] = useState<string>("");
  /**
   * Decision D13's confirmed geography. `undefined` means "use what we inferred
   * from the business", which is the default and today's behaviour; an array —
   * INCLUDING an empty one — is the user's own statement, and `/boost` treats
   * the two differently.
   */
  const [geo, setGeo] = useState<string[] | undefined>(undefined);
  /**
   * Whether the engine could actually build an audience for this boost.
   *
   * Read from the SAME query the preview renders (react-query shares the cache,
   * so there is one request) rather than reported up by a callback: a child
   * setting a parent's state during render is an update to a different
   * component mid-render, and the value is derived data that never needed to be
   * state at all. The campaign is still creatable without an audience — /boost
   * deliberately never fails over one — but the user must not be told a
   * campaign is ready when LinkedIn will refuse to deliver it.
   */
  const proposal = useAudienceProposal(geo);
  // ★A FAILED PREVIEW SAYS NOTHING ABOUT THE CAMPAIGN. `/boost` re-resolves the
  // audience server-side, so a 502 on `/propose` has no bearing on whether the
  // campaign gets targeting — and warning that it will not would be two
  // contradictory sentences 40px apart, with the frightening one wrong.
  const willTarget =
    proposal.isPending || proposal.isError || proposal.data?.proposal != null;
  const [dailyBudget, setDailyBudget] = useState("10");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [durationDays, setDurationDays] = useState("14");
  // LinkedIn requires an ads-creating app to show its political-advertising
  // notice and pass back the advertiser's confirmation. Their spec says the
  // notice "must be clearly presented and checked by default", so it starts
  // ticked — and unticking it is meaningful: the campaign is then created
  // NOT_DECLARED, which LinkedIn may hold from EU delivery until declared.
  const [notPolitical, setNotPolitical] = useState(true);
  // "Also apply to my future campaigns" — converts this per-campaign answer
  // into the business-level declaration in the SAME gesture. The user is
  // already reading LinkedIn's wording and ticking it here; expecting them to
  // visit a settings page afterwards is how the record stays empty, and an
  // empty record is why autonomous creates (WhatsApp, optimizer) fall back to
  // NOT_DECLARED. Defaults OFF: recording a durable declaration is a bigger
  // statement than answering for one campaign, so it is opt-in even though
  // LinkedIn's own notice is checked by default.
  const [applyToFuture, setApplyToFuture] = useState(false);

  // Shared cache with the Ads-hub declaration card. Read here for ONE reason:
  // to know which notice version the api will stamp if the user opts in
  // durably. The per-campaign answer below needs no version — it rides the
  // boost request straight to LinkedIn and is never recorded against wording.
  const settings = useQuery({
    queryKey: ["growth-settings"],
    queryFn: () => growthApi.settings(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const stampableNotice = noticeTextFor(settings.data?.currentNoticeVersion);
  // Latched on a failure a resubmit cannot improve on — the button stays
  // disabled for this dialog instance, and the reason picks its label:
  // "persisted"      PERSIST_FAILED — the draft EXISTS on LinkedIn, so
  // a resubmit would duplicate it.
  // "not_authorized" AD_ACCOUNT_NOT_AUTHORIZED — LinkedIn refuses this
  // ad account for our app; nothing was created and
  // nothing will be until that access is granted.
  const [blocked, setBlocked] = useState<"persisted" | "not_authorized" | null>(null);

  // Round ONCE up front so validation, the displayed cap, and the
  // payload can never disagree (typing "14.7" must not show a x14.7
  // cap while the server stores x15).
  const budgetNumber = Number(dailyBudget);
  const durationNumber = Math.round(Number(durationDays));
  /** Fat-finger ceiling for a daily spend input — the server accepts
   *  any positive number, so the UI is the sanity gate. */
  const MAX_DAILY_BUDGET = 1_000_000;
  const valid =
    name.trim().length > 0 &&
    Number.isFinite(budgetNumber) &&
    budgetNumber > 0 &&
    budgetNumber <= MAX_DAILY_BUDGET &&
    /^[A-Za-z]{3}$/.test(currencyCode.trim()) &&
    Number.isFinite(durationNumber) &&
    durationNumber >= 1 &&
    durationNumber <= 366 &&
    // ★A LEAD-GEN BOOST WITHOUT A FORM CANNOT SUCCEED. LinkedIn refuses the
    // creative, and it does so only AFTER the campaign group and campaign have
    // been created — so letting the button through would leave two orphan
    // artefacts in the customer's Campaign Manager for an error the dialog
    // already knew about.
    (objective !== "lead_generation" || askId.length > 0);

  const boost = useMutation({
    // The declaration answers travel as VARIABLES, not read from state in
    // onSuccess. Inputs stay enabled while the request is in flight, so a
    // toggle during that window would otherwise make the durable declaration
    // disagree with the campaign that was actually created.
    mutationFn: (vars: { notPolitical: boolean; applyToFuture: boolean }) =>
      linkedInAdsApi.boost({
        postUrn,
        name: name.trim(),
        objective,
        dailyBudget: budgetNumber,
        currencyCode: currencyCode.trim().toUpperCase(),
        durationDays: durationNumber,
        notPolitical: vars.notPolitical,
        // Only meaningful for lead_generation, and the server refuses that
        // objective without it — see the picker below.
        ...(objective === "lead_generation" && askId ? { askId } : {}),
        // Sent so the campaign gets the audience the preview showed. Without
        // it the boost would resolve from the profile's own countries and the
        // preview would be a lie about its own effect.
        ...(geo !== undefined ? { geo } : {}),
      }),
    onSuccess: async (_data, vars) => {
      // The Ads Manager list must show the new campaign even within
      // its staleTime window.
      queryClient.invalidateQueries({ queryKey: ["linkedin-managed-campaigns"] });
      // Record the durable declaration only AFTER the boost succeeded, and
      // never block or fail the boost on it: the campaign already carries this
      // answer on its own create call, so a settings write that fails costs
      // the user nothing they can see. Silent by design — a toast about a
      // settings write would bury the one that matters.
      if (vars.applyToFuture && vars.notPolitical) {
        // NOT fire-and-forget. The success toast offers "Open Ads Manager",
        // which is a full-document navigation — that aborts an in-flight
        // request, so a user who ticked this and clicked through would land on
        // the Ads hub being told they had not declared. Awaited inside the
        // mutation instead, before the dialog closes.
        // Awaited so the success toast's "Open Ads Manager" — a full-document
        // navigation — can't abort it. But CAPPED: Cancel is disabled while
        // this mutation is pending and the dismissal guard blocks Escape, so an
        // un-capped await would trap the user on "Creating…" with no hint that
        // the LinkedIn draft already exists. After the cap we stop waiting; the
        // request usually still lands, and the Ads-hub card offers the
        // declaration either way.
        const write = growthApi
          .updateSettings({ notPolitical: true })
          .then((res) => queryClient.setQueryData(["growth-settings"], res))
          .catch(() => {
            // The campaign is created and already carries this answer, so a
            // second error toast would bury the one that matters.
          });
        await Promise.race([
          write,
          new Promise((resolve) => setTimeout(resolve, DURABLE_WRITE_CAP_MS)),
        ]);
      }
      onOpenChange(false);
      toast.success("Draft campaign created on LinkedIn.", {
        description:
          "It won't spend until you activate it. Finish targeting, then activate from the Ads Manager.",
        action: {
          label: "Open Ads Manager",
          onClick: () => {
            // ADS_LINKEDIN_PATH names the channel — the hub otherwise
            // defaults to whichever ad channel is connected first.
            window.location.href = ADS_LINKEDIN_PATH;
          },
        },
      });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "CURRENCY_MISMATCH") {
        // Server-authored ("Ad account 5123… bills in INR; use that
        // currency") — NOT provider text, and the only message worth
        // rendering verbatim on this surface.
        toast.error((err as ApiError).message);
      } else if (code === "NOT_CONNECTED") {
        // Also the code a STALE (needs_reauth) connection produces —
        // the server only uses active connections.
        toast.error("Connect (or reconnect) LinkedIn Ads first.", {
          action: {
            label: "Integrations",
            onClick: () => { window.location.href = RECONNECT_HREF; },
          },
        });
      } else if (code === "NEEDS_REAUTH") {
        toast.error("LinkedIn Ads needs a reconnect before boosting.", {
          description: RECONNECT_NUANCE,
          action: {
            label: "Reconnect",
            // returnTo brings the user back HERE after the OAuth round
            // trip instead of stranding them on Settings.
            onClick: () => { window.location.href = RECONNECT_HREF; },
          },
        });
      } else if (code === "AD_ACCOUNT_NOT_AUTHORIZED") {
        // The 403 that used to masquerade as NEEDS_REAUTH. LinkedIn only
        // lets an app write to ad accounts it has been granted in the
        // Developer Portal, so this is OURS to fix — offering Reconnect
        // here is the loop that wasted the user's time. No retry either:
        // the answer will not change until the access is granted.
        setBlocked("not_authorized");
        toastAdAccountNotAuthorized(err, "Boosting");
      } else if (code === "AD_ACCOUNT_FORBIDDEN") {
        // Advertiser-fixable, but in LinkedIn Campaign Manager — so no
        // Reconnect CTA. Deliberately NOT latched like the not-authorised
        // case: once a billing hold is cleared the very same request works,
        // so the button stays live. The helper keeps the request id on the
        // toast — this code is also the api's unattributable-403 catch-all.
        toastAdAccountForbidden(err, "Boosting isn't possible on this ad account.");
      } else if (code === "NO_AD_ACCOUNT") {
        toast.error(
          "Your LinkedIn Ads connection has no ad account — reconnect it, or create an ad account in LinkedIn Campaign Manager first.",
        );
      } else if (code === "FORBIDDEN") {
        toast.error("Pick a business first, then boost.");
      } else if (code === "PERSIST_FAILED") {
        // The draft DOES exist on LinkedIn — retrying would duplicate it.
        setBlocked("persisted");
        toast.error(
          "The campaign was created on LinkedIn but couldn't be saved here. Contact support — don't retry.",
        );
      } else if (code === "DUPLICATE_DRAFT") {
        // An un-activated draft for this post already exists; sending
        // the user there beats letting them build a second one.
        onOpenChange(false);
        // The api also returns the existing row's id in error.details,
        // but no panel reads a ?campaign= param yet — linking to the hub
        // is what actually works. Row-level deep-linking is a follow-up.
        toast.error("You already have a draft campaign for this post.", {
          description: "Edit or activate it from the Ads Manager instead of creating a second one.",
          action: {
            label: "Open Ads Manager",
            onClick: () => { window.location.href = ADS_LINKEDIN_PATH; },
          },
        });
      } else if (code === "RATE_LIMITED") {
        toast.error("LinkedIn is rate-limiting us — give it a minute and try again.");
      } else if (
        code === "VALIDATION_LEADGEN_FORM_REQUIRED" ||
        code === "ASK_REQUIRED" ||
        code === "ASK_NOT_PUBLISHED" ||
        code === "ASK_NOT_FOUND"
      ) {
        toast.error("This campaign needs a live lead form.", {
          description: "Create or publish one under Ads → Lead forms, then boost.",
          action: {
            label: "Open Lead forms",
            onClick: () => { window.location.href = ADS_LINKEDIN_PATH; },
          },
        });
      } else if (code === "ASK_NOT_SERVING" || code === "ASK_WRONG_AD_ACCOUNT") {
        // ★NOT A GENERIC FAILURE. A rejected form leaves a campaign looking
        // perfectly healthy while nothing delivers, so the message has to name
        // the form as the thing to go and look at.
        toast.error(err instanceof ApiError ? err.message : "That lead form can't be used.", {
          action: {
            label: "Open Lead forms",
            onClick: () => { window.location.href = ADS_LINKEDIN_PATH; },
          },
        });
      } else {
        // Everything else: friendly copy keyed on the code, with the
        // request id for support. NOT err.message — see toast-errors.ts
        // for why surfacing raw provider text is the wrong fix.
        toastUnhandledApiError(err, "create the campaign", "LinkedIn");
      }
    },
  });

  const total =
    valid && Number.isFinite(budgetNumber * durationNumber)
      ? Math.round(budgetNumber * durationNumber * 100) / 100
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // No dismissal mid-flight: closing + reopening while the POST
        // is in flight would allow a concurrent duplicate boost.
        if (!next && boost.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-4" />
            Boost this post
          </DialogTitle>
          <DialogDescription>
            Creates a LinkedIn campaign sponsoring this post — as a{" "}
            <span className="font-medium">non-spending draft</span>. You finish
            audience targeting and activate it from the Ads Manager; only that
            activation starts spend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="boost-name">Campaign name</Label>
            <Input
              id="boost-name"
              value={name}
              maxLength={256}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="boost-objective">Objective</Label>
            <Select
              value={objective}
              onValueChange={(v) => setObjective(v as BoostObjective)}
            >
              <SelectTrigger id="boost-objective">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {objective === "lead_generation" ? (
            <LeadFormPicker value={askId} onChange={setAskId} />
          ) : null}

          {/* The audience this boost will get, BEFORE the money is committed —
              and the single inference the user is asked to confirm. */}
          <AudiencePreview geo={geo} onGeoChange={setGeo} />
          {!willTarget && (
            <p className="text-xs text-muted-foreground">
              We can&apos;t build an audience for this one, so the campaign will be created without
              targeting — LinkedIn won&apos;t deliver it until you set one from the Ads Manager.
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="boost-budget">Daily budget</Label>
              <Input
                id="boost-budget"
                type="number"
                min={1}
                max={MAX_DAILY_BUDGET}
                step="1"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="boost-currency">Currency</Label>
              <Input
                id="boost-currency"
                value={currencyCode}
                maxLength={3}
                onChange={(e) => setCurrencyCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="boost-days">Days</Label>
              <Input
                id="boost-days"
                type="number"
                min={1}
                max={366}
                step="1"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
              />
            </div>
          </div>

          {/* LinkedIn's political-advertising self-declaration. Not our
              wording to soften: their Advertising API contract requires an
              app that creates ads to present this notice and pass back what
              the advertiser confirmed (`politicalIntent`), and it became a
              REQUIRED campaign field with the EU's TTPA regulation — every
              create 422'd without it. Checked by default, per their spec. */}
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id="boost-not-political"
              checked={notPolitical}
              onCheckedChange={(v) => {
                setNotPolitical(v === true);
                // Un-ticking the notice must also clear the durable opt-in, or
                // re-ticking shows it already armed without a fresh gesture.
                if (v !== true) setApplyToFuture(false);
              }}
              className="mt-0.5"
            />
            <Label
              htmlFor="boost-not-political"
              className="text-[11px] font-normal leading-relaxed text-muted-foreground"
            >
              {stampableNotice ?? LATEST_POLITICAL_DECLARATION_NOTICE}{" "}
              <a
                href={POLITICAL_DECLARATION_POLICY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Learn more
              </a>
              {!notPolitical ? (
                <span className="mt-1 block text-warning-on-tint">
                  Left unticked, the campaign is created without a declaration
                  — LinkedIn may hold delivery to EU audiences until you make
                  one in Campaign Manager.
                </span>
              ) : null}
            </Label>
          </div>

          {/* Shown while the settings query is still in flight: gating on
              `stampableNotice` alone hid this on a fast submit — every field is
              pre-filled, so open-then-create inside 300ms is ordinary, and the
              user would never learn the durable option exists. Hidden only
              when we positively KNOW the api is on wording we don't hold. */}
          {notPolitical && !(settings.data && !stampableNotice) ? (
            <div className="flex items-start gap-2 pl-3">
              <Checkbox
                id="boost-apply-future"
                checked={applyToFuture}
                onCheckedChange={(v) => setApplyToFuture(v === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="boost-apply-future"
                className="text-[11px] font-normal leading-relaxed text-muted-foreground"
              >
                Also apply this to my future campaigns, including ones created
                automatically from WhatsApp or by the optimizer. You can withdraw
                it any time from the Ads hub.
              </Label>
            </div>
          ) : null}

          <p className="text-[11px] text-muted-foreground">
            Currency must match your LinkedIn ad account&apos;s billing
            currency.
            {total !== null ? (
              <>
                {" "}
                Planned cap:{" "}
                <span className="font-medium">
                  {currencyCode.toUpperCase()} {total}
                </span>{" "}
                — the monitor auto-pauses the campaign when spend reaches it.
              </>
            ) : null}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={boost.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => boost.mutate({ notPolitical, applyToFuture })}
            disabled={!valid || boost.isPending || blocked !== null}
          >
            {boost.isPending
              ? "Creating…"
              : blocked === "persisted"
                ? "Created — see support note"
                : blocked === "not_authorized"
                  ? "Blocked — see support note"
                  : "Create draft campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
