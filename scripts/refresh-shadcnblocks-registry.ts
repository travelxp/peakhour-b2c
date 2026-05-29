/**
 * Refreshes the local shadcnblocks registry catalogue at
 * `docs/cache/shadcnblocks-registry.json`.
 *
 * Why a local cache: the shadcnblocks registry has 3,350+ items
 * (~1.2 MB). The shadcn CLI doesn't expose a search subcommand, and
 * one-off `curl` calls in our session shell don't survive across
 * conversations. Committing the JSON lets anyone (or any agent) grep
 * the catalogue instantly without auth and without remembering the
 * endpoint.
 *
 * Run manually: `npx tsx scripts/refresh-shadcnblocks-registry.ts`
 * Run automatically: `.github/workflows/refresh-shadcnblocks-registry.yml`
 *   (weekly Monday 06:00 UTC; opens a PR only if the catalogue changed).
 *
 * Auth: requires SHADCNBLOCKS_API_KEY in .env or the environment.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REGISTRY_URL = "https://shadcnblocks.com/r/registry.json";
// Resolve relative to THIS file, not process.cwd() — so the script
// produces consistent output whether invoked from the repo root,
// scripts/, or any subdir.
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "..", "docs/cache/shadcnblocks-registry.json");

// Guard against silent cache destruction. If the upstream registry
// regresses (wipe, schema change, network corruption) and we write the
// degraded payload, the next time anyone greps the cache they'll get a
// false "block doesn't exist" answer. Refuse to write if the response
// looks suspicious; ops can re-run with --force after investigating.
const MIN_ITEMS = 1000;          // floor — registry has had >3000 since 2024
const MAX_SHRINK_RATIO = 0.25;   // refuse if new payload has <75% of existing items

async function main() {
  const apiKey = process.env.SHADCNBLOCKS_API_KEY;
  if (!apiKey) {
    console.error("SHADCNBLOCKS_API_KEY missing — set it in .env or the environment");
    process.exit(1);
  }

  console.log(`Fetching ${REGISTRY_URL}…`);
  const res = await fetch(REGISTRY_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
    redirect: "follow",
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const json = (await res.json()) as { items?: { name: string }[] };
  const itemCount = Array.isArray(json.items) ? json.items.length : 0;
  const force = process.argv.includes("--force");

  // Floor check — refuses to write a degraded payload (empty / missing
  // items / dramatically smaller than the current cache). `--force`
  // bypasses for ops who have investigated and want the new payload
  // anyway.
  if (itemCount < MIN_ITEMS && !force) {
    console.error(
      `Refusing to write: only ${itemCount} items in upstream response (floor=${MIN_ITEMS}). ` +
        `Re-run with --force if this is intentional.`,
    );
    process.exit(1);
  }
  if (existsSync(OUTPUT_PATH) && !force) {
    const prev = JSON.parse(readFileSync(OUTPUT_PATH, "utf8")) as { items?: unknown[] };
    const prevCount = Array.isArray(prev.items) ? prev.items.length : 0;
    if (prevCount > 0 && itemCount < prevCount * (1 - MAX_SHRINK_RATIO)) {
      console.error(
        `Refusing to write: upstream items (${itemCount}) is more than ` +
          `${Math.round(MAX_SHRINK_RATIO * 100)}% smaller than cached (${prevCount}). ` +
          `Re-run with --force if this is intentional.`,
      );
      process.exit(1);
    }
  }

  // Pretty-print so git diffs are reviewable. Trailing newline so the
  // file is POSIX-clean and editor auto-newline doesn't cause spurious
  // diffs on the next refresh.
  const payload = JSON.stringify(json, null, 2) + "\n";

  writeFileSync(OUTPUT_PATH, payload);
  console.log(`Wrote ${OUTPUT_PATH} (${payload.length.toLocaleString()} bytes, ${itemCount} items).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
