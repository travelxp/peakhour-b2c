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
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REGISTRY_URL = "https://shadcnblocks.com/r/registry.json";
const OUTPUT_PATH = resolve(process.cwd(), "docs/cache/shadcnblocks-registry.json");

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
  // Pretty-print so git diffs are reviewable (size delta is minor: ~1.2 MB
  // → ~2.0 MB. Worth it — a 3000-block catalogue with no whitespace is
  // unreadable in a PR.)
  const payload = JSON.stringify(json, null, 2);

  writeFileSync(OUTPUT_PATH, payload);
  console.log(`Wrote ${OUTPUT_PATH} (${payload.length.toLocaleString()} bytes, ${itemCount} items).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
