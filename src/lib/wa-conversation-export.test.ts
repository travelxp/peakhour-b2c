import { describe, it, expect, vi, afterEach } from "vitest";
import {
  canExportConversations,
  downloadConversationExport,
  expiryBanner,
  exportFailure,
  filenameFrom,
  rangeExportPath,
  threadExportPath,
} from "@/lib/wa-conversation-export";

describe("who may export", () => {
  it("owner and admin only", () => {
    expect(canExportConversations("owner")).toBe(true);
    expect(canExportConversations("admin")).toBe(true);
    for (const r of ["editor", "viewer", "", null, undefined, "Owner"]) expect(canExportConversations(r), String(r)).toBe(false);
  });
});

describe("export paths", () => {
  it("a thread id is URL-encoded and the format rides along", () => {
    expect(threadExportPath("whatsapp:111:222")).toBe("/v1/meta/whatsapp/conversations/export?threadId=whatsapp%3A111%3A222&format=txt");
    expect(threadExportPath("a&b=c", "jsonl")).toBe("/v1/meta/whatsapp/conversations/export?threadId=a%26b%3Dc&format=jsonl");
  });

  it("a range needs a first day as YYYY-MM-DD; the last day is optional but must be a date when given", () => {
    expect(rangeExportPath("2026-10-01", "2026-10-31")).toBe("/v1/meta/whatsapp/conversations/export?from=2026-10-01&to=2026-10-31&format=txt");
    expect(rangeExportPath("2026-10-01", "")).toBe("/v1/meta/whatsapp/conversations/export?from=2026-10-01&format=txt");
    // a malformed last day is REFUSED, not dropped: dropping it would export up to today
    for (const bad of ["soon", "2026-10-3"]) expect(rangeExportPath("2026-10-01", bad), bad).toBeNull();
    // a day that does not exist, and a last day before the first, are caught here rather than by a round trip
    expect(rangeExportPath("2026-02-31", "")).toBeNull();
    expect(rangeExportPath("2026-10-01", "2026-09-30")).toBeNull();
    expect(rangeExportPath("2026-10-01", "2026-10-01")).not.toBeNull();
    for (const bad of ["", " ", "1 Oct", "2026-10-1", "2026-10-01&x=1"]) expect(rangeExportPath(bad, ""), bad).toBeNull();
  });
});

describe("exportFailure and filenameFrom", () => {
  it("says something different for each answer, never the raw server text", () => {
    const all = [exportFailure(403), exportFailure(404, "NO_CONVERSATIONS"), exportFailure(404), exportFailure(413), exportFailure(429), exportFailure(400), exportFailure(401), exportFailure(500)];
    expect(new Set(all).size).toBe(all.length);
  });

  it("takes the API's filename only when it is a plain one", () => {
    expect(filenameFrom('attachment; filename="peakhour-conversation-2026-11-02.txt"')).toBe("peakhour-conversation-2026-11-02.txt");
    expect(filenameFrom('attachment; filename="../../etc/passwd"')).toBe("peakhour-conversations.txt");
    expect(filenameFrom(null)).toBe("peakhour-conversations.txt");
  });
});

describe("expiryBanner", () => {
  it("says nothing for zero, a missing count or junk; states the count and points at export otherwise", () => {
    for (const c of [0, -1, null, undefined, Number.NaN]) expect(expiryBanner(c, null), String(c)).toBeNull();
    expect(expiryBanner(1, null)?.heading).toBe("1 conversation will be deleted soon");
    const b = expiryBanner(12, "2026-12-03T10:00:00Z");
    expect(b?.heading).toBe("12 conversations will be deleted soon");
    expect(b?.body).toMatch(/180 days after their last message/);
    expect(b?.body).toMatch(/export them first/);
    expect(expiryBanner(3, "not a date")?.body).not.toMatch(/Invalid|first goes/);
  });
});

describe("downloadConversationExport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a refusal is a sentence from the status and code; nothing is downloaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { code: "TOO_LARGE", message: "RAW" } }), { status: 413 })));
    const click = vi.fn();
    vi.stubGlobal("document", { createElement: () => ({ click }), body: { appendChild: vi.fn() } });
    const out = await downloadConversationExport("/v1/x");
    expect(out).toEqual({ ok: false, message: exportFailure(413, "TOO_LARGE") });
    expect(click).not.toHaveBeenCalled();
  });

  it("a network failure is the generic sentence, not a throw", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await downloadConversationExport("/v1/x")).toEqual({ ok: false, message: exportFailure(500) });
  });

  it("a file is handed to the browser under the API's filename", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("hello", { status: 200, headers: { "content-disposition": 'attachment; filename="peakhour-conversation-2026-11-02.txt"' } })));
    const anchor: { href: string; download: string; click: () => void; remove: () => void } = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor, body: { appendChild: vi.fn() } });
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: revoke });
    const out = await downloadConversationExport("/v1/x");
    expect(out).toEqual({ ok: true, filename: "peakhour-conversation-2026-11-02.txt" });
    expect(anchor.download).toBe("peakhour-conversation-2026-11-02.txt");
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled(); // not before the download has started
  });

  it("an expired access token is renewed once and the export retried; a failed renewal is the session sentence", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      calls.push(u);
      if (u.includes("/auth/refresh")) return new Response("{}", { status: 200 });
      return calls.filter((c) => c.includes("/export")).length === 1 ? new Response("{}", { status: 401 }) : new Response("x", { status: 200 });
    }));
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    const out = await downloadConversationExport("/v1/export?format=jsonl");
    expect(out).toEqual({ ok: true, filename: "peakhour-conversations.jsonl" });
    expect(calls.filter((c) => c.includes("/export"))).toHaveLength(2);
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u.includes("/auth/refresh") ? new Response("{}", { status: 401 }) : new Response("{}", { status: 401 }))));
    expect(await downloadConversationExport("/v1/export")).toEqual({ ok: false, message: exportFailure(401) });
  });
});
