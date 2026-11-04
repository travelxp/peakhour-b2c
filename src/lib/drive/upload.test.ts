import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { UploadAborted, uploadErrorMessage, uploadToDrive, type InitiateAnswer, type UploadDeps } from "./upload";

const HASH = "a".repeat(64);
const PART = 4;

function file(bytes: number, name = "tin.jpg", type = "image/jpeg") {
  return new File([new Uint8Array(bytes).map((_, i) => i % 251)], name, { type });
}

function started(parts: number, base = "https://r2.test/put"): InitiateAnswer {
  return {
    deduped: false,
    uploadId: "u1",
    visibility: "published",
    kind: "image",
    partSize: PART,
    partCount: parts,
    parts: Array.from({ length: parts }, (_, i) => ({ partNumber: i + 1, url: `${base}/${i + 1}` })),
    expiresAt: "2026-11-05T00:00:00Z",
  };
}

const COMPLETE = { mediaId: "m1", name: "Tin", publicUrl: "https://media.test/m1", visibility: "published" as const, sizeBytes: 10, deduped: false };

function deps(over: Partial<UploadDeps> = {}) {
  const sent: Array<{ url: string; size: number }> = [];
  const d: UploadDeps = {
    sha256Hex: async () => HASH,
    measureImage: async () => ({ width: 1080, height: 1350 }),
    initiate: vi.fn(async () => started(3)),
    resume: vi.fn(),
    complete: vi.fn(async () => COMPLETE),
    abort: vi.fn(async () => undefined),
    putPart: vi.fn(async (url, body, onBytes) => {
      onBytes(body.size);
      sent.push({ url, size: body.size });
    }),
    ...over,
  };
  return { d, sent };
}

describe("uploading straight to storage", () => {
  it("starts with the file's hash and measured size, sends every part at its own size, then completes", async () => {
    const { d, sent } = deps();
    const progress: number[] = [];
    const res = await uploadToDrive(file(10), { deps: d, onProgress: (p) => progress.push(p.sent) });
    expect(d.initiate).toHaveBeenCalledWith({ filename: "tin.jpg", mimeType: "image/jpeg", sizeBytes: 10, contentHash: HASH, width: 1080, height: 1350 });
    expect(sent).toEqual([
      { url: "https://r2.test/put/1", size: 4 },
      { url: "https://r2.test/put/2", size: 4 },
      { url: "https://r2.test/put/3", size: 2 },
    ]);
    expect(d.complete).toHaveBeenCalledWith("u1");
    expect(res).toMatchObject({ mediaId: "m1", deduped: false });
    // progress only climbs and ends at the whole file
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);
    expect(progress.at(-1)).toBe(10);
  });

  it("sends the visibility a screen asked for, and none otherwise (the type's default then applies)", async () => {
    const a = deps();
    await uploadToDrive(file(10), { deps: a.d, visibility: "published" });
    expect(a.d.initiate).toHaveBeenCalledWith(expect.objectContaining({ visibility: "published" }));
    const b = deps();
    await uploadToDrive(file(10), { deps: b.d });
    expect(vi.mocked(b.d.initiate).mock.calls[0]![0]).not.toHaveProperty("visibility");
  });

  it("a file Drive already holds is answered without sending a byte", async () => {
    const { d, sent } = deps({
      initiate: vi.fn(async () => ({ deduped: true as const, mediaId: "m9", name: "Tin", publicUrl: "https://media.test/m9", visibility: "published" as const, sizeBytes: 10 })),
    });
    const p = vi.fn();
    const res = await uploadToDrive(file(10), { deps: d, onProgress: p });
    expect(res).toMatchObject({ mediaId: "m9", deduped: true });
    expect(sent).toEqual([]);
    expect(d.complete).not.toHaveBeenCalled();
    expect(p).toHaveBeenLastCalledWith({ sent: 10, total: 10 });
  });

  it("retries a part that failed before giving up on it", async () => {
    let tries = 0;
    const { d } = deps({
      putPart: vi.fn(async (url) => {
        if (url.endsWith("/2") && ++tries < 3) throw new Error("The connection dropped.");
      }),
    });
    const res = await uploadToDrive(file(10), { deps: d });
    expect(res.mediaId).toBe("m1");
    expect(tries).toBe(3);
    expect(d.resume).not.toHaveBeenCalled();
  });

  it("after a part keeps failing it RESUMES from what storage holds and sends only the missing parts, with fresh links", async () => {
    const put: string[] = [];
    const { d } = deps({
      initiate: vi.fn(async () => started(3, "https://r2.test/old")),
      // part 1 goes through on its old link; the old links of parts 2 and 3 have expired
      putPart: vi.fn(async (url) => {
        if (url.includes("/old/") && !url.endsWith("/old/1")) throw new Error("Storage answered 403");
        put.push(url);
      }),
      resume: vi.fn(async () => ({
        uploadId: "u1",
        partSize: PART,
        partCount: 3,
        uploaded: [{ partNumber: 1, size: 4 }],
        parts: [2, 3].map((n) => ({ partNumber: n, url: `https://r2.test/new/${n}` })),
      })),
    });
    const res = await uploadToDrive(file(10), { deps: d, partAttempts: 2 });
    expect(res.mediaId).toBe("m1");
    expect(d.resume).toHaveBeenCalledTimes(1);
    expect(put).toEqual(["https://r2.test/old/1", "https://r2.test/new/2", "https://r2.test/new/3"]);
    expect(d.complete).toHaveBeenCalledTimes(1);
  });

  it("a failure that resume cannot cure gives the upload up and throws the parts away", async () => {
    const { d } = deps({
      putPart: vi.fn(async () => {
        throw new Error("The connection dropped.");
      }),
      resume: vi.fn(async () => ({ uploadId: "u1", partSize: PART, partCount: 3, uploaded: [], parts: [{ partNumber: 1, url: "https://r2.test/new/1" }] })),
    });
    await expect(uploadToDrive(file(10), { deps: d, partAttempts: 1 })).rejects.toThrow("The connection dropped.");
    expect(d.abort).toHaveBeenCalledWith("u1");
    expect(d.complete).not.toHaveBeenCalled();
  });

  it("a refusal at the end (quota) also throws the parts away and shows the api's own sentence", async () => {
    const err = new ApiError("STORAGE_QUOTA_EXCEEDED", "Your Drive is full. Add space to upload more.", 402);
    const { d } = deps({ complete: vi.fn(async () => Promise.reject(err)) });
    const caught = await uploadToDrive(file(10), { deps: d }).catch((e: unknown) => e);
    expect(caught).toBe(err);
    expect(d.abort).toHaveBeenCalledWith("u1");
    expect(uploadErrorMessage(caught)).toBe("Your Drive is full. Add space to upload more.");
  });

  it("cancelling stops sending, throws the parts away and never completes", async () => {
    const ctl = new AbortController();
    const { d } = deps({
      putPart: vi.fn(async () => {
        ctl.abort();
      }),
    });
    await expect(uploadToDrive(file(10), { deps: d, signal: ctl.signal })).rejects.toBeInstanceOf(UploadAborted);
    expect(d.putPart).toHaveBeenCalledTimes(1);
    expect(d.abort).toHaveBeenCalledWith("u1");
    expect(d.complete).not.toHaveBeenCalled();
  });

  it("an unknown failure is a plain sentence, never a stack or a status code", () => {
    expect(uploadErrorMessage(new Error("Storage answered 500"))).toBe("That upload didn't finish. Check your connection and try again.");
    expect(uploadErrorMessage(new ApiError("X", "Request failed", 500))).toBe("That upload didn't finish. Check your connection and try again.");
  });
});
