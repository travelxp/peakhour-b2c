/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for the api and R2 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number,
    ) {
      super(message);
    }
  }
  return { api: { patch: vi.fn() }, ApiError, API_BASE_URL: "https://api.example" };
});
vi.mock("@/lib/api/media-uploads", () => ({ initiateUpload: vi.fn(), resumeUpload: vi.fn(), completeUpload: vi.fn(), abortUpload: vi.fn() }));
vi.mock("./probe-file", () => ({ probeDimensions: vi.fn(), captureVideoPoster: vi.fn() }));

const { ApiError } = (await import("@/lib/api")) as unknown as { ApiError: new (code: string, message: string, status: number) => Error };
const { UploadQueue, PartError, partBackoffMs, failureMessage } = await import("./upload-engine");
type UploadDeps = import("./upload-engine").UploadDeps;

/**
 * The upload machine, driven against a fake R2 and a fake api: parts are really sliced from the file and "held" by the fake, so
 * "sent twice", "sent in the wrong order" and "completed with a part missing" are things the fake can see.
 */

const PART = 4; // bytes: a 10-byte file is three parts (4, 4, 2)
const bytes = (n: number) => new Uint8Array(Array.from({ length: n }, (_, i) => i + 1));
const file = (name: string, n: number, type = "image/png") => new File([bytes(n)], name, { type });
const settle = () => new Promise((r) => setTimeout(r, 0));
async function until(cond: () => boolean) {
  for (let i = 0; i < 200 && !cond(); i++) await settle();
  expect(cond()).toBe(true);
}

function world(over: Partial<UploadDeps> = {}) {
  const held = new Map<number, Uint8Array>(); // what R2 holds, by part number
  const puts: Array<{ part: number; url: string; size: number }> = [];
  const calls = { initiate: [] as any[], resume: 0, complete: 0, abort: [] as string[], attach: [] as Array<[string, string]> };
  let mediaSeq = 0;
  let failPut: (part: number, attempt: number) => Error | null = () => null;
  const attempts = new Map<number, number>();
  const w = {
    held,
    puts,
    calls,
    setFail: (f: typeof failPut) => (failPut = f),
    deps: {
      initiate: vi.fn(async (body: any) => {
        calls.initiate.push(body);
        const count = Math.max(1, Math.ceil(body.sizeBytes / PART));
        return { deduped: false, uploadId: "up1", visibility: "published", kind: "image", partSize: PART, partCount: count, expiresAt: "x", parts: Array.from({ length: count }, (_, i) => ({ partNumber: i + 1, url: `https://r2/up1/${i + 1}?sig=1` })) };
      }),
      resume: vi.fn(async () => {
        calls.resume++;
        const total = [...held.keys()];
        return { uploadId: "up1", partSize: PART, partCount: 3, expiresAt: "x", uploaded: total.map((n) => ({ partNumber: n, size: PART })), parts: [1, 2, 3].filter((n) => !held.has(n)).map((n) => ({ partNumber: n, url: `https://r2/up1/${n}?sig=2` })) };
      }),
      complete: vi.fn(async () => {
        calls.complete++;
        const have = [...held.keys()].sort();
        if (have.length < 3) throw new ApiError("UPLOAD_INCOMPLETE", "Some parts are missing", 409);
        return { mediaId: `m${++mediaSeq}`, name: "Pic", publicUrl: "https://m/pic.png", visibility: "published", sizeBytes: 10, deduped: false };
      }),
      abort: vi.fn(async (id: string) => {
        calls.abort.push(id);
        return { aborted: true };
      }),
      putPart: vi.fn(async (url: string, body: Blob, onLoaded: (n: number) => void) => {
        const part = Number(/\/(\d+)\?/.exec(url)![1]);
        const attempt = (attempts.get(part) ?? 0) + 1;
        attempts.set(part, attempt);
        const err = failPut(part, attempt);
        if (err) throw err;
        onLoaded(body.size);
        puts.push({ part, url, size: body.size });
        held.set(part, new Uint8Array(await body.arrayBuffer()));
      }),
      hash: vi.fn(async () => "a".repeat(64)),
      probe: vi.fn(async () => ({ width: 640, height: 480 })),
      poster: vi.fn(async () => null),
      attachPoster: vi.fn(async (v: string, p: string) => {
        calls.attach.push([v, p]);
      }),
      sleep: vi.fn(async () => {}),
      fileConcurrency: 2,
      partConcurrency: 3,
      partTries: 3,
      maxResumes: 3,
      ...over,
    } as UploadDeps,
  };
  return w;
}

