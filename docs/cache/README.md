# `docs/cache/`

Cached snapshots of external catalogues that we want grep-able locally
without auth or live network round-trips.

## `shadcnblocks-registry.json`

Full block catalogue from [shadcnblocks.com](https://www.shadcnblocks.com)
(3,350+ items, ~1.6 MB pretty-printed JSON). Refreshed weekly by
[`.github/workflows/refresh-shadcnblocks-registry.yml`](../../.github/workflows/refresh-shadcnblocks-registry.yml);
the workflow opens a PR if anything changed.

### How to use

> Run all commands below from the repo root (`peakhour-b2c/`).

Grep by name / title / description:

```bash
node -e "
  const r = require('./docs/cache/shadcnblocks-registry.json');
  r.items
    .filter(i => /emoji|picker/i.test((i.title||'') + ' ' + (i.description||'')))
    .forEach(i => console.log(i.name + ' :: ' + i.title));
"
```

Install a discovered block:

```bash
npx shadcn@latest add @shadcnblocks/emoji-picker
```

### Refresh manually

```bash
npx tsx scripts/refresh-shadcnblocks-registry.ts
```

Requires `SHADCNBLOCKS_API_KEY` in `.env` (same key as `components.json`).

The script refuses to write if the upstream response looks suspicious
(under 1,000 items, or >25% shrinkage vs the cached payload). Pass
`--force` after investigating if the refusal is a false positive.

## Setup (one-time per environment)

**GitHub Actions:** the weekly refresh workflow reads
`secrets.SHADCNBLOCKS_API_KEY` — add it as a repository secret under
*Settings → Secrets and variables → Actions* before the first scheduled
run. The first run after merge will silently no-op (script exits 1) if
the secret is missing.

**Local dev:** put `SHADCNBLOCKS_API_KEY=sk_live_…` in `.env` (gitignored).
The key is shared across our shadcnblocks-enabled repos — same value
as in [`components.json`](../../components.json)'s registry header.
