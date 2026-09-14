/**
 * The declaration state matrix.
 *
 * Every case here is a place where getting it wrong has a real consequence,
 * so they are worth pinning individually:
 *
 *   - showing a SUPERSEDED declaration as active claims protection the api
 *     is not giving (`resolvePoliticalIntent` ignores it and sends
 *     NOT_DECLARED), which is the worst outcome available here
 *   - collapsing a failed read into "undeclared" is safe-ish; collapsing it
 *     into "declared" is not — hence `unknown` exists as its own state
 *   - a false "not declared" only over-warns, so it is the correct default
 */

import { describe, it, expect } from "vitest";
import {
  declarationState,
  formatDeclaredAt,
  SPECIAL_AD_CATEGORY_QUESTION,
  SPECIAL_AD_CATEGORY_NONE_NOTE,
  stampableNoticeText,
  selectedCategories,
  parseCountryCodes,
  selectedCountries,
  euPoliticalAdsVerdict,
  declarationBlockedBecause,
  metaCategoryAnswerMissing,
  declarationSavedMessage,
} from "./ads-copy";
import * as adsCopy from "./ads-copy";

// The version in force. It is now just an opaque token to compare a stored
// declaration against — this file no longer holds any wording keyed by it.
const CURRENT = "ads-declaration-2026-09";

/**
 * ★THE WORDING, AS THE API SERVES IT.
 *
 * This file used to hold a `Record<version, string>` and these cases proved
 * the lookup. There is no lookup now: the api sends `currentNoticeText`
 * beside `currentNoticeVersion`, so the two cannot disagree and a notice
 * bump needs no deploy here. What is still worth pinning is the REFUSAL —
 * see the `unknown` cases below.
 */
// ★THE SERVED SHAPE, not a bare string: one wording per answer. A fixture
// that keeps the old shape would type-check nothing and pass while the card
// rendered `[object Object]` beside a consent checkbox.
const NOTICE = { notPolitical: "I confirm this is not political advertising. …" };

const declaration = {
  politicalIntent: "NOT_POLITICAL" as const,
  declaredAt: "2026-07-30T09:00:00.000Z",
  declaredByUserId: "69bbc24ce89bee1288944def",
  noticeVersion: CURRENT,
};

