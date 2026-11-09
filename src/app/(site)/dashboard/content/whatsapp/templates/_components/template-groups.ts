/**
 * The Studio's language variants — PR-3.5.
 *
 * ── ★★WHAT THIS ROW ACTUALLY OWES, MEASURED RATHER THAN INHERITED ──────────
 *
 * The plan says *"`biz_templates` is already unique on `(businessId, name,
 * language)` so variants are expressible — **there is just no flow for
 * them**"*, and its own §Status instruction is to re-measure before building.
 * Measured 2026-09-03:
 *
 *   - ✅**The api already supports them in full.** `POST /studio/templates/draft`
 *     takes a `language`, refuses a duplicate on the NORMALISED `(name,
 *     language)` pair, and `GET /templates/check-existing?name=&language=`
 *     answers about one. Nothing here needs a new endpoint.
 *   - 🚫**The b2c page renders a FLAT list.** One row per stored document, so
 *     `order_update` in English and `order_update` in Hindi appear as two
 *     unrelated entries with the same name and no relationship drawn — and the
 *     only way to make the second is to retype the name exactly into a free-text
 *     box, with nothing saying the first exists.
 *
 * ★So the flow is the missing half: **group by name, keep the per-language
 * verdicts apart, and make "add a language" an action rather than a retype.**
 *
 * ★★EVERYTHING HERE IS A PURE FUNCTION OF THE LIST THE API RETURNS, so the page
 * stays a renderer and every rule is testable without a DOM — the same split
 * ✅3.4a and ✅3.4b·i made in the CMS for the platform plane's version of this
 * exact screen.
 */

/**
 * The least this module needs of a stored template.
 *
 * ★★EVERY FUNCTION HERE IS GENERIC OVER IT, so the page keeps its OWN precise
 * types — `category` as its `Category` union, `status` as `TemplateStatus`,
 * `components` as the editor's shape — and a grouped variant can still be
 * handed straight back to `loadTemplate`. 🚫Widening the page's types to match a
 * helper is the wrong direction: the helper needs less, not the page more.
 */
export interface StudioTemplate {
  _id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  updatedAt?: string;
}

/**
 * Fold a language for COMPARISON — never for display.
 *
 * ⚠️★★IT IS THE api's OWN RULE, TRANSCRIBED. `template-studio.ts` normalises
 * before checking for a duplicate, because *"`en_US` and `en-US` are ONE
 * template to Meta — its uniqueness is (WABA, name, language)"* — so a surface
 * that compared raw strings would offer a merchant a language the api will
 * refuse with a 409, and draw two tabs for one locale.
 *
 * 🚫**The STORED spelling is what is shown and what is sent.** The same
 * two-folds rule §3.1 paid for three times: *the comparison normalises; the
 * stored value does not.*
 */
export function normaliseLanguage(language: string | undefined): string {
  // ⚠️🚫★★★TRANSCRIBED CHARACTER FOR CHARACTER, AND A ROUND FOUND WHY THAT
  //  MATTERS. The api's is `String(language || "en").toLowerCase().replace(
  //  /-/g, "_")` — it folds an ABSENT language to `"en"` and it does NOT trim.
  //
  // 🚫★A first version folded an absent one to `""` and argued that defaulting
  //  "would invent a locale". **That is the wrong argument for this function.**
  //  Its whole job is to predict what the api will call a duplicate — so a row
  //  with no language is `en` to the SAVE, and calling it something else here
  //  let the UI offer "add en" on a group the api answers **409 DUPLICATE**
  //  for, after the merchant had written a body.
  //
  // ★THE TRIM MOVED TO THE CALLER, where it belongs: the input is trimmed
  //  BEFORE it is folded, because trimming is what the SEND does.
  return String(language || "en").toLowerCase().replace(/-/g, "_");
}

/**
 * A row's `updatedAt` as a comparable number, with **no NaN**.
 *
 * ⚠️🚫★★★EXPORTED AFTER A ROUND FOUND THE PAGE RE-DERIVING IT WRONG.
 * `Date.parse(x ?? "")` is `NaN` for an undated row, and a comparator that
 * returns NaN leaves V8's sort **untouched** — so "seed from the most recently
 * edited variant" silently fell back to `variants[0]`, the alphabetically-first
 * language, which is the exact regression its own comment claimed to fix.
 *
 * ★`-Infinity` sorts an undated row LAST under a descending compare, which is
 * the same choice `groupByName` makes about a whole group: an absent date is
 * not a recent one. **One rule, one export, no second derivation.**
 */
export function updatedAtMs(t: { updatedAt?: string }): number {
  const ms = t.updatedAt ? Date.parse(t.updatedAt) : NaN;
  return Number.isNaN(ms) ? -Infinity : ms;
}

/**
 * The variant a merchant is most likely translating FROM.
 *
 * ★What they last edited, not what sorts first alphabetically. 🚫The list's own
 * order is by LANGUAGE — deliberately, so it does not reshuffle on a refetch —
 * which makes index 0 useless for this question.
 */
export function mostRecentVariant<T extends StudioTemplate>(
  group: TemplateGroup<T>,
): T | undefined {
  return group.variants.reduce<T | undefined>(
    (best, v) => (best === undefined || updatedAtMs(v) > updatedAtMs(best) ? v : best),
    undefined,
  );
}

