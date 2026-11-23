import { afterEach, describe, expect, it, vi } from "vitest";

const downloadBlob = vi.fn();
vi.mock("@/lib/download", () => ({ downloadBlob }));

const { batchApprovalsCsvPath, exportBatchApprovals } = await import("./studio-export");

afterEach(() => {
  vi.unstubAllGlobals();
  downloadBlob.mockReset();
});

describe("exporting a batch's approvals (S16)", () => {
  it("asks the api's file for that batch, with the session cookie, and hands the bytes to the browser", async () => {
    const fetchMock = vi.fn(async () => new Response("a,b\r\n", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await exportBatchApprovals("b1")).toBe("done");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/v1/creative/batches/b1/approvals.csv"), { credentials: "include" });
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(downloadBlob.mock.calls[0]![1]).toBe("studio-approvals-b1.csv");
  });

  it("names the three ways it can fail and downloads nothing", async () => {
    for (const [status, want] of [[401, "session"], [404, "missing"], [500, "failed"]] as const) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status })));
      expect(await exportBatchApprovals("b1")).toBe(want);
    }
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await exportBatchApprovals("b1")).toBe("failed");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("an id in the path is encoded, so it cannot reach another route", () => {
    expect(batchApprovalsCsvPath("a/../b")).toBe("/v1/creative/batches/a%2F..%2Fb/approvals.csv");
  });
});
