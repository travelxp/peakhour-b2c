# `components/ui` is generated, not authored

Everything in this folder comes from a registry — shadcn/ui, `@shadcnblocks`,
or `@diceui` (see [`components.json`](../../../components.json)). Treat it as
regenerable: `npx shadcn@latest add card button chart` must be safe to run at
any time, overwrite every file here, and cost us nothing.

That only holds if we keep our own code out of it.

## The rules

**1. Don't hand-edit these files.** If a file here needs to change, the change
almost always belongs somewhere else — see below.

**2. Re-skinning happens in tokens.** `components.json` sets
`"cssVariables": true`, so every primitive already paints through
`bg-card`, `text-muted-foreground`, `border`, `--chart-1…5`, and friends.
The whole palette — light, dark, brand gold, status, chart series, elevation,
motion timing — lives in [`src/app/globals.css`](../../app/globals.css). Change
a value there and every primitive follows, with zero files in this folder
touched.

**3. New visual variants go in a wrapper, not in the primitive.** Compose
`<Card>` / `<Button>` inside a component under `components/dashboard/`,
`components/marketing/`, or `components/shared/` and pass `className`.
`className` + `cn()` is shadcn's designed extension point; using it is not a
workaround. Reach for editing `buttonVariants` only when a wrapper genuinely
cannot express the change.

**4. Motion is applied, not baked in.** The `u-rise`, `u-lift` and `u-rail`
primitives in `globals.css` are plain classes you put on a primitive via
`className`. They survive regeneration because they never live inside one.

**5. Our own components don't live here.** If it isn't in a registry, it goes
somewhere else. This is the rule that was being broken: `sparkline`,
`trend-chart`, `brand-icons`, `channel-icon`, `file-upload` and `content-ref`
all used to sit in this folder, which meant nobody could tell what was safe to
overwrite — so in practice nobody ever re-ran the CLI. They now live in
`components/viz/`, `components/brand/` and `components/shared/`.

## If you must patch a primitive

Sometimes upstream is genuinely wrong for us. When that happens, leave a
marker at the top of the file so the next regeneration is a deliberate merge
rather than a silent loss:

```tsx
/* LOCAL PATCH — <what changed> — <why> — <date>
   Re-apply after `shadcn add <name>`. */
```

Then `git grep "LOCAL PATCH" src/components/ui` lists everything that needs
re-applying after an update. Keep that list short.
