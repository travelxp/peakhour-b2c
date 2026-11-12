// Accessibility smoke test: loads public routes against a running server and
// fails on serious/critical axe violations.
//
// Usage: BASE_URL=http://localhost:3000 node scripts/a11y-smoke.mjs
// Optional env:
//   A11Y_ROUTES=/,/pricing,/auth   override the route list
//   A11Y_VIEWPORTS=375,1440        widths (px) to run axe at (default 1280)
//   A11Y_SHOTS_DIR=a11y-shots      also screenshot each route at 375,768,1280,1920
//                                  into that folder (gitignored)
// Every run also reports horizontal overflow per route and viewport
// (documentElement.scrollWidth > innerWidth); overflow fails the run.
//
// Needs: playwright and @axe-core/playwright (devDependencies) and
//   npx playwright install chromium
import { mkdirSync } from "node:fs";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const routes = (process.env.A11Y_ROUTES ?? "/,/pricing,/auth,/how-it-works,/shopify,/contact")
  .split(",").map((r) => r.trim()).filter(Boolean);
const widths = (process.env.A11Y_VIEWPORTS ?? "1280").split(",").map((w) => Number(w.trim())).filter(Boolean);
const shotsDir = process.env.A11Y_SHOTS_DIR;
const SHOT_WIDTHS = [375, 768, 1280, 1920];
const FAIL_ON = new Set(["serious", "critical"]);

let chromium, AxeBuilder;
try {
  ({ chromium } = await import("playwright"));
  ({ default: AxeBuilder } = await import("@axe-core/playwright"));
} catch {
  console.error("playwright / @axe-core/playwright not installed. Run:\n  npm ci && npx playwright install chromium");
  process.exit(2);
}

// Elements whose box crosses the right edge of the viewport (excluding
// anything inside an overflow-clipping ancestor, which cannot cause scroll).
const overflowProbe = () => {
  const vw = window.innerWidth;
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o !== "visible") return true;
    }
    return false;
  };
  const offenders = [];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 && !clipped(el) && getComputedStyle(el).position !== "fixed") {
      offenders.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : ""} right=${Math.round(r.right)}`);
      if (offenders.length >= 5) break;
    }
  }
  return { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, offenders };
};

const slug = (r) => (r === "/" ? "home" : r.replace(/^\//, "").replace(/\W+/g, "-"));
const browser = await chromium.launch();
let failed = 0;
try {
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });
  const all = [...new Set([...widths, ...(shotsDir ? SHOT_WIDTHS : [])])];
  for (const route of routes) {
    for (const width of all) {
      // axe needs a page created from an explicit context (browser.newPage is refused).
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const res = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
      if (!res || !res.ok()) {
        console.error(`FAIL ${route}@${width}: HTTP ${res?.status() ?? "no response"}`);
        failed++;
        await context.close();
        continue;
      }
      const o = await page.evaluate(overflowProbe);
      if (o.scrollWidth > o.innerWidth) {
        failed++;
        console.error(`FAIL ${route}@${width}: horizontal overflow scrollWidth=${o.scrollWidth} > ${o.innerWidth}; ${o.offenders.join("; ")}`);
      }
      if (shotsDir) await page.screenshot({ path: `${shotsDir}/${slug(route)}-${width}.png`, fullPage: true });
      if (widths.includes(width)) {
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        const bad = violations.filter((v) => FAIL_ON.has(v.impact ?? ""));
        if (bad.length) {
          failed++;
          console.error(`FAIL ${route}@${width}: ${bad.length} serious/critical violation(s)`);
          for (const v of bad) {
            console.error(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s)) ${v.helpUrl}`);
            for (const n of v.nodes.slice(0, 3)) console.error(`    ${n.target.join(" ")}`);
          }
        } else {
          console.log(`ok   ${route}@${width} (${violations.length} minor/moderate)`);
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
