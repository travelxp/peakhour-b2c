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

- the shared floor (chunks common to every route) exceeds 950KB,
- any `/dashboard` route exceeds 1600KB, unless it is listed in
  `dashboardAllowlist` in `bundle-budget.json` (11 routes were already over
  when the guard was added; each is still held by the growth check),
- any route (or the floor) grows more than 10% against
  `bundle-baseline.json`.

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
`differs`. Local-only blocks and intentional differences (each with a
reason) are in `scripts/shadcnblocks-drift.config.json`.

## 3. Accessibility smoke

```
npm i -D playwright @axe-core/playwright && npx playwright install chromium
npm run build && npm start &
BASE_URL=http://localhost:3000 node scripts/a11y-smoke.mjs
```

Checks `/`, `/pricing`, `/auth` (override with `A11Y_ROUTES`) and fails on
serious or critical axe violations. Playwright is not a dependency yet
because of the browser download; the script exits 2 with the install line
if it is missing.

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

Requires the one-line install above to be committed to `package.json` first.

```yaml
name: A11y smoke
on:
  pull_request:
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 26
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm start &
      - run: npx wait-on http://localhost:3000
      - run: node scripts/a11y-smoke.mjs
        env:
          BASE_URL: http://localhost:3000
```