describe("a file goes through hash, initiate, parts, complete", () => {
  it("sends every part as the right slice of the file, then completes, and reports progress up to 1", async () => {
    const w = world();
    const q = new UploadQueue(w.deps);
    const seen: number[] = [];
    q.subscribe(() => seen.push(q.getSnapshot()[0]!.progress));
    const [row] = q.add([file("pic.png", 10)]);
    const done = await q.whenSettled(row!.id);
    expect(done.status).toBe("done");
    expect(done.mediaId).toBe("m1");
    expect(done.progress).toBe(1);
    // the api was told the whole-file hash, the real size and the dimensions
    expect(w.calls.initiate[0]).toMatchObject({ filename: "pic.png", mimeType: "image/png", sizeBytes: 10, contentHash: "a".repeat(64), width: 640, height: 480 });
    // R2 holds exactly the file, in order
    const assembled = [1, 2, 3].flatMap((n) => [...w.held.get(n)!]);
    expect(assembled).toEqual([...bytes(10)]);
    expect(w.calls.complete).toBe(1);
    expect(Math.max(...seen)).toBe(1);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]! - 0.35); // a retried part may step back, never to zero
  });

  it("says Already in Drive for a duplicate, with no upload and no complete", async () => {
    const w = world();
    (w.deps.initiate as any).mockResolvedValueOnce({ deduped: true, mediaId: "old", name: "Blue tin", visibility: "published", sizeBytes: 10 });
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("blue tin copy.jpg", 10)]);
    const done = await q.whenSettled(row!.id);
    expect(done).toMatchObject({ status: "duplicate", mediaId: "old", name: "Blue tin", progress: 1 });
    expect(w.puts).toHaveLength(0);
    expect(w.calls.complete).toBe(0);
  });

  it("keeps running when nobody is looking: no subscriber is needed, and a late one sees the finished state", async () => {
    const w = world();
    const q = new UploadQueue(w.deps);
    const un = q.subscribe(() => {});
    const [row] = q.add([file("pic.png", 10)]);
    un(); // the tray was closed
    await until(() => q.getSnapshot()[0]!.status === "done");
    let late = 0;
    q.subscribe(() => late++);
    expect(q.getSnapshot()[0]).toMatchObject({ id: row!.id, status: "done" });
    expect(q.busy).toBe(false);
  });

  it("runs at most fileConcurrency files at once", async () => {
    const w = world({ fileConcurrency: 2 });
    let inFlight = 0;
    let peak = 0;
    w.deps.hash = vi.fn(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await settle();
      inFlight--;
      return "b".repeat(64);
    });
    const q = new UploadQueue(w.deps);
    const rows = q.add([file("1.png", 10), file("2.png", 10), file("3.png", 10), file("4.png", 10)]);
    await Promise.all(rows.map((r) => q.whenSettled(r.id)));
    expect(peak).toBe(2);
    expect(q.getSnapshot().every((r) => r.status === "done")).toBe(true);
  });
});