/** One template name, and every language stored under it. */
export interface TemplateGroup<T extends StudioTemplate = StudioTemplate> {
  /** The name as stored — Meta keys by it EXACTLY, so it is never folded. */
  name: string;
  variants: T[];
  /**
   * The categories the group's languages carry, deduped.
   *
   * ⚠️★★MORE THAN ONE IS A REAL STATE AND IT IS SURFACED RATHER THAN PICKED.
   * Nothing in the api ties a second language's category to the first's, so a
   * merchant can draft `order_update` as UTILITY in English and MARKETING in
   * Hindi. 🚫Showing the first one as *"the"* category would hide the more
   * expensive half — Meta bills marketing differently — and picking one would
   * be a guess about which the merchant meant.
   */
  categories: string[];
}

/**
 * Group the flat list by name, newest group first.
 *
 * ★NAME MATCHED EXACTLY, LANGUAGE FOLDED. Meta's key is `(name, language)` and
 * only the second half has spelling variants; two rows differing in NAME are two
 * templates however similar they look, and folding names would merge them.
 *
 * ★ORDER IS BY THE GROUP'S MOST RECENT `updatedAt`, so a language somebody just
 * added brings its whole template to the top — which is where they will look
 * for it. ⚠️★Rows with no `updatedAt` sort last rather than first: an absent
 * date is not a recent one.
 */
export function groupByName<T extends StudioTemplate>(templates: T[]): TemplateGroup<T>[] {
  const byName = new Map<string, T[]>();
  for (const t of templates) {
    if (!t || typeof t.name !== "string") continue;
    const list = byName.get(t.name);
    if (list) list.push(t);
    else byName.set(t.name, [t]);
  }

  const stamp = updatedAtMs;

  return [...byName.entries()]
    .map(([name, variants]) => ({
      name,
      // ★VARIANTS SORTED BY LANGUAGE so the order is stable across refetches —
      //  a list that reorders itself under a merchant's cursor is its own bug.
      variants: [...variants].sort((a, b) =>
        normaliseLanguage(a.language).localeCompare(normaliseLanguage(b.language)),
      ),
      categories: [
        ...new Set(variants.map((v) => v.category).filter((c): c is string => typeof c === "string" && c !== "")),
      ].sort(),
    }))
    .sort((a, b) => {
      const diff = Math.max(...b.variants.map(stamp)) - Math.max(...a.variants.map(stamp));
      // ★NAME BREAKS A TIE, because `-Infinity - -Infinity` is `NaN` and a
      //  comparator returning NaN leaves the order engine-defined. Two groups
      //  with no dates at all would otherwise shuffle between renders.
      return Number.isNaN(diff) || diff === 0 ? a.name.localeCompare(b.name) : diff;
    });
}

/**
 * Which languages a group already holds, folded.
 *
 * ★Used to refuse an "add a language" the api would 409 — and to refuse it
 * BEFORE the merchant writes a body, rather than after.
 */
export function heldLanguages(group: TemplateGroup<StudioTemplate>): Set<string> {
  return new Set(group.variants.map((v) => normaliseLanguage(v.language)));
}

/**
 * Can this group take this language?
 *
 * ⚠️★★IT RETURNS THE REASON, NOT A BOOLEAN. *"Add a language"* failing silently
 * is the shape §02's rule refuses — a control that can only fail is worse than
 * none — and the two ways it can fail need two different sentences: an empty box
 * is something to fill in, and a duplicate is a template the merchant already
 * has and probably wants to OPEN.
 */
export function addLanguageProblem(
  group: TemplateGroup<StudioTemplate>,
  language: string,
): { code: "EMPTY" | "LENGTH" | "DUPLICATE"; message: string } | null {
  // ★THE TYPED STRING DECIDES 'EMPTY', and the FOLDED one decides 'DUPLICATE'.
  //  🚫Asking the fold whether it is empty cannot work now that an absent
  //  language folds to `"en"` — an empty box would read as "add English".
  const typed = language.trim();
  if (typed === "") {
    return {
      code: "EMPTY",
      message: "Name the language first — Meta keys a template by its name AND its language.",
    };
  }
  // ⚠️★THE API'S OWN BOUNDS, TRANSCRIBED: `z.string().min(2).max(16)` on the
  //  draft body. 🚫Without them a one-character locale sailed past this guard and
  //  400ed **after** the merchant had translated a body — which is the whole
  //  failure this function exists to move earlier.
  if (typed.length < 2 || typed.length > 16) {
    return {
      code: "LENGTH",
      message:
        "A language code is 2 to 16 characters — `en`, `hi`, `pt-BR`. Meta keys a template " +
        "by one, so it cannot be a single letter.",
    };
  }
  const wanted = normaliseLanguage(typed);
  if (heldLanguages(group).has(wanted)) {
    return {
      code: "DUPLICATE",
      message:
        `This template already has a ${language.trim()} version. Open it from the list to edit it — ` +
        "Meta holds one template per name and language.",
    };
  }
  return null;
}

/**
 * The status a GROUP shows, when it shows one at all.
 *
 * ── ⚠️🚫★★A GROUP HAS NO SINGLE STATUS, AND SAYING IT DOES IS THE LIE §05
 *    REFUSED ONE SURFACE OVER ────────────────────────────────────────────────
 *
 * Meta approves `(name, language)`, so a template can be APPROVED in English and
 * REJECTED in Hindi at the same moment. ★★A header badge reading *"Approved"*
 * over that group tells a merchant their Hindi copy is live when it is not —
 * which is precisely why ✅3.4a's CMS list draws a per-language MATRIX rather
 * than a column of single verdicts.
 *
 * ★So this returns a summary only when every language AGREES, and `null` when
 * they do not — and the caller renders the per-language badges either way. The
 * summary is a convenience for the common single-language case, never a
 * substitute for the row beneath it.
 */
export function unanimousStatus(group: TemplateGroup<StudioTemplate>): string | null {
  const statuses = new Set(group.variants.map((v) => v.status));
  return statuses.size === 1 ? [...statuses][0]! : null;
}
