/**
 * Pure rules behind the advertising declaration form
 * (components/ads/advertising-declaration-card.tsx).
 *
 * The reasoning for each rule is kept beside the rule. The card's own file
 * keeps the reasoning about its state (what is held, what is derived).
 */

import type { DeclarationState } from "@/lib/ads-copy";

export type DeclarationAnswer = "NOT_POLITICAL" | "POLITICAL";

export interface DeclarationPatchInput {
  /** `false` withdraws the declaration. */
  declare: boolean;
  /** The answer in force (null counts as NOT_POLITICAL, as the card did). */
  answerInForce: DeclarationAnswer | null;
  /** How many category options the api served. */
  categoryOptionCount: number;
  /** The categories currently selected (seeded from the stored answer). */
  selectedCategories: string[];
  /** The countries currently named (seeded from the stored answer). */
  countries: string[];
}

export interface DeclarationPatch {
  politicalIntent: DeclarationAnswer | null;
  specialAdCategories?: string[];
  specialAdCategoryCountries?: string[];
}

/**
 * The one submission: the political answer and the category answers are given
 * against one notice at one moment, and the api refuses them separately
 * (DECLARATION_INCOMPLETE) so a record cannot end up with halves consented to
 * under different wordings.
 *
 *  - Categories are sent ONLY when the question was shown. If the api served
 *    no options the checkboxes never rendered, so sending `[]` would record
 *    "none of these apply" from a form that never asked. `[]` is a real answer
 *    for categories and must be sent when asked.
 *  - Countries are never sent empty (the api's `.min(1)` refuses `[]`), and are
 *    sent only for the POLITICAL answer: the text box is hidden rather than
 *    cleared, so a typed or stored list would otherwise record a jurisdiction
 *    claim from a hidden field on a not-political declaration.
 */
export function buildDeclarationPatch(i: DeclarationPatchInput): DeclarationPatch {
  if (!i.declare) return { politicalIntent: null };
  return {
    politicalIntent: i.answerInForce ?? "NOT_POLITICAL",
    ...(i.categoryOptionCount > 0 ? { specialAdCategories: i.selectedCategories } : {}),
    ...(i.answerInForce === "POLITICAL" && i.countries.length > 0
      ? { specialAdCategoryCountries: i.countries }
      : {}),
  };
}

/**
 * The toast for a failed save. "Try again in a moment" is a lie for the two
 * errors this form can cause by itself — retrying re-sends the same request
 * for ever — so those say what happened and what did NOT happen.
 */
export function saveErrorMessage(code: string | undefined): string {
  if (code === "DECLARATION_STANDING") {
    return (
      "This business is recorded as a political advertiser. That's a legal statement and " +
      "a checkbox doesn't retract it — withdraw it first, then declare again. Nothing " +
      "was changed."
    );
  }
  if (code === "DECLARATION_INCOMPLETE") {
    return (
      "We can't show the Meta category question right now, and saving without it would " +
      "erase the answer you already gave. Nothing was changed — your existing declaration " +
      "still stands."
    );
  }
  return "Couldn't save your declaration. Try again in a moment — nothing was changed.";
}

export interface FormModeInput {
  state: DeclarationState;
  reconfirmingPolitical: boolean;
  amending: boolean;
}

/**
 * Which of the form's reasons is on screen. Several reach the same form and a
 * heading that names the wrong one tells the merchant to look for a change
 * that did not happen.
 */
export type FormMode =
  | "reconfirm_wording" // a POLITICAL record whose notice was reworded
  | "answer_categories" // a standing record missing the Meta category answer
  | "superseded"
  | "unsupported_notice"
  | "read_failed"
  | "first_declaration";

export function formMode({ state, reconfirmingPolitical, amending }: FormModeInput): FormMode {
  if (reconfirmingPolitical) {
    return state.kind === "political" && state.superseded
      ? "reconfirm_wording"
      : "answer_categories";
  }
  if (amending) return "answer_categories";
  if (state.kind === "superseded") return "superseded";
  if (state.kind === "unknown") {
    return state.reason === "unsupported_notice" ? "unsupported_notice" : "read_failed";
  }
  return "first_declaration";
}

export function formHeading(mode: FormMode): string {
  switch (mode) {
    case "reconfirm_wording":
    case "superseded":
      return "Please confirm the current wording";
    case "answer_categories":
      return "Answer the Meta category question";
    case "unsupported_notice":
      return "This notice has changed";
    case "read_failed":
      return "We couldn't check your advertising declaration";
    case "first_declaration":
      return "Advertising declaration";
  }
}

/**
 * The submit button's label. A re-confirm is not a first declaration, so it
 * never says "Save declaration".
 */
export function formSubmitLabel(mode: FormMode): string {
  switch (mode) {
    case "reconfirm_wording":
    case "superseded":
      return "Confirm";
    case "answer_categories":
      return "Save";
    default:
      return "Save declaration";
  }
}