describe("resume: nothing already in R2 is sent twice", () => {
  it("a part that keeps failing sends the file back to the api, which names what R2 holds, and only the rest is sent", async () => {
    const w = world();
    // part 2 fails every try on its first URL
    w.setFail((part, attempt) => (part === 2 && attempt <= 3 ? new PartError(0) : null));
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("pic.png", 10)]);
    const done = await q.whenSettled(row!.id);
    expect(done.status).toBe("done");
    expect(w.calls.resume).toBe(1);
    const sentCount = (n: number) => w.puts.filter((p) => p.part === n).length;
    expect([sentCount(1), sentCount(2), sentCount(3)]).toEqual([1, 1, 1]);
    // the retry used the FRESH url the resume returned
    expect(w.puts.find((p) => p.part === 2)!.url).toContain("sig=2");
    expect(w.deps.sleep).toHaveBeenCalledWith(partBackoffMs(1));
    expect(w.deps.sleep).toHaveBeenCalledWith(partBackoffMs(2));
  });

  it("an expired URL (403) is not retried on the same URL: it resumes at once", async () => {
    const w = world();
    w.setFail((part, attempt) => (part === 1 && attempt === 1 ? new PartError(403) : null));
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("pic.png", 10)]);
    await q.whenSettled(row!.id);
    expect(q.getSnapshot()[0]!.status).toBe("done");
    expect(w.deps.sleep).not.toHaveBeenCalled();
    expect(w.calls.resume).toBe(1);
  });

  it("gives up after maxResumes with a sentence a person can act on, and Try again carries on from the parts R2 holds", async () => {
    const w = world({ maxResumes: 1 });
    let broken = true;
    w.setFail((part) => (part === 3 && broken ? new PartError(0) : null));
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("pic.png", 10)]);
    const failed = await q.whenSettled(row!.id);
    expect(failed.status).toBe("failed");
    expect(failed.error).toMatch(/connection dropped/i);
    expect(failed.final).toBeFalsy();
    expect(w.held.has(1) && w.held.has(2) && !w.held.has(3)).toBe(true);
    const sentBefore = w.puts.length;
    broken = false;
    q.retry(row!.id);
    const done = await q.whenSettled(row!.id);
    expect(done.status).toBe("done");
    // only part 3 went out on the retry; the session was resumed, not started again
    expect(w.puts.length).toBe(sentBefore + 1);
    expect(w.calls.initiate).toHaveLength(1);
  });
});

describe("resume edge cases", () => {
  it("an upload R2 has already stitched (the api says every part is in) goes straight to complete, sending nothing", async () => {
    const w = world();
    let broken = true;
    w.setFail((part) => (part === 3 && broken ? new PartError(0) : null));
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("pic.png", 10)]);
    await q.whenSettled(row!.id);
    expect(q.getSnapshot()[0]!.status).toBe("failed");
    broken = false;
    // the earlier complete stitched the object and lost its answer: resume says so with a 409
    (w.deps.resume as any).mockRejectedValueOnce(new ApiError("UPLOAD_ASSEMBLED", "Every part is already in; complete the upload.", 409));
    w.held.set(3, new Uint8Array([9, 10]));
    const sent = w.puts.length;
    q.retry(row!.id);
    expect((await q.whenSettled(row!.id)).status).toBe("done");
    expect(w.puts.length).toBe(sent);
  });

  it("an upload the api no longer knows (expired) starts afresh instead of failing for good", async () => {
    const w = world();
    let broken = true;
    w.setFail((part) => (part === 3 && broken ? new PartError(0) : null));
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("pic.png", 10)]);
    await q.whenSettled(row!.id);
    broken = false;
    (w.deps.resume as any).mockRejectedValueOnce(new ApiError("UPLOAD_EXPIRED", "This upload expired; start it again.", 410));
    w.held.clear();
    q.retry(row!.id);
    expect((await q.whenSettled(row!.id)).status).toBe("done");
    expect(w.calls.initiate).toHaveLength(2);
  });
});

