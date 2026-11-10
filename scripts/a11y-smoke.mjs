// Accessibility smoke test: loads public routes against a running server and
// fails on serious/critical axe violations.
//
// Usage: BASE_URL=http://localhost:3000 node scripts/a11y-smoke.mjs
// Optional: A11Y_ROUTES=/,/pricing,/auth to override the route list.
//
// Needs (not in package.json on purpose - heavy, browser download):
//   npm i -D playwright @axe-core/playwright && npx playwright install chromium
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const routes = (process.env.A11Y_ROUTES ?? "/,/pricing,/auth").split(",").map((r) => r.trim()).filter(Boolean);
const FAIL_ON = new Set(["serious", "critical"]);

let chromium, AxeBuilder;
try {
  ({ chromium } = await import("playwright"));
  ({ default: AxeBuilder } = await import("@axe-core/playwright"));
} catch {
  console.error(
    "playwright / @axe-core/playwright not installed. Run:\n" +
      "  npm i -D playwright @axe-core/playwright && npx playwright install chromium",
  );
  process.exit(2);
}

const browser = await chromium.launch();
let failed = 0;
try {
  for (const route of routes) {
    const page = await browser.newPage();
    const res = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
    if (!res || !res.ok()) {
      console.error(`FAIL ${route}: HTTP ${res?.status() ?? "no response"}`);
      failed++;
      await page.close();
      continue;
    }
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const bad = violations.filter((v) => FAIL_ON.has(v.impact ?? ""));
    if (bad.length) {
      failed++;
      console.error(`FAIL ${route}: ${bad.length} serious/critical violation(s)`);
      for (const v of bad) console.error(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s)) ${v.helpUrl}`);
    } else {
      console.log(`ok   ${route} (${violations.length} minor/moderate)`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
