/**
 * The review manifest for the CMS approval screen, generated from the registry so it can be re-run.
 *
 *   npx tsx scripts/seo/review-manifest.ts            print a summary
 *   npx tsx scripts/seo/review-manifest.ts --write    rewrite docs/seo/review-manifest.json and src/lib/seo/content-hashes.json
 *
 * review-manifest.test.ts fails when either committed file is not what the registry produces now. Approvals are not part
 * of that comparison: src/lib/seo/approvals.ts is their source of truth and the api edits it, so the written file only
 * carries the approvals as they stood when it was written.
 */

import "../../src/lib/seo/review-authored-mode"; // first: the page copy must be read in authored mode
import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildReviewManifest, contentHashMap } from "../../src/lib/seo/review-manifest";

export const MANIFEST_PATH = path.resolve(__dirname, "../../docs/seo/review-manifest.json");
export const HASHES_PATH = path.resolve(__dirname, "../../src/lib/seo/content-hashes.json");

/** The two files' exact text, LF line endings and a trailing newline. */
export function render(manifest = buildReviewManifest()): { manifest: string; hashes: string } {
  return {
    manifest: `${JSON.stringify(manifest, null, 2)}\n`,
    hashes: `${JSON.stringify(contentHashMap(manifest), null, 2)}\n`,
  };
}

if (require.main === module) {
  const out = render();
  if (process.argv.includes("--write")) {
    writeFileSync(MANIFEST_PATH, out.manifest);
    writeFileSync(HASHES_PATH, out.hashes);
    console.log(`wrote ${MANIFEST_PATH} and ${HASHES_PATH}`);
  } else {
    const m = buildReviewManifest();
    console.log(`${m.pages.length} pages up for review, ${m.pages.filter((p) => p.approval).length} with an approval`);
  }
}