describe("declarationState", () => {
  it("undeclared when nothing is stored — the default for every business", () => {
    expect(
      declarationState({
        currentNoticeVersion: CURRENT,
        currentNoticeText: NOTICE,
      }),
    ).toEqual({ kind: "undeclared" });
    expect(
      declarationState({
        declaration: null,
        currentNoticeVersion: CURRENT,
        currentNoticeText: NOTICE,
      }),
    ).toEqual({
      kind: "undeclared",
    });
  });

  it("declared, carrying the provenance the record exists to hold", () => {
    expect(
      declarationState({
        declaration,
        currentNoticeVersion: CURRENT,
        currentNoticeText: NOTICE,
        declaredByName: "Vanshita Garg",
      }),
    ).toEqual({
      kind: "declared",
      declaredAt: declaration.declaredAt,
      declaredByName: "Vanshita Garg",
    });
  });

  it("declared without a name when the declarer is gone — date alone, not 'unknown user'", () => {
    const out = declarationState({
      declaration,
      currentNoticeVersion: CURRENT,
      currentNoticeText: NOTICE,
    });
    expect(out).toEqual({
      kind: "declared",
      declaredAt: declaration.declaredAt,
    });
  });

  it("SUPERSEDED — never rendered as active — when the wording has moved on", () => {
    // The api ignores this declaration and sends NOT_DECLARED. A UI showing
    // it as active would tell the user they are covered when they are not.
    const out = declarationState({
      declaration: { ...declaration, noticeVersion: "linkedin-ttpa-2024-01" },
      currentNoticeVersion: CURRENT,
      currentNoticeText: NOTICE,
      declaredByName: "Vanshita Garg",
    });
    expect(out.kind).toBe("superseded");
  });

  it("unknown — not undeclared — when the settings read failed", () => {
    // Distinct state on purpose: we cannot claim either answer.
    expect(declarationState({ failed: true })).toEqual({
      kind: "unknown",
      reason: "read_failed",
    });
    expect(
      declarationState({
        declaration,
        currentNoticeVersion: CURRENT,
        currentNoticeText: NOTICE,
        failed: true,
      }),
    ).toEqual({
      kind: "unknown",
      reason: "read_failed",
    });
  });

  it("unknown when the api sent no current version — we can't tell active from stale", () => {
    // Assuming "still valid" is the assumption that overstates coverage, so
    // the absent-version case must not resolve to `declared`.
    expect(declarationState({ declaration }).kind).toBe("unknown");
    expect(
      declarationState({ declaration, currentNoticeVersion: null }).kind,
    ).toBe("unknown");
    expect(
      declarationState({ declaration, currentNoticeVersion: "" }).kind,
    ).toBe("unknown");
  });

  it("gives a POLITICAL declaration its own READ-ONLY state", () => {
    // Previously this collapsed to `undeclared` — which both misreported it
    // (the api passes POLITICAL through) and put the tick-box on screen, so
    // one click would have overwritten a legal statement.
    const out = declarationState({
      declaration: { ...declaration, politicalIntent: "POLITICAL" },
      currentNoticeVersion: CURRENT,
      currentNoticeText: NOTICE,
      declaredByName: "Vanshita Garg",
    });
    expect(out).toEqual({
      kind: "political",
      declaredAt: declaration.declaredAt,
      declaredByName: "Vanshita Garg",
      superseded: false,
    });
  });

  it("a POLITICAL record under STALE wording reports superseded", () => {
    // The api ignores any superseded declaration regardless of intent, so
    // autonomous creates are sending NOT_DECLARED. Rendering this as an
    // in-force political record would overstate it — the same mistake
    // `superseded` exists to prevent, and the POLITICAL branch had it because
    // the intent check ran before the version comparison.
    const out = declarationState({
      declaration: {
        ...declaration,
        politicalIntent: "POLITICAL",
        noticeVersion: "old",
      },
      currentNoticeVersion: CURRENT,
      currentNoticeText: NOTICE,
    });
    expect(out).toEqual({
      kind: "political",
      declaredAt: declaration.declaredAt,
      superseded: true,
    });
  });

  it("treats a stored NOT_DECLARED as undeclared", () => {
    expect(
      declarationState({
        declaration: { ...declaration, politicalIntent: "NOT_DECLARED" },
        currentNoticeVersion: CURRENT,
        currentNoticeText: NOTICE,
      }),
    ).toEqual({ kind: "undeclared" });
  });

  it("is `unknown`, not `undeclared`, when the api sent no notice text", () => {
    // ⚠️THIS COMMENT USED TO DESCRIBE A MECHANISM THAT NO LONGER EXISTS, which
    // is the same stale-prose defect this programme keeps finding. It read:
    // "if the api bumps the version and deploys before this app ships the new
    // wording, collecting consent would stamp the NEW version against the OLD
    // text the user actually read." That drift is gone — the wording is served
    // beside the version, so the two cannot disagree.
    //
    // ★THE ASSERTION SURVIVES UNCHANGED, which is why it is worth keeping: a
    // surface that cannot show the wording it is about to stamp must refuse to
    // collect consent, and must refuse even with nothing declared — otherwise
    // an undeclared business gets a Save button that records text nobody read.
    // What changed is only WHEN it can happen: a broken or ancient response,
    // not an ordinary release. The read succeeded either way, so "try again"
    // is still a dead end and "campaigns are unaffected" is still false.
    expect(
      declarationState({ currentNoticeVersion: "ads-declaration-2099-01" }),
    ).toEqual({
      kind: "unknown",
      reason: "unsupported_notice",
    });
    expect(
      declarationState({
        declaration,
        currentNoticeVersion: "ads-declaration-2099-01",
      }),
    ).toEqual({ kind: "unknown", reason: "unsupported_notice" });
  });

  it("renders nothing confidently when there is no data at all", () => {
    // declarationState({}) must not resolve to `undeclared`: the card would
    // then show an amber warning and a Save button on a failed/paused fetch.
    expect(declarationState({})).toEqual({
      kind: "unknown",
      reason: "read_failed",
    });
  });

  it("a failed read wins over every other input", () => {
    // Ordering guard: if this ever fell through to the version comparison, a
    // failed read on a superseded declaration would render as needs-re-confirm,
    // implying we know something we don't.
    expect(
      declarationState({
        declaration: { ...declaration, noticeVersion: "old" },
        currentNoticeVersion: CURRENT,
        currentNoticeText: NOTICE,
        failed: true,
      }).kind,
    ).toBe("unknown");
  });
});

