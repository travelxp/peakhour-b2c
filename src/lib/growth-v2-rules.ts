import { ApiError } from "@/lib/api";
import type { AdPlatform, DraftOffer, GuardrailsPatch, MandatePatch, MandateTarget, MandateView, RulesResponse } from "@/lib/api/growth-v2";
import { offerKey, parseAmount, targetKindOf } from "@/lib/growth-v2-firstrun";

/**
 * Rules (plan 1 and 2.10, row H5): turning a switch or an edit into the request the api takes, and saying what came back.
 *
 * ★PURE, SO IT CAN BE TESTED WITHOUT A BROWSER. The screen only renders; which key a switch sends is decided here.
 * ★A GUARDRAIL CHANGE IS A PATCH WITH THE ONE KEY IT CHANGES. The api keeps every rule the request does not name, so a
 * switch never sends (and never clobbers) a rule the screen did not show.
 * ★A MANDATE EDIT SENDS ONLY WHAT CHANGED, and the api writes none of it: it sends the owner a confirmation link.
 * There is no autonomy control anywhere: the level moves by the engine's own demotion or a promotion the owner approves.
 */

type Guardrails = RulesResponse["guardrails"];

export const DEFAULT_QUIET_HOURS = { start: "22:00", end: "07:00" } as const;

export type GuardrailChange =
  | { kind: "approved_assets"; on: boolean }
  | { kind: "quiet_hours"; value: { start: string; end: string } | null }
  | { kind: "channel"; platform: AdPlatform; allowed: boolean }
  | { kind: "blocked_terms"; terms: string[] };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The request for one change, or the sentence that says why it cannot be made. */
export function guardrailPatchFor(g: Guardrails, change: GuardrailChange): { patch: GuardrailsPatch } | { error: string } {
  switch (change.kind) {
    case "approved_assets":
      return { patch: { approvedAssetsOnly: change.on } };
    case "quiet_hours": {
      if (change.value === null) return { patch: { quietHours: null } };
      if (!HHMM.test(change.value.start) || !HHMM.test(change.value.end)) return { error: "Enter the times as 24-hour HH:MM, for example 22:00." };
      if (change.value.start === change.value.end) return { error: "Quiet hours need different start and end times." };
      return { patch: { quietHours: { start: change.value.start, end: change.value.end } } };
    }
    case "blocked_terms":
      return { patch: { blockedTerms: change.terms } };
    case "channel": {
      if (g.allowedChannels !== null) {
        const next = change.allowed ? [...new Set([...g.allowedChannels, change.platform])] : g.allowedChannels.filter((p) => p !== change.platform);
        if (next.length === 0) return { error: "Keep at least one channel on. To stop all advertising, use the halt switch instead." };
        return { patch: { allowedChannels: next as AdPlatform[] } };
      }
      const denied = new Set(g.deniedChannels);
      if (change.allowed) denied.delete(change.platform);
      else denied.add(change.platform);
      return { patch: { deniedChannels: [...denied] as AdPlatform[] } };
    }
  }
}

/** Whether the engine may use a channel, by the allow list when there is one, else by the deny list. */
export function channelAllowed(g: Guardrails, platform: AdPlatform): boolean {
  return g.allowedChannels !== null ? g.allowedChannels.includes(platform) : !g.deniedChannels.includes(platform);
}

export interface MandateEdit {
  /** `offerKey` of the chosen outcome. */
  offer: string;
  /** Label of the chosen focus suggestion; empty = every outcome of the kind counts. */
  focus: string;
  ceiling: string;
  target: string;
}

/** The edit form's starting point: what the mandate says now. */
export function editFrom(m: MandateView): MandateEdit {
  return { offer: offerKey(m.outcome), focus: m.outcome.focus?.label ?? "", ceiling: String(m.monthlyCeiling), target: String(m.target.value) };
}

/**
 * What changed between the mandate and the form, as the api's `mandate` patch, or a sentence when the form cannot be sent,
 * or undefined when nothing changed. Only changed fields are named.
 */
export function mandatePatchFor(m: MandateView, edit: MandateEdit, offers: readonly DraftOffer[]): MandatePatch | { error: string } | undefined {
  const patch: MandatePatch = {};
  const ceiling = parseAmount(edit.ceiling);
  if (ceiling === undefined) return { error: "Enter a monthly ceiling above zero." };
  if (ceiling !== m.monthlyCeiling) patch.monthlyCeiling = ceiling;

  const offer = offers.find((o) => offerKey(o) === edit.offer);
  const focus = offer?.source === "orders" ? offer.focusSuggestions.find((f) => f.label === edit.focus) : undefined;
  const outcomeChanged = offerKey(m.outcome) !== edit.offer || (m.outcome.focus?.label ?? "") !== (focus?.label ?? "");
  if (outcomeChanged) {
    if (!offer) return { error: "Choose one of the outcomes your business can be measured on." };
    patch.outcome = {
      kind: offer.kind,
      source: offer.source,
      optimizeFor: offer.optimizeFor,
      ...(focus ? { focus: { by: focus.by, values: focus.values, label: focus.label } } : {}),
    };
  }

  const typed = parseAmount(edit.target);
  if (edit.target.trim() !== "" && typed === undefined) return { error: "Enter a target above zero." };
  // The target's kind follows the outcome it measures: a return for value, a cost for a count.
  const kind: MandateTarget["kind"] = outcomeChanged && offer ? targetKindOf(offer) : m.target.kind;
  // An outcome measured the other way with the old target still in the box: that number is a cost, not a return (or the
  // reverse), so it is not a target of the new kind. The merchant must retype it.
  if (outcomeChanged && kind !== m.target.kind && typed === m.target.value) {
    return { error: "This outcome is measured differently, so enter a target for it." };
  }
  if (typed !== undefined && (typed !== m.target.value || kind !== m.target.kind)) patch.target = { kind, value: typed };

  return Object.keys(patch).length === 0 ? undefined : patch;
}

/** The words for a change request that came back refused. Codes the api writes for the merchant show their sentence. */
const MERCHANT_FACING: ReadonlySet<string> = new Set(["NO_MANDATE", "NO_CHANGE", "OUTCOME_NOT_OFFERED", "TARGET_NEEDED", "NO_VERIFIED_CONTACT", "SEND_FAILED"]);

export function patchErrorMessage(err: unknown): string {
  if (err instanceof ApiError && MERCHANT_FACING.has(err.code ?? "")) return err.message;
  // A guardrail refusal is written in the merchant's words too (the api builds it for the card).
  if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && err.message && err.message !== "Invalid body") return err.message;
  return "We could not save that. Try again in a moment.";
}

/** "Sent for confirmation" copy, shown once a mandate edit has started its WhatsApp link. */
export const SENT_FOR_CONFIRMATION = "Sent for confirmation. Open the link we sent to your WhatsApp and enter the code. Nothing changes until you do.";
