import type { DescribeStateRow } from "@/lib/api/media";
import type { UploadRow } from "./upload-engine";

/**
 * What each row of the upload tray says (Upload board). Pure, so a test can read the sentence a person would.
 *
 * A file that has landed is not "done" to the person: Peakhour is still naming it. So a landed row says what Peakhour is doing, by what
 * the file is ("Studying your image…"), until the describing poll answers, then "Named and sorted". A file the describer will not read
 * just says "Added to Drive". Never "AI processing" or "Analysing".
 */

const WORKING: Partial<Record<UploadRow["kind"], string>> = {
  image: "Studying your image…",
  video: "Watching your video…",
  document: "Reading your document…",
};

export function trayLine(row: UploadRow, desc: Pick<DescribeStateRow, "describeState"> | undefined): string {
  switch (row.status) {
    case "waiting":
      return "Waiting";
    case "preparing":
      return "Getting ready";
    case "uploading":
      return `Uploading, ${Math.floor(row.progress * 100)}%`;
    case "finishing":
      return "Finishing";
    case "duplicate":
      return "Already in Drive";
    case "cancelled":
      return "Stopped";
    case "failed":
      return row.error ?? "This file could not be uploaded.";
    case "done": {
      const s = desc?.describeState;
      if (s === "described") return "Named and sorted";
      if (s === "not_described") return "Added to Drive";
      return WORKING[row.kind] ?? "Added to Drive";
    }
  }
}

/** The name to show: the one Drive gave it (and Peakhour's, once it has named it), else what the person dropped. */
export function trayName(row: UploadRow, desc: Pick<DescribeStateRow, "name"> | undefined): string {
  return desc?.name ?? row.name ?? row.filename;
}

/** "Was IMG_4471.jpg", shown only when the name is no longer the filename. */
export function trayWas(row: UploadRow, desc: Pick<DescribeStateRow, "name"> | undefined): string | null {
  const shown = trayName(row, desc);
  return shown !== row.filename && shown !== row.filename.replace(/\.[^.]+$/, "") ? `Was ${row.filename}` : null;
}

export function trayTitle(rows: readonly UploadRow[]): string {
  const active = rows.filter((r) => ["waiting", "preparing", "uploading", "finishing"].includes(r.status)).length;
  if (active > 0) return `Uploading ${active} ${active === 1 ? "file" : "files"}`;
  const failed = rows.filter((r) => r.status === "failed").length;
  if (failed > 0) return `${failed} ${failed === 1 ? "file" : "files"} did not upload`;
  return `${rows.length} ${rows.length === 1 ? "file" : "files"} in Drive`;
}

/** The pill shown when the tray is closed and files are still going up. */
export function pillText(rows: readonly UploadRow[]): string | null {
  const active = rows.filter((r) => ["waiting", "preparing", "uploading", "finishing"].includes(r.status));
  if (active.length === 0) return null;
  const total = active.reduce((n, r) => n + r.sizeBytes, 0);
  const sent = active.reduce((n, r) => n + r.sizeBytes * r.progress, 0);
  const pct = total > 0 ? Math.floor((sent / total) * 100) : 0;
  return `Uploading ${active.length} ${active.length === 1 ? "file" : "files"}, ${pct}%`;
}
