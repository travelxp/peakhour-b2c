import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * Retired destination names. #713 renamed the dashboard destinations (the
 * source of truth is src/lib/nav-copy.ts). A merchant-visible string must not
 * call a page or feature by the name it used to have: read the current label
 * with `navLabel()` / `navCopy()` or type the new one.
 *
 * Read from the TypeScript AST (string, template and JSX text pieces), same
 * as type-floor.test.ts, so a comment that explains the rule is not mistaken
 * for a use of it. Scope: src/app/(site)/dashboard and src/components.
 * Route paths, import specifiers, identifiers and analytics keys never match:
 * path-like and hyphenated tokens are dropped before matching, and a string
 * that is a single lowercase word (a key) is skipped.
 */
const ROOT = resolve(__dirname, "..", "..");
const SCOPES = [join(ROOT, "src", "app", "(site)", "dashboard"), join(ROOT, "src", "components")];

/** Retired name -> pattern. The common words are case-sensitive Title Case so
 *  "task" or a lower-case "insights" in ordinary prose is not flagged. */
export const RETIRED: Record<string, RegExp> = {
  Ledger: /\bledger\b/i, // now "Results"
  Strategist: /\bstrategist\b/i, // now "Content plan"
  "News Desk": /\bnews desk\b/i, // now "Industry news"
  "Command Center": /\bcommand cent(?:er|re)\b/i, // now "Store overview"
  "Win back carts": /\bwin back carts\b/i, // now "Abandoned carts"
  "Knowledge base": /\bknowledge base\b/i, // now "Assistant answers"
  "Trusted Sources": /\btrusted sources?\b/i, // now "Content sources"
  "Seasonal Events": /\bseasonal events?\b/i, // now "Holidays & events"
  "Content Pipeline": /\bcontent pipeline\b/i,
  "My Tickets": /\bmy tickets\b/i, // now "Support tickets"
  Integrations: /\bIntegrations\b/, // now "Connected accounts"
  Tasks: /\bTasks\b/, // now "Activity"
  Insights: /\bInsights\b(?! Network)/, // now "Reports" (the Reports pillar only); "Insights Network" is another feature
};

/**
 * Files where a match is legitimate, each with the names it may carry and the
 * reason. Add an entry only with a reason a reviewer can check.
 */
export const ALLOWED: Record<string, { names: string[]; why: string }> = {
  "src/components/molecules/command-menu-dialog.tsx": {
    names: ["Strategist", "Integrations"],
    why: "legacy fallback labels; at runtime the nav-copy label replaces them and the old name stays searchable as an alias",
  },
  "src/components/dev/cron-metadata.ts": {
    names: ["News Desk", "Trusted Sources"],
    why: "internal /cms cron descriptions for operators, not merchant-visible",
  },
  "src/components/commerce/command-center.tsx": {
    names: ["Command Center"],
    why: "'Commerce Command Center' is the plan feature name on the upgrade gate (owner decision pending)",
  },
  "src/components/support/contact-support-dialog.tsx": {
    names: ["Integrations"],
    why: "a support topic (problems with integrations), not the page name",
  },
  "src/components/blocks/settings-integrations9.tsx": {
    names: ["Integrations"],
    why: "generic UI block (an unused template), not the Connected accounts page",
  },
  "src/components/control-plane/activity-ledger.tsx": {
    names: ["Ledger"],
    why: "the WhatsApp settings activity feed, a different feature from the Results page",
  },
  "src/components/growth-v2/learning-screen.tsx": {
    names: ["Ledger"],
    why: "'Experiment ledger' is a card title in What's working, not the Results page",
  },
  "src/components/inbox/insights-pane.tsx": { names: ["Insights"], why: "Inbox insights, not the Reports pillar" },
  "src/components/inbox/team-desk-card.tsx": { names: ["Insights"], why: "Inbox insights, not the Reports pillar" },
  "src/components/commerce/knowledge-base.tsx": {
    names: ["Insights"],
    why: "the link goes to Inbox insights (/dashboard/inbox?tab=insights)",
  },
  "src/app/(site)/dashboard/inbox/page.tsx": { names: ["Insights"], why: "the Inbox Insights tab" },
  "src/app/(site)/dashboard/content/sources/page.tsx": {
    names: ["Insights"],
    why: "the Insights tab of the content-sources citation stats, not the Reports pillar",
  },
  "src/app/(site)/dashboard/content/sources/components/insights-panel.tsx": {
    names: ["Insights"],
    why: "the same sources Insights tab",
  },
};

const PATHLIKE = /\S*[/@_]\S*|[A-Za-z]+(?:-[A-Za-z]+)+/g;

/** Retired names found in one piece of string / JSX text. */
export function retiredIn(text: string): string[] {
  if (/^[a-z]+$/.test(text)) return []; // a lowercase key, not copy
  const prose = text.replace(PATHLIKE, " ");
  return Object.entries(RETIRED)
    .filter(([, re]) => re.test(prose))
    .map(([name]) => name);
}

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
      out.push(n.text);
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

describe("retired destination names", () => {
  it("the patterns flag retired names and not paths, keys or other features", () => {
    expect(retiredIn("We couldn't load your ledger")).toEqual(["Ledger"]);
    expect(retiredIn("Ledger")).toEqual(["Ledger"]);
    expect(retiredIn("See it in Integrations")).toEqual(["Integrations"]);
    expect(retiredIn("Open the News Desk or Strategist")).toEqual(["Strategist", "News Desk"]);
    expect(retiredIn("Add trusted sources")).toEqual(["Trusted Sources"]);
    expect(retiredIn("Failed to load seasonal events")).toEqual(["Seasonal Events"]);
    expect(retiredIn("/dashboard/strategist/abc")).toEqual([]);
    expect(retiredIn("@/lib/content-ledger")).toEqual([]);
    expect(retiredIn("ledger")).toEqual([]);
    expect(retiredIn("win-back")).toEqual([]);
    expect(retiredIn("Results, Content plan, Connected accounts, Activity, Reports")).toEqual([]);
    expect(retiredIn("a task finished")).toEqual([]);
  });

  it("no merchant-visible string in the dashboard or components uses a retired name", () => {
    const hits: string[] = [];
    for (const file of SCOPES.flatMap(sourceFiles)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      const allowed = ALLOWED[rel]?.names ?? [];
      for (const t of texts(file, readFileSync(file, "utf8"))) {
        for (const name of retiredIn(t)) {
          if (!allowed.includes(name)) hits.push(`${rel}: ${name} in "${t.replace(/\s+/g, " ").slice(0, 80)}"`);
        }
      }
    }
    expect(hits, "use the current label from src/lib/nav-copy.ts (navLabel), or add a reasoned ALLOWED entry").toEqual([]);
  });

  it("every ALLOWED entry still matches something, so the list cannot rot", () => {
    for (const [rel, { names }] of Object.entries(ALLOWED)) {
      const found = new Set(texts(rel, readFileSync(join(ROOT, rel), "utf8")).flatMap(retiredIn));
      for (const n of names) expect(found.has(n), `${rel} no longer uses "${n}"; drop it from ALLOWED`).toBe(true);
    }
  });
});