describe("formatDeclaredAt", () => {
  it("renders a readable date via Intl, not a hardcoded month list", () => {
    expect(formatDeclaredAt("2026-07-30T09:00:00.000Z", "en-GB")).toBe(
      "30 Jul 2026",
    );
  });

  it("is pinned to UTC, so the day can't shift by the viewer's timezone", () => {
    // Without timeZone: "UTC" this renders "29 Jul" west of UTC-9 — a
    // compliance record showing a different day than it holds.
    expect(formatDeclaredAt("2026-07-30T01:00:00.000Z", "en-GB")).toBe(
      "30 Jul 2026",
    );
    expect(formatDeclaredAt("2026-07-30T23:30:00.000Z", "en-GB")).toBe(
      "30 Jul 2026",
    );
  });

  it("returns empty string on an unparseable date instead of 'Invalid Date'", () => {
    expect(formatDeclaredAt("not-a-date")).toBe("");
    expect(formatDeclaredAt("")).toBe("");
  });
});

/**
 * ── ⚠️★★THE NOTICE TEXT IS NO LONGER KEYED HERE, AND THAT IS THE FIX ──────
 *
 * Three describes used to live here proving a `Record<version, string>`
 * lookup: that we held wording for the version the api stamps, that an unknown
 * version returned `undefined`, and that the wording was LinkedIn's verbatim.
 *
 * They were good tests of a bad arrangement. The map was a SECOND COPY of a
 * string the api owns, and keeping two repos in step across two deploys is
 * what made an ordinary notice bump an outage: api first and the card had no
 * wording to show, client first and it sent a shape the api rejected. The
 * file's own note called it *"a DEPLOY problem, not a network one"* — correct,
 * and treated as unavoidable.
 *
 * It was avoidable. `currentNoticeText` now travels with `currentNoticeVersion`.
 *
 * ★WHAT SURVIVES IS THE REFUSAL, which was always the valuable half: a surface
 * that cannot show the wording it is about to stamp must not collect consent.
 * That property is now tested against the SERVED text rather than a local map,
 * so it still fires on a broken response and no longer fires on a release.
 */
describe("★★the refusal survives the map's deletion", () => {
  it("refuses to collect consent when the api served no wording", () => {
    // The case the local map used to catch as `unsupported_notice`. It can now
    // only mean a broken or ancient response — but the answer is the same, and
    // it must stay the same: never ask someone to confirm text we cannot show.
    expect(
      declarationState({
        currentNoticeVersion: CURRENT,
        currentNoticeText: undefined,
      }),
    ).toEqual({ kind: "unknown", reason: "unsupported_notice" });
  });

  it("refuses on an EMPTY served wording too, not just a missing key", () => {
    // `""` is falsy and would render as a blank consent box with a Save button
    // beside it — worse than refusing, because it looks like a form.
    expect(
      declarationState({
        currentNoticeVersion: CURRENT,
        currentNoticeText: { notPolitical: "" },
      }),
    ).toEqual({
      kind: "unknown",
      reason: "unsupported_notice",
    });
  });

  it("★and on an OBJECT that carries only the affirmative wording", () => {
    // ⚠️The served shape is two strings, and this card collects one of them.
    // A response with only `political` is not a usable response HERE: the
    // checkbox would render with no sentence beside it. `currentNoticeText`
    // being truthy is not the question — the wording this surface is about to
    // stamp is.
    expect(
      declarationState({
        currentNoticeVersion: CURRENT,
        currentNoticeText: { political: "I confirm this IS political advertising…" },
      }),
    ).toEqual({
      kind: "unknown",
      reason: "unsupported_notice",
    });
  });

  it("★no longer refuses merely because the version is unfamiliar", () => {
    // ⚠️THE REGRESSION THIS FILE EXISTS TO PREVENT NOW. Under the old map a
    // version string we did not recognise took the feature down. With the
    // wording served, an unrecognised version is ordinary — it is simply the
    // current one — and the card must render normally.
    expect(
      declarationState({
        currentNoticeVersion:
          "ads-declaration-2027-04-something-nobody-has-seen",
        currentNoticeText: NOTICE,
      }),
    ).toEqual({ kind: "undeclared" });
  });

  it("still distinguishes a failed read from an unsupported notice", () => {
    // Different causes, different remedies: one offers "try again", the other
    // does not, because re-fetching returns the same broken response.
    expect(
      declarationState({
        currentNoticeVersion: CURRENT,
        currentNoticeText: NOTICE,
        failed: true,
      }),
    ).toEqual({ kind: "unknown", reason: "read_failed" });
    expect(declarationState({ currentNoticeText: NOTICE })).toEqual({
      kind: "unknown",
      reason: "read_failed",
    });
  });

  it("★a stored declaration is still compared against the VERSION, not the text", () => {
    // The version remains the identity of the form. Serving the wording did not
    // make it the comparison key — two versions could share wording (M-03's do,
    // deliberately: the form gained questions the paragraph does not mention),
    // so comparing text would silently accept a superseded declaration.
    expect(
      declarationState({
        declaration: {
          ...declaration,
          noticeVersion: "ads-declaration-2026-01",
        },
        currentNoticeVersion: CURRENT,
        currentNoticeText: NOTICE,
      }).kind,
    ).toBe("superseded");
  });
});

