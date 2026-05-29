# `docs/cache/`

Cached snapshots of external catalogues that we want grep-able locally
without auth or live network round-trips.

## `shadcnblocks-registry.json`

Full block catalogue from [shadcnblocks.com](https://www.shadcnblocks.com)
(3,350+ items, ~2 MB pretty-printed JSON). Refreshed weekly by
[`.github/workflows/refresh-shadcnblocks-registry.yml`](../../.github/workflows/refresh-shadcnblocks-registry.yml);
the workflow opens a PR if anything changed.

### How to use

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
