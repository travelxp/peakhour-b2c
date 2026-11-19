import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ api: {}, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));

const { fetchApproval, answerApproval } = await import("./studio-share");

const TOKEN = "k".repeat(43);
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const picture = { business: "Sari House", imageUrl: "https://cdn.example/p.png", width: 768, height: 960, answered: null, expiresAt: "2026-11-26T00:00:00.000Z" };

describe("fetchApproval (S18, the visitor's read)", () => {
  it("is a plain cookie-less GET of the public token route", async () => {
    const f = reply(200, { success: true, data: picture });
    await fetchApproval(TOKEN, f as never);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.example/v1/creative/share/${TOKEN}`);
    expect(init.method).toBeUndefined();
    expect(init.credentials).toBe("omit");
  });

  it("reads exactly the picture, the business and its size", async () => {
    expect(await fetchApproval(TOKEN, reply(200, { success: true, data: { ...picture, surprise: "x" } }) as never)).toEqual({
      kind: "ready",
      picture: { business: "Sari House", imageUrl: "https://cdn.example/p.png", width: 768, height: 960, answered: null, expiresAt: "2026-11-26T00:00:00.000Z" },
    });
  });

  it("an answer that is missing the picture or the name is an error, never a blank page", async () => {
    expect(await fetchApproval(TOKEN, reply(200, { success: true, data: { ...picture, imageUrl: "" } }) as never)).toEqual({ kind: "error" });
    expect(await fetchApproval(TOKEN, reply(200, { success: true, data: { ...picture, business: undefined } }) as never)).toEqual({ kind: "error" });
  });

  it("a stopped link says whose it was, when the api says", async () => {
    const f = reply(410, { success: false, error: { code: "LINK_STOPPED", message: "This link has stopped working. Ask Sari House for a new one." } });
    expect(await fetchApproval(TOKEN, f as never)).toEqual({ kind: "stopped", business: "Sari House" });
    expect(await fetchApproval(TOKEN, reply(410, { success: false, error: { message: "This link has stopped working. Ask the business for a new one." } }) as never)).toEqual({
      kind: "stopped",
      business: undefined,
    });
  });

  it("no network is an error", async () => {
    expect(await fetchApproval(TOKEN, vi.fn(async () => Promise.reject(new Error("offline"))) as never)).toEqual({ kind: "error" });
  });
});

describe("answerApproval", () => {
  it("posts the answer and the name with no cookie, and leaves an empty comment out", async () => {
    const f = reply(200, { success: true, data: { ok: true, message: "Thanks. Sari House has your answer." } });
    const r = await answerApproval(TOKEN, { answer: "approved", name: "  Asha ", comment: "  " }, f as never);
    expect(r).toEqual({ kind: "thanks", message: "Thanks. Sari House has your answer." });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(init.body as string)).toEqual({ answer: "approved", name: "Asha" });
  });

  it("tells already answered, stopped and busy apart, and anything else is an error", async () => {
    const body = { answer: "rejected" as const, name: "Asha" };
    expect(await answerApproval(TOKEN, body, reply(409, { success: false, error: { code: "ALREADY_ANSWERED" } }) as never)).toEqual({ kind: "already" });
    expect(await answerApproval(TOKEN, body, reply(410, { success: false, error: { message: "This link has stopped working. Ask Sari House for a new one." } }) as never)).toEqual({
      kind: "stopped",
      business: "Sari House",
    });
    expect(await answerApproval(TOKEN, body, reply(409, { success: false, error: { code: "LINK_BUSY", message: "busy" } }) as never)).toEqual({ kind: "busy", message: "busy" });
    expect(await answerApproval(TOKEN, body, reply(500, { success: false }) as never)).toEqual({ kind: "error" });
  });
});