describe("the category question framing this surface still owns", () => {
  it("★asks a question, and says that ticking nothing answers it", () => {
    // Meta has no "not answered" value, so an empty submission is a positive
    // statement — the form must say so rather than letting it read as skipped.
    expect(SPECIAL_AD_CATEGORY_QUESTION).toMatch(/categories/i);
    expect(SPECIAL_AD_CATEGORY_NONE_NOTE).toMatch(/that is an answer/i);
  });

  it("★★holds no per-category labels — those are served", () => {
    // The half that WOULD drift. A local label map silently stops offering any
    // category the api adds, with no error anywhere; P-09 is five surfaces
    // that each derived the same copy locally and each got it wrong.
    const mod = adsCopy as Record<string, unknown>;
    for (const gone of [
      "SPECIAL_AD_CATEGORY_LABELS",
      "SPECIAL_AD_CATEGORY_ORDER",
      "SPECIAL_AD_CATEGORY_CONSEQUENCE",
      "POLITICAL_DECLARATION_NOTICES",
      "noticeTextFor",
      "LATEST_POLITICAL_DECLARATION_NOTICE",
    ]) {
      expect(
        mod[gone],
        `${gone} is back — it is a second copy of served data`,
      ).toBeUndefined();
    }
  });
});

describe("stampableNoticeText — the wording a surface is about to record", () => {
  // ⚠️★THIS EXISTS BECAUSE A PROPERTY ACCESS IN JSX IS UNTESTABLE HERE. The
  // repo has no component-test stack at all — no testing-library, no jsdom,
  // not one `.test.tsx` — so `{served.political}` beside a checkbox that
  // records NOT_POLITICAL would show the merchant a sentence they are not
  // agreeing to, and the suite would stay green. Mutating exactly that
  // survived every test on this branch until the choice became a function.

  it("★★picks the wording that matches the answer", () => {
    const served = { notPolitical: "NOT political.", political: "IS political." };
    expect(stampableNoticeText("NOT_POLITICAL", served)).toBe("NOT political.");
    expect(stampableNoticeText("POLITICAL", served)).toBe("IS political.");
  });

  it("★★never falls back to the other answer's wording", () => {
    // The one failure mode that matters. Showing the affirmative beside a
    // negative checkbox is not a degraded render — it is consent collected
    // against a sentence that says the opposite of what gets stored.
    expect(stampableNoticeText("NOT_POLITICAL", { political: "IS political." })).toBeUndefined();
    expect(stampableNoticeText("POLITICAL", { notPolitical: "NOT political." })).toBeUndefined();
  });

  it("★treats an empty string as no wording", () => {
    // `""` is falsy and would render as a blank consent box with a Save button
    // beside it — worse than showing nothing, because it looks like a form.
    expect(stampableNoticeText("NOT_POLITICAL", { notPolitical: "" })).toBeUndefined();
    expect(stampableNoticeText("NOT_POLITICAL", null)).toBeUndefined();
    expect(stampableNoticeText("NOT_POLITICAL", undefined)).toBeUndefined();
  });
});

