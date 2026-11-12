/**
 * Compares every file in src/components/blocks with its shadcnblocks registry
 * item and reports identical / differs / local-only / allowlisted.
 * Exit code is non-zero only when a block `differs` and is not allowlisted.
 * With no key configured it prints one `::notice::` line and exits 0 (skipped).
 *
 * Run: `npm run blocks:drift` (needs SHADCNBLOCKS_API_KEY in the environment
 * or .env; the key is read from process.env only and never printed).
 *
 * Registry names are sometimes prefixed with their first segment
 * (stepper-onboarding-1 -> stepper-stepper-onboarding-1), so both spellings
 * are tried. Blocks with no registry item live in scripts/shadcnblocks-drift.config.json.
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

export type DriftConfig = {
  localOnly: Record<string, string>;
  allowlist: Record<string, string>;
};
export type Status = "identical" | "differs" | "local-only" | "allowlisted" | "not-found";

const REGISTRY_BASE = "https://www.shadcnblocks.com/r/";

/** Normalise source so cosmetic differences between the registry and our tree do not count as drift. */
export function normalise(src: string): string {
  return (
    src
      .replace(/\r\n?/g, "\n")
      .replace(/from\s+(["'])cn\1/g, 'from "@/lib/utils"')
      .replace(/@\/components\/(?:shadcnblocks|diceui)\//g, "@/components/blocks/")
      .split("\n")
      .map((l) => l.replace(/[ \t]+$/, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

/** Registry names to try for a local block file name (no extension). */
export function candidateNames(name: string): string[] {
  const prefix = name.split("-")[0];
  return [name, `${prefix}-${name}`];
}

export function classify(
  name: string,
  local: string,
  remote: string | null,
  config: DriftConfig,
): Status {
  if (name in config.localOnly) return "local-only";
  if (remote === null) return "not-found";
  if (normalise(local) === normalise(remote)) return "identical";
  return name in config.allowlist ? "allowlisted" : "differs";
}

type RegistryItem = { files?: { path?: string; content?: string }[] };

/** Picks the registry file that corresponds to the local file (by basename, else the first with content). */
export function pickContent(item: RegistryItem, fileName: string): string | null {
  const files = (item.files ?? []).filter((f) => typeof f.content === "string");
  const match = files.find((f) => f.path && basename(f.path) === fileName) ?? files[0];
  return match?.content ?? null;
}

async function fetchItem(name: string, apiKey: string): Promise<RegistryItem | null> {
  const res = await fetch(REGISTRY_BASE + name, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${name}`);
  return (await res.json()) as RegistryItem;
}

/** GitHub Actions annotation printed when no key is configured (the check is skipped, not failed). */
export const NO_KEY_NOTICE =
  "::notice::shadcnblocks drift check skipped: no SHADCNBLOCKS_API_KEY is configured. Set it to enable the check.";

/** The key, or null when it is unset or blank (an unset GitHub secret arrives as an empty string). */
export function readApiKey(env: Record<string, string | undefined>): string | null {
  const key = env.SHADCNBLOCKS_API_KEY?.trim();
  return key ? key : null;
}

async function main() {
  const apiKey = readApiKey(process.env);
  if (!apiKey) {
    console.log(NO_KEY_NOTICE);
    return;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = resolve(here, "..", "src/components/blocks");
  const config = JSON.parse(readFileSync(resolve(here, "shadcnblocks-drift.config.json"), "utf8")) as DriftConfig;
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).sort();

  const results: { name: string; status: Status; note: string }[] = [];
  for (const file of files) {
    const name = file.replace(/\.tsx?$/, "");
    const local = readFileSync(resolve(dir, file), "utf8");
    let status: Status;
    let note = "";
    if (name in config.localOnly) {
      status = "local-only";
      note = config.localOnly[name];
    } else {
      let remote: string | null = null;
      for (const cand of candidateNames(name)) {
        const item = await fetchItem(cand, apiKey);
        if (item) {
          remote = pickContent(item, file);
          note = cand;
          break;
        }
      }
      status = classify(name, local, remote, config);
      if (status === "allowlisted") note = config.allowlist[name];
    }
    results.push({ name, status, note });
  }

  for (const r of results) console.log(`${r.status.padEnd(12)} ${r.name.padEnd(32)} ${r.note}`);
  const count = (s: Status) => results.filter((r) => r.status === s).length;
  console.log(
    `\n${count("identical")} identical, ${count("differs")} differs, ${count("allowlisted")} allowlisted, ` +
      `${count("local-only")} local-only, ${count("not-found")} not-found`,
  );
  const bad = results.filter((r) => r.status === "differs");
  if (bad.length) {
    console.error(`\nDrift in: ${bad.map((b) => b.name).join(", ")}`);
    console.error("Re-sync from the registry, or add to the allowlist in scripts/shadcnblocks-drift.config.json with a reason.");
    process.exit(1);
  }
}

// Run only when executed directly (tests import this module).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  });
}
