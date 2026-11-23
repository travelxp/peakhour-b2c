import { afterEach, describe, expect, it, vi } from "vitest";

const downloadBlob = vi.fn();
vi.mock("@/lib/download", () => ({ downloadBlob }));

const { batchApprovalsCsvPath, exportBatchApprovals, exportFailureLine } = await import("./studio-export");

const csv = () => new Response("a,b\r\n", { status: 200, headers: { "content-disposition": 'attachment; filename="studio-approvals-b1.csv"' } });

afterEach(() => {
  vi.unstubAllGlobals();
  downloadBlob.mockReset();
});

describe("exporting a batch's approvals (S16)", () => {
  it("asks the api's file for that batch with the session cookie and hands the bytes to the browser", async () => {
    const fetchMock = vi.fn(async () => csv());
    vi.stubGlobal("fetch", fetchMock);
    expect(await exportBatchApprovals("b1")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/v1/creative/batches/b1/approvals.csv"), { credentials: "include" });
    expect(downloadBlob.mock.calls[0]![1]).toBe("studio-approvals-b1.csv");
  });

  it("an idle tab's expired token is renewed once and the file is asked for again", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 401 })).mockResolvedValueOnce(new Response("{}", { status: 200 })).mockResolvedValueOnce(csv());
    vi.stubGlobal("fetch", fetchMock);
    expect(await exportBatchApprovals("b1")).toEqual({ ok: true });
    expect(fetchMock.mock.calls.map((c) => String(c[0]).replace(/^.*(?=\/v1)/, ""))).toEqual(["/v1/creative/batches/b1/approvals.csv", "/v1/auth/refresh", "/v1/creative/batches/b1/approvals.csv"]);
  });

  it("names each way it can fail in a sentence and downloads nothing", async () => {
    for (const status of [401, 403, 404, 429, 500]) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status })));
      const out = await exportBatchApprovals("b1");
      expect(out).toEqual({ ok: false, message: exportFailureLine(status) });
    }
    expect(new Set([401, 403, 404, 429, 500].map(exportFailureLine)).size).toBe(5);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await exportBatchApprovals("b1")).ok).toBe(false);
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("an id in the path is encoded, so it cannot reach another route", () => {
    expect(batchApprovalsCsvPath("a/../b")).toBe("/v1/creative/batches/a%2F..%2Fb/approvals.csv");
  });
});