describe("selectedCategories — untouched is not \"none of these apply\"", () => {
  // ⚠️★★THE ERASURE THIS FIXES WAS TWO CLICKS DEEP AND SILENT. The form
  // renders for a SUPERSEDED declaration too, the boxes started empty, and
  // submitting the re-confirm sent an explicit `[]` — which the api CANNOT
  // refuse, because its erasure guard fires on an omitted field and `[]` is a
  // real answer a real form can legitimately produce. A housing advertiser
  // became one who had declared that none of these apply, with a 200.

  it("★★seeds from the stored answer while the merchant has not touched it", () => {
    expect(selectedCategories(null, ["HOUSING", "CREDIT"])).toEqual(["HOUSING", "CREDIT"]);
  });

  it("★★an explicit empty selection wins over the stored answer", () => {
    // Because `[]` IS an answer: *"I was asked and none of these apply."*
    // Un-ticking everything must be able to mean that, or the merchant can
    // never retract a category they no longer run ads for.
    expect(selectedCategories([], ["HOUSING"])).toEqual([]);
  });

  it("★a touched selection is used as given", () => {
    expect(selectedCategories(["EMPLOYMENT"], ["HOUSING"])).toEqual(["EMPLOYMENT"]);
  });

  it("★no stored answer and no touch is an empty form, not an answer", () => {
    // The caller decides what to do with this: the card omits the field
    // entirely when the api served no options, so nothing is recorded on the
    // merchant's behalf by a form that never asked.
    expect(selectedCategories(null, undefined)).toEqual([]);
  });
});

/**
 * ── M-17: the country a declaration cannot be sent without ────────────────
 *
 * Everything below is pure on purpose. This repo has no component-test stack
 * — no testing-library, no jsdom, not one `.test.tsx` — so a rule that lives
 * in JSX is a rule nothing can check. `stampableNoticeText` exists for that
 * reason and these follow it: the card decides nothing it cannot be tested on.
 */

describe("parseCountryCodes", () => {
  it("★uppercases and de-duplicates, because the api's uniqueness check is on the NORMALISED value", () => {
    // `gb, GB` is one country typed twice. Sent as two, the api 400s on a
    // uniqueness refinement — an error that reads as a validation bug rather
    // than as the typo it is.
    expect(parseCountryCodes("gb, GB, ie")).toEqual({ codes: ["GB", "IE"], invalid: [] });
  });

  it("★★names what did not parse rather than dropping it", () => {
    // ⚠️Silently discarding "France" would record a NARROWER declaration than
    // the merchant wrote, on a field whose whole purpose is to say which
    // jurisdictions they advertise in — and tell them nothing.
    expect(parseCountryCodes("GB, France, IE")).toEqual({
      codes: ["GB", "IE"],
      invalid: ["France"],
    });
  });

  it("accepts commas, spaces or both, and ignores empty gaps", () => {
    expect(parseCountryCodes("GB IE").codes).toEqual(["GB", "IE"]);
    expect(parseCountryCodes("GB,,  IE,").codes).toEqual(["GB", "IE"]);
    expect(parseCountryCodes("").codes).toEqual([]);
    expect(parseCountryCodes("   ").invalid).toEqual([]);
  });

  it("★refuses the alpha-3 code and the country name — the two things people type", () => {
    expect(parseCountryCodes("FRA").codes).toEqual([]);
    expect(parseCountryCodes("FRA").invalid).toEqual(["FRA"]);
    expect(parseCountryCodes("F").invalid).toEqual(["F"]);
    expect(parseCountryCodes("1!").invalid).toEqual(["1!"]);
  });
});

