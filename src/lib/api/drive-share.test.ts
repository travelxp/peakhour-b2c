import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() }, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));

const { fetchSharePage, openSharedFile } = await import("./drive-share");

/**
 * The visitor's two calls. The GET must record nothing (it is `fetchSharePage`: no method, no body, no cookie), and the number the
 * notice quotes must come from the api's answer: without one, the page cannot open the file.
 */
const TOKEN = "t".repeat(43);
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("fetchSharePage", () => {
  it("is a plain cookie-less GET of the public route", async () => {
    const f = reply(200, { success: true, data: { passwordRequired: false, retentionDays: 90 } });
    await fetchSharePage(TOKEN, f as never);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.example/v1/drive/share/${TOKEN}`);
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe("omit");
  });

  it("reads the retention days and whether a password is needed", async () => {
    expect(await fetchSharePage(TOKEN, reply(200, { success: true, data: { passwordRequired: true, retentionDays: 30 } }) as never)).toEqual({ kind: "ready", passwordRequired: true, retentionDays: 30 });
    expect(await fetchSharePage(TOKEN, reply(200, { success: true, data: { passwordRequired: false, retentionDays: 365 } }) as never)).toEqual({ kind: "ready", passwordRequired: false, retentionDays: 365 });
  });

  it("no number is an error, never a default: the page does not open a file on a guess", async () => {
    for (const data of [{ passwordRequired: false }, { passwordRequired: false, retentionDays: 0 }, { passwordRequired: false, retentionDays: "90" }, { passwordRequired: false, retentionDays: 1.5 }]) {
      expect(await fetchSharePage(TOKEN, reply(200, { success: true, data }) as never)).toEqual({ kind: "error" });
    }
  });

  it("a 404 is a dead link; anything else, or no network, is an error", async () => {
    expect(await fetchSharePage(TOKEN, reply(404, { success: false }) as never)).toEqual({ kind: "gone" });
    expect(await fetchSharePage(TOKEN, reply(503, { success: false }) as never)).toEqual({ kind: "error" });
    expect(await fetchSharePage(TOKEN, vi.fn(async () => { throw new Error("offline"); }) as never)).toEqual({ kind: "error" });
  });
});

describe("openSharedFile", () => {
  it("POSTs, cookie-less, with the password only when there is one", async () => {
    const f = reply(200, { success: true, data: { url: "https://files.example/x?sig=1", name: "Guidelines", retentionDays: 90 } });
    expect(await openSharedFile(TOKEN, "pw", f as never)).toEqual({ kind: "opened", url: "https://files.example/x?sig=1", name: "Guidelines", retentionDays: 90 });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(init.body as string)).toEqual({ password: "pw" });
    const g = reply(200, { success: true, data: { url: "https://files.example/x" } });
    await openSharedFile(TOKEN, undefined, g as never);
    expect(JSON.parse((g.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({});
  });

  it("tells a missing or wrong password from a lock, and carries the number each time", async () => {
    expect(await openSharedFile(TOKEN, undefined, reply(401, { success: false, error: { code: "PASSWORD_REQUIRED" }, passwordRequired: true, retentionDays: 90 }) as never)).toEqual({ kind: "password", wrong: false, retentionDays: 90 });
    expect(await openSharedFile(TOKEN, "x", reply(401, { success: false, error: { code: "PASSWORD_WRONG" }, passwordRequired: true, retentionDays: 30 }) as never)).toEqual({ kind: "password", wrong: true, retentionDays: 30 });
    expect(await openSharedFile(TOKEN, "x", reply(429, { success: false, error: { code: "LOCKED" }, retentionDays: 90 }) as never)).toEqual({ kind: "locked", retentionDays: 90 });
  });

  it("a 404, a 503 and a network failure", async () => {
    expect(await openSharedFile(TOKEN, undefined, reply(404, { success: false }) as never)).toEqual({ kind: "gone" });
    expect(await openSharedFile(TOKEN, undefined, reply(503, { success: false }) as never)).toEqual({ kind: "error" });
    expect(await openSharedFile(TOKEN, undefined, vi.fn(async () => { throw new Error("offline"); }) as never)).toEqual({ kind: "error" });
  });
});
