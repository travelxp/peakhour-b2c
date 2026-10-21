import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { EVERY_BUSINESS_TRIAL_PROMISE } from "./trial-copy";

/**
 * Owner, 2026-10-21: starter and growth are not plans, and D19 says there is
 * no free tier. The scheduler composer told a buyer auto-approve was "on
 * Growth+ plans". Which plan carries a feature is the catalog's to say, so no
 * copy in b2c names a Starter, Growth or Free plan.
 *
 * ★ALL OF src/ AND messages/*.json (review R1, R2): the next occurrence
 * would otherwise land outside the guarded folder, or in the i18n strings.
 *
 * ★READ FROM THE TYPESCRIPT AST: every string, template piece and JSX text
 * run. A regex lexer desyncs on a backtick inside a comment and then skips
 * the very literal it should catch (a first cut of this test did). Comments
 * are not copy and are not read.
 *
 * ★A PLAN NAME, NOT THE WORD, IN ANY CASE (review R2). It matches "Growth+",
 * "Growth Plan", "growth tier", "Starter and Growth plans", "your free plan",
 * "on the Starter", "on Free" at the end of a run. Growth the pillar ("the
 * Growth tab") and free the word ("free shipping", "Start free") carry no
 * plan/tier suffix and pass. The terms page's legal "We may offer free
 * tiers" is the one allowlisted text, by file and by words.
 *
 * ⚠️NOT SEEN: a name split across JSX nodes (`on the <b>Starter</b> plan`),
 * where each node is read alone.
 */
const ROOT = resolve(__dirname, "..", "..");
const SRC = join(ROOT, "src");
const RETIRED =
  /\b(?:starter|growth|free)\s*\+|\b(?:starter|growth|free)(?:\s+(?:and|or|\/)\s+(?:starter|growth|free))*\s+(?:plan|tier)s?\b|\bon\s+(?:the\s+)?starter\b|\bon\s+free\s*(?:[.,;:)!—–-]|$)/i;
/** Legal copy about tiers in general, not a plan name: file → the words allowed. */
const ALLOWED: Record<string, RegExp> = {
  "src/app/(site)/terms/page.tsx": /^We may offer free tiers, trials, or promotional pricing at our discretion\./,
};
/** A cheap prefilter: a file that never says one of the words cannot match. */
const MAY_MATCH = /starter|growth|free/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

function texts(file: string, src: string): string[] {
  const out: string[] = [];
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const walk = (n: ts.Node) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      out.push(n.text.trim());
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

const jsonStrings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(jsonStrings) : [];

const offending = (file: string, t: string) => RETIRED.test(t) && !ALLOWED[file]?.test(t);

describe("no b2c copy names a retired plan", () => {
  it("the pattern catches the plan names in each form and case", () => {
    for (const bad of [
      "on Growth+ plans",
      "growth+ plans",
      "the Starter plan",
      "Upgrade to the Growth Plan",
      "Starter Tier",
      "GROWTH tier",
      "Upgrade from your free plan",
      "Included on the free tier",
      "Starter and Growth plans only",
      "on the\n          Starter",
      "Schedule one at a time on Free.",
      "You're on Free",
    ]) {
      expect(RETIRED.test(bad), bad).toBe(true);
    }
  });

  it("PASS: the pattern leaves pillar and ordinary uses alone", () => {
    for (const ok of ["Posts on the Growth tab", "on Growth campaigns", "free shipping", "Start free", "Growth", "a free task", "free for 14 days"]) {
      expect(RETIRED.test(ok), ok).toBe(false);
    }
  });

  it("the allowlist is the terms page's legal sentence only", () => {
    const terms = "src/app/(site)/terms/page.tsx";
    expect(offending(terms, "We may offer free tiers, trials, or promotional pricing at our discretion. These may change.")).toBe(false);
    expect(offending(terms, "Upgrade from your free plan")).toBe(true);
    expect(offending("src/app/(site)/pricing/page.tsx", "We may offer free tiers, trials, or promotional pricing at our discretion.")).toBe(true);
  });

  it("the extractor sees a literal in each form (string, template, JSX text)", () => {
    const found = texts("x.tsx", "const a = 'on Growth+ plans'; const b = `x ${a} Free plan`; const c = <p>the Starter plan</p>;");
    expect(found.filter((t) => RETIRED.test(t))).toHaveLength(3);
  });

  it("★no i18n message names a Starter, Growth or Free plan", () => {
    const dir = join(ROOT, "messages");
    const hits = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => jsonStrings(JSON.parse(readFileSync(join(dir, f), "utf8"))).filter((t) => RETIRED.test(t)).map((t) => `messages/${f}: ${t}`));
    expect(hits).toEqual([]);
  });

  // ★A tree walk: worktrees with a junctioned node_modules run it slowly.
  it(
    "★no source file under src/ names a Starter, Growth or Free plan",
    () => {
      const files = sourceFiles(SRC);
      expect(files.length).toBeGreaterThan(100);
      const hits = files.flatMap((f) => {
        const src = readFileSync(f, "utf8");
        if (!MAY_MATCH.test(src)) return [];
        const rel = relative(ROOT, f).replace(/\\/g, "/");
        return texts(f, src)
          .filter((t) => offending(rel, t))
          .map((t) => `${rel}: ${JSON.stringify(t.slice(0, 100))}`);
      });
      expect(hits).toEqual([]);
    },
    120_000,
  );
});