describe("selectedCountries — and how it differs from selectedCategories", () => {
  it("★seeds from the stored answer while untouched", () => {
    // The form renders for a SUPERSEDED declaration too. A box that starts
    // empty here is worse than the category case: the api refuses an omitted
    // country list on a record that has one, so the re-confirm simply 400s.
    expect(selectedCountries(null, ["GB"])).toEqual(["GB"]);
  });

  it("★a touched selection is used as given", () => {
    expect(selectedCountries(["IE"], ["GB"])).toEqual(["IE"]);
  });

  it("★★an explicit empty list is NOT an answer here, unlike the categories", () => {
    // ⚠️THE INVERSION. `selectedCategories([], ["HOUSING"])` is `[]` and that
    // IS an answer — *"asked, none apply"*. There is no advertising in no
    // countries, so this one returns `[]` for the caller to BLOCK on rather
    // than to submit. `declarationBlockedBecause` is where that happens.
    expect(selectedCountries([], ["GB"])).toEqual([]);
  });
});

describe("★★euPoliticalAdsVerdict — three outcomes, not two", () => {
  const ban = {
    bannedCountries: ["FR", "DE"],
    uncertainCountries: ["NO", "IS", "LI"],
    since: "2025-10-06",
  };

  it("names the EU states as banned", () => {
    expect(euPoliticalAdsVerdict(["FR", "GB"], ban)).toEqual({
      banned: ["FR"],
      uncertain: [],
      known: true,
    });
  });

  it("★★EEA is UNCERTAIN, not banned — that is a reading, not Meta's word", () => {
    // ⚠️Meta says *"the EU and associated territories"* and publishes no list.
    // Calling Norway banned states our interpretation as Meta's; calling it
    // clear under-warns on a country Meta may well refuse.
    expect(euPoliticalAdsVerdict(["NO"], ban)).toEqual({
      banned: [],
      uncertain: ["NO"],
      known: true,
    });
  });

  it("★a country on neither list appears in NEITHER bucket", () => {
    // ⚠️It is NOT reported as cleared, and there is no third array saying so.
    // The caller has to render that as *"we have no reason to think so"*.
    expect(euPoliticalAdsVerdict(["US", "IN"], ban)).toEqual({
      banned: [],
      uncertain: [],
      known: true,
    });
  });

  it("★★`known: false` when the api served no lists — that is not 'nothing is banned'", () => {
    // ⚠️An api that predates M-17 serves no lists. Empty buckets would then
    // read identically to *"we checked and none are banned"*, which is the
    // all-clear an absence must never become. The flag is what lets the card
    // say *"we can't check these right now"* instead of saying nothing.
    expect(euPoliticalAdsVerdict(["FR"], undefined)).toEqual({
      banned: [],
      uncertain: [],
      known: false,
    });
    expect(euPoliticalAdsVerdict(["FR"], { since: "2025-10-06" }).known).toBe(false);
  });
});

describe("★★★declarationBlockedBecause — why the Save button is dead", () => {
  const text = { notPolitical: "no", political: "yes" };
  const base = {
    answer: "NOT_POLITICAL" as const,
    confirmed: true,
    countries: [] as string[],
    invalidCountries: [] as string[],
    noticeText: text,
  };

  it("nothing blocks a confirmed non-political answer", () => {
    expect(declarationBlockedBecause(base)).toBeNull();
  });

  it("no answer chosen", () => {
    expect(declarationBlockedBecause({ ...base, answer: null })).toBe("no_answer");
  });

  it("★the notice for the CHOSEN answer must exist, not just any notice", () => {
    // ⚠️A response carrying only the negative wording must not let a POLITICAL
    // declaration be stamped: the record would name a `noticeVersion` whose
    // served text asserts the opposite of what it stores.
    expect(
      declarationBlockedBecause({
        ...base,
        answer: "POLITICAL",
        countries: ["GB"],
        noticeText: { notPolitical: "no" },
      }),
    ).toBe("no_notice_text");
  });

  it("★★★a POLITICAL answer with no country is blocked", () => {
    // Meta gives ISSUES_ELECTIONS_POLITICS no tax-country default, so the api
    // refuses it. Letting the button fire would turn a form the merchant can
    // fix into a 400 they cannot.
    expect(declarationBlockedBecause({ ...base, answer: "POLITICAL" })).toBe(
      "country_missing",
    );
  });

  it("★★a NON-political answer is NOT blocked by a missing country", () => {
    // ⚠️The over-refusal this must not become. Meta defaults the tax country
    // for housing, employment and financial services, so demanding one here
    // would block a declaration that works.
    expect(declarationBlockedBecause(base)).toBeNull();
  });

  it("★an unparseable country blocks before the tick is even considered", () => {
    // ⚠️ORDER MATTERS: a merchant who ticks the notice and then finds the
    // button still dead has been told nothing. Naming the bad field while they
    // are still filling the form is the point of returning a reason at all.
    expect(
      declarationBlockedBecause({
        ...base,
        answer: "POLITICAL",
        confirmed: false,
        countries: ["GB"],
        invalidCountries: ["France"],
      }),
    ).toBe("country_invalid");
  });

  it("the notice still has to be confirmed", () => {
    expect(declarationBlockedBecause({ ...base, confirmed: false })).toBe(
      "not_confirmed",
    );
  });

  it("★a confirmed POLITICAL answer with a country is allowed, EU ban or not", () => {
    // ⚠️THE VERDICT DOES NOT BLOCK. A declaration is a legal statement and must
    // be recordable even where we already know the campaigns cannot run —
    // refusing to store *"I am a political advertiser in France"* would leave
    // the merchant unable to tell the truth. The card WARNS instead.
    expect(
      declarationBlockedBecause({
        ...base,
        answer: "POLITICAL",
        countries: ["FR"],
      }),
    ).toBeNull();
  });
});

