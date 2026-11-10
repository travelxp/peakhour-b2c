# CI guardrails

Three guards keep the performance and UX gains from regressing. The
workflow YAMLs are below, ready to copy. The agent that built these cannot
write under `.github/workflows`, so the owner copies `docs/ci/*.yml` (same as the blocks below) into
`.github/workflows/<name>.yml`.

## 1. Bundle budget

```
npm run build
npm run budget          # check
npm run budget:update   # regenerate docs/ci/bundle-baseline.json
```

Reads `.next/diagnostics/route-bundle-stats.json` (uncompressed first-load
JS per route). Fails when:

- the dashboard floor (sum of chunks present in at least 90% of /dashboard routes) exceeds 950KB, or the looser all-routes floor (chunks common to every route) exceeds 950KB,
- any `/dashboard` route exceeds 1600KB, unless it is listed in
  `dashboardAllowlist` in `bundle-budget.json` (11 routes were already over
  when the guard was added; each is still held by the growth check),
- any route (or the floor) grows more than 10% against
  `bundle-baseline.json`.

After peakhour-b2c#709 merges, refresh the baseline with `npm run budget:update`.
Run `budget:update` and commit the baseline when a size change is
intentional, and tighten or remove allowlist entries as routes get split.
Limits live in `bundle-budget.json`. Logic is in `scripts/lib/bundle-budget.mjs`
with unit tests (no build needed).

## 2. shadcnblocks drift

```
SHADCNBLOCKS_API_KEY=... npm run blocks:drift
```

Fetches the registry item for each file in `src/components/blocks`
(tries `name` then `<first-segment>-name`), normalises CRLF, whitespace,
`from "cn"` and the `shadcnblocks`/`diceui` import paths, and prints
identical / differs / allowlisted / local-only. Exits non-zero only on
`differs`. With no `SHADCNBLOCKS_API_KEY` (unset or blank, as an unset
GitHub secret arrives) it prints one `::notice::` annotation saying the
check was skipped and exits 0; the owner has chosen not to configure the
key, so the weekly workflow stays green. With a key it still fails on real
drift. Local-only blocks and intentional differences (each with a
reason) are in `scripts/shadcnblocks-drift.config.json`.

## 3. Accessibility smoke

```
npm ci
npx playwright install chromium
npm run build && npm start &
BASE_URL=http://localhost:3000 node scripts/a11y-smoke.mjs
```

`playwright` (1.64.1) and `@axe-core/playwright` (4.14.0) are now
devDependencies, so `npm ci` installs them; only the browser download is a
separate step. Checks `/`, `/pricing`, `/auth`, `/how-it-works`, `/shopify`,
`/contact` (override with `A11Y_ROUTES`) and fails on serious or critical
axe violations, and on horizontal overflow
(`scrollWidth > innerWidth`). Options: `A11Y_VIEWPORTS=375,1440` runs axe at
those widths (default 1280); `A11Y_SHOTS_DIR=a11y-shots` also writes
full-page screenshots at 375, 768, 1280 and 1920 (the folder is
gitignored). The dashboard needs a signed-in account and is not covered.

## Workflows

### bundle-budget.yml

```yaml
name: Bundle budget
on:
  pull_request:
jobs:
  budget:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 26
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run budget
```

If `next build` needs env vars in CI, copy them from the existing build job.

### blocks-drift.yml

```yaml
name: shadcnblocks drift
on:
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:
jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 26
          cache: npm
      - run: npm ci
      - run: npm run blocks:drift
        env:
          SHADCNBLOCKS_API_KEY: ${{ secrets.SHADCNBLOCKS_API_KEY }}
```

### a11y-smoke.yml

Enabled: the workflow lives at `.github/workflows/a11y-smoke.yml` (this folder keeps a reference copy). It runs `npx playwright install --with-deps chromium` after `npm ci`, builds, then starts the app and runs the smoke in ONE step, so the server is alive for the whole run and no unpinned `wait-on` is downloaded:

```yaml
      - name: Start the app and run the a11y smoke
        run: |
          npm start &
          for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3000 && break; sleep 2; done
          node scripts/a11y-smoke.mjs
        env:
          BASE_URL: http://localhost:3000
```