/**
 * ★ONE TRIAL PER PERSON (billing plan P3.1d; D19): the Suite trial is a new
 * account's FIRST business's, once per person; an added business, or a later
 * account of the same person, pays first. So no copy promises a trial to
 * "every business" or "every new business". Read with the extractor above
 * (strings, template pieces and JSX text; comments are not copy).
 */

/**
 * ★A SENTENCE IS ITS WHOLE TEMPLATE OR ITS WHOLE JSX ELEMENT (review R2). The
 * extractor above reads each template piece and each JSX text run alone, so
 * `Every new business starts on a ${trialDays}-day … trial` reads as two
 * pieces, neither of which is the promise. Here a template literal is joined
 * with `N` for each placeholder, and an element's text children with `N` for
 * each expression, and those joined sentences are read too.
 */
/** An element's text, its nested elements' included, an expression as `N`. */
function jsxSentence(n: ts.JsxElement | ts.JsxFragment): string {
  return n.children
    .map((ch) =>
      ts.isJsxText(ch) ? ch.text : ts.isJsxExpression(ch) ? "N" : ts.isJsxElement(ch) || ts.isJsxFragment(ch) ? jsxSentence(ch) : "",
    )
    .join("");
}

function joinedTexts(file: string, src: string): string[] {
  const out: string[] = [];
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const walk = (n: ts.Node) => {
    if (ts.isTemplateExpression(n)) {
      out.push((n.head.text + n.templateSpans.map((s) => "N" + s.literal.text).join("")).trim());
    } else if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      // ★Inline markup joins too (review R3): `<p>Every business starts on a
      //  <strong>14-day</strong> free trial</p>` is one sentence.
      const text = jsxSentence(n).replace(/\s+/g, " ").trim();
      if (text) out.push(text);
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

describe("no b2c copy promises every business a trial (P3.1d)", () => {
  it("the pattern catches the promise and leaves other uses of the words alone", () => {
    for (const bad of [
      " Every business starts with a free 14-day trial of all of it.",
      "Every new business starts on a 14-day Peakhour Suite trial",
      "every business gets a trial",
      // ★Other spellings of the one promise (review R1).
      "Each business gets a free 14-day trial",
      "Every new account starts on a trial",
      "Every business you add starts free",
      "Any new account begins with 14 free days",
      // ★More spellings (review R2).
      "Every business is free for 14 days",
      "Each new business comes with a 14-day trial",
      "Every new business includes a free trial",
      "Every new store starts on a trial",
      "every workspace gets a trial",
      // ★And these (review R3).
      "All businesses get trials",
      "All your businesses start on a trial",
    ]) {
      expect(EVERY_BUSINESS_TRIAL_PROMISE.test(bad), bad).toBe(true);
    }
    for (const ok of [
      "Your first business starts with a free 14-day trial",
      "Agency covers every business you run",
      "every business-critical alert",
      "Run every business from one login. Start today.",
      // The two real sentences a trial-less first cut caught (review R1).
      "every account gets set up properly",
      "Each business gets its own content library, calendar, audiences, connected channels and reporting.",
      // ★One clause only (review R2): a later "free" is another promise.
      "Every business gets one Peaks wallet, and you can start free",
      "Each account gets its own inbox; start free today",
      // ★A denial is not the promise (review R3).
      "Every business is billed from day one with no free tier",
    ]) {
      expect(EVERY_BUSINESS_TRIAL_PROMISE.test(ok), ok).toBe(false);
    }
  });

  it("★the joined extractor reads a template and a JSX element as one sentence each (review R2)", () => {
    const src =
      "const a = `Every new business starts on a ${d}-day Peakhour Suite trial`; const b = <p>Every business starts on a {d}-day trial</p>;" +
      " const c = <p>Each business starts on a <strong>14-day</strong> free trial</p>;";
    // The piecewise extractor cannot see either promise ...
    expect(texts("x.tsx", src).some((t) => EVERY_BUSINESS_TRIAL_PROMISE.test(t))).toBe(false);
    // ... and the joined one sees both.
    expect(joinedTexts("x.tsx", src).filter((t) => EVERY_BUSINESS_TRIAL_PROMISE.test(t))).toEqual([
      "Every new business starts on a N-day Peakhour Suite trial",
      "Every business starts on a N-day trial",
      "Each business starts on a 14-day free trial",
    ]);
  });

  // ★AND THE i18n STRINGS (review R1), as the retired-plan scan reads them.
  it("★no i18n message says every business starts on a trial", () => {
    const dir = join(ROOT, "messages");
    const hits = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) =>
        jsonStrings(JSON.parse(readFileSync(join(dir, f), "utf8")))
          .filter((t) => EVERY_BUSINESS_TRIAL_PROMISE.test(t))
          .map((t) => `messages/${f}: ${t}`),
      );
    expect(hits).toEqual([]);
  });

  // ★A tree walk: worktrees with a junctioned node_modules run it slowly.
  it(
    "★no source file under src/ says every business starts on a trial",
    () => {
      const files = sourceFiles(SRC);
      expect(files.length).toBeGreaterThan(100);
      const hits = files.flatMap((f) => {
        const src = readFileSync(f, "utf8");
        // A cheap prefilter on a word the pattern requires (review R2: its
        // first words are in nearly every file).
        if (!/trial|free/i.test(src)) return [];
        const rel = relative(ROOT, f).replace(/\\/g, "/");
        return [...texts(f, src), ...joinedTexts(f, src)]
          .filter((t) => EVERY_BUSINESS_TRIAL_PROMISE.test(t))
          .map((t) => `${rel}: ${JSON.stringify(t.slice(0, 100))}`);
      });
      expect(hits).toEqual([]);
    },
    120_000,
  );
});
