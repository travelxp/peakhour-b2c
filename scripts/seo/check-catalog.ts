/**
 * Prints drift between `catalogKeys` in src/lib/seo/capabilities.ts and the dev catalog
 * (cfg_features and cfg_integrations: key and status). BY HAND ONLY: run it before each content
 * row. It never runs in CI (b2c CI cannot reach the database) and it only reads.
 *
 *   npx tsx scripts/seo/check-catalog.ts
 *
 * The public api's /v1/platform/catalog lists integrations but not cfg_features, so this reads
 * MongoDB directly, with MONGO_URL and DB_NAME from the mongodb repo's .env (override the folder
 * with PEAKHOUR_MONGODB_DIR). The driver is borrowed from peakhour-api's node_modules so b2c does
 * not take a dependency on it.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { CAPABILITIES } from "../../src/lib/seo/capabilities";
import type { ReleaseStatus } from "../../src/lib/seo/types";

/** The slice of the driver this script uses, typed here because b2c does not depend on it. */
type MongoModule = {
  MongoClient: new (
    url: string,
    opts?: object,
  ) => {
    connect(): Promise<unknown>;
    db(name: string): {
      collection(name: string): { find(q: object, o: object): { toArray(): Promise<{ key?: unknown; status?: unknown }[]> } };
    };
    close(): Promise<void>;
  };
};

const MONGODB_DIR = process.env.PEAKHOUR_MONGODB_DIR ?? resolve(process.cwd(), "..", "peakhour-mongodb");
const API_DIR = process.env.PEAKHOUR_API_DIR ?? resolve(process.cwd(), "..", "peakhour-api");

/** Parse KEY=VALUE lines without sourcing them: an unquoted & in a URL breaks a shell. */
function readEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

/** The catalog's status words mapped onto ReleaseStatus. */
const CATALOG_TO_RELEASE: Record<string, ReleaseStatus> = {
  live: "live",
  // cfg_features uses "active" where cfg_integrations uses "live".
  active: "live",
  beta: "beta",
  coming_soon: "planned",
  in_development: "development",
  deprecated: "retired",
  hidden: "idea",
};

async function main() {
  const env = readEnv(resolve(MONGODB_DIR, ".env"));
  if (!env.MONGO_URL || !env.DB_NAME) throw new Error(`MONGO_URL and DB_NAME are needed in ${resolve(MONGODB_DIR, ".env")}`);
  const { MongoClient } = createRequire(resolve(API_DIR, "package.json"))("mongodb") as MongoModule;
  const client = new MongoClient(env.MONGO_URL, { readPreference: "secondaryPreferred" });
  await client.connect();
  try {
    const db = client.db(env.DB_NAME);
    const catalog = new Map<string, { status: string; collection: string }>();
    for (const collection of ["cfg_features", "cfg_integrations"]) {
      const rows = await db.collection(collection).find({}, { projection: { key: 1, status: 1 } }).toArray();
      for (const r of rows) catalog.set(String(r.key), { status: String(r.status), collection });
    }
    console.log(`catalog: ${catalog.size} keys from cfg_features + cfg_integrations`);

    let drift = 0;
    for (const cap of CAPABILITIES) {
      for (const impl of cap.implementations) {
        const where = `${cap.id} [${impl.surface}] (${impl.status})`;
        if (!impl.catalogKeys?.length) {
          console.log(`NOKEYS  ${where}: no catalogKeys`);
          continue;
        }
        for (const key of impl.catalogKeys) {
          const row = catalog.get(key);
          if (!row) {
            drift++;
            console.log(`MISSING ${where}: key "${key}" is not in the catalog`);
            continue;
          }
          const mapped = CATALOG_TO_RELEASE[row.status];
          if (mapped !== impl.status) {
            drift++;
            console.log(`DRIFT   ${where}: "${key}" is "${row.status}" in ${row.collection} (registry says ${impl.status})`);
          } else console.log(`ok      ${where}: "${key}" ${row.status}`);
        }
      }
    }
    console.log(drift ? `${drift} drift` : "no drift");
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