describe("★★metaCategoryAnswerMissing", () => {
  const declared = (over = {}) => ({
    politicalIntent: "NOT_POLITICAL" as const,
    declaredAt: "2026-09-14T00:00:00.000Z",
    declaredByUserId: "u1",
    noticeVersion: "v1",
    ...over,
  });

  it("★★★true for a declaration that never answered the category question", () => {
    // ⚠️THE STATE THE WARNING EXISTS FOR. The boost dialog writes exactly this
    // record — political tick, no Meta categories — and every Meta create then
    // refuses while the card says *"automatic campaigns carry this
    // declaration"* directly above.
    expect(metaCategoryAnswerMissing(declared())).toBe(true);
  });

  it("★false once answered, INCLUDING with an empty list", () => {
    // `[]` is *"asked, none apply"* — a real answer, and the distinction the
    // whole field exists to preserve.
    expect(metaCategoryAnswerMissing(declared({ specialAdCategories: [] }))).toBe(false);
    expect(
      metaCategoryAnswerMissing(declared({ specialAdCategories: ["HOUSING"] })),
    ).toBe(false);
  });

  it("false when there is no declaration at all", () => {
    // Nothing to warn about: the card's undeclared branch already says so, and
    // a second warning there would be noise on a state that is not a problem.
    expect(metaCategoryAnswerMissing(undefined)).toBe(false);
    expect(metaCategoryAnswerMissing(null)).toBe(false);
  });

  it("false for NOT_DECLARED, which is not a declaration either", () => {
    expect(metaCategoryAnswerMissing(declared({ politicalIntent: "NOT_DECLARED" }))).toBe(
      false,
    );
  });
});

describe("★★★declarationSavedMessage — the toast was false for Meta", () => {
  it("★★does NOT claim automatic campaigns are covered when the category answer is missing", () => {
    // ⚠️THE DEFECT. The old toast said *"automatic campaigns can now declare on
    // your behalf"* unconditionally. For a record with no special-ad-category
    // answer that is true of LinkedIn and FALSE of Meta —
    // `resolveSpecialAdCategories` reports `never_declared` and every Meta
    // create refuses. The boost dialog writes exactly that record, so the
    // message has been wrong on that path since M-03.
    const msg = declarationSavedMessage("NOT_POLITICAL", false);
    expect(msg).not.toMatch(/automatic campaigns can now declare/i);
    expect(msg).toMatch(/LinkedIn/);
    expect(msg).toMatch(/special-ad-category/);
  });

  it("keeps the original message when the answer IS there", () => {
    expect(declarationSavedMessage("NOT_POLITICAL", true)).toMatch(
      /automatic campaigns can now declare/i,
    );
  });

  it("★★a POLITICAL declaration never gets an all-clear", () => {
    // *"Can now declare on your behalf"* reads as coverage on the one answer
    // that carries restrictions and refusals.
    const msg = declarationSavedMessage("POLITICAL", true);
    expect(msg).not.toMatch(/automatic campaigns can now declare/i);
    expect(msg).toMatch(/political category/i);
  });
});