describe("refusals", () => {
  it("a full Drive stops before any byte moves, says so, and can be tried again once there is space", async () => {
    const w = world();
    (w.deps.initiate as any).mockRejectedValueOnce(new ApiError("STORAGE_QUOTA_EXCEEDED", "Your Drive is full.", 402));
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("pic.png", 10)]);
    const failed = await q.whenSettled(row!.id);
    expect(failed).toMatchObject({ status: "failed", quotaFull: true, error: "Your Drive is full." });
    expect(failed.final).toBe(false);
    expect(w.puts).toHaveLength(0);
    q.retry(row!.id);
    expect((await q.whenSettled(row!.id)).status).toBe("done");
  });

  it("a type or size the api refuses is final: Try again does nothing and the row can be cleared", async () => {
    const w = world();
    (w.deps.initiate as any).mockRejectedValueOnce(new ApiError("FILE_TOO_LARGE", "This video is too large; the limit is 512 MB.", 413));
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("big.mp4", 10, "video/mp4")]);
    const failed = await q.whenSettled(row!.id);
    expect(failed).toMatchObject({ status: "failed", final: true, error: "This video is too large; the limit is 512 MB." });
    q.retry(row!.id);
    expect(q.getSnapshot()[0]!.status).toBe("failed");
    q.clearFinished();
    expect(q.getSnapshot()).toHaveLength(0);
  });

  it("failureMessage never shows a raw error", () => {
    expect(failureMessage(new Error("TypeError: failed to fetch https://r2.example/x?sig=SECRET")).message).not.toMatch(/SECRET|fetch|TypeError/);
  });
});

describe("cancel", () => {
  it("stops the file, throws the parts away at R2 and sends nothing more", async () => {
    const w = world();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const original = w.deps.putPart;
    w.deps.putPart = vi.fn(async (url, body, onLoaded, signal) => {
      await gate;
      if (signal.aborted) throw new DOMException("aborted", "AbortError");
      return original(url, body, onLoaded, signal);
    });
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("pic.png", 10)]);
    await until(() => q.getSnapshot()[0]!.status === "uploading");
    q.cancel(row!.id);
    release();
    await settle();
    await settle();
    expect(q.getSnapshot()[0]!.status).toBe("cancelled");
    expect(w.calls.abort).toEqual(["up1"]);
    expect(w.calls.complete).toBe(0);
  });
});

describe("a video's poster frame", () => {
  it("is sent as its own file after the video is in, attached to it, and never shown as a row of its own", async () => {
    const w = world();
    w.deps.poster = vi.fn(async () => file("clip poster.jpg", 10, "image/jpeg"));
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("clip.mp4", 10, "video/mp4")]);
    const done = await q.whenSettled(row!.id);
    await until(() => w.calls.attach.length === 1);
    expect(done.mediaId).toBe("m1");
    expect(w.calls.attach).toEqual([["m1", "m2"]]);
    expect(q.getSnapshot()).toHaveLength(1);
  });

  it("a poster that cannot be taken, or cannot be sent, leaves the video safely in Drive", async () => {
    const w = world();
    w.deps.poster = vi.fn(async () => null);
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("clip.mp4", 10, "video/mp4")]);
    expect((await q.whenSettled(row!.id)).status).toBe("done");
    expect(w.calls.attach).toHaveLength(0);

    const w2 = world();
    w2.deps.poster = vi.fn(async () => file("p.jpg", 10, "image/jpeg"));
    (w2.deps.attachPoster as any).mockRejectedValueOnce(new Error("api down"));
    const q2 = new UploadQueue(w2.deps);
    const [row2] = q2.add([file("clip.mp4", 10, "video/mp4")]);
    await q2.whenSettled(row2!.id);
    await settle();
    expect(q2.getSnapshot()[0]!.status).toBe("done");
  });

  it("an image never asks for a poster", async () => {
    const w = world();
    const q = new UploadQueue(w.deps);
    const [row] = q.add([file("pic.png", 10)]);
    await q.whenSettled(row!.id);
    expect(w.deps.poster).not.toHaveBeenCalled();
  });
});

describe("onDone", () => {
  it("fires once per file that lands (done or duplicate), after any poster, so the page can refresh its list", async () => {
    const w = world();
    const q = new UploadQueue(w.deps);
    const landed: string[] = [];
    q.onDone((r) => landed.push(r.id));
    const rows = q.add([file("a.png", 10), file("b.png", 10)]);
    await Promise.all(rows.map((r) => q.whenSettled(r.id)));
    await until(() => landed.length === 2);
    expect(new Set(landed).size).toBe(2);
  });
});
