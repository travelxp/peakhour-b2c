import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, downloadLink, downloadText } from "./download";

/** The browser is stubbed (the unit config runs in node): an anchor that records what it was given and what was done to it. */
interface Anchor {
  href: string;
  download: string;
  rel: string;
  click: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}
let anchors: Anchor[];
let appended: Anchor[];
let revoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
  anchors = [];
  appended = [];
  revoke = vi.fn();
  vi.useFakeTimers();
  vi.stubGlobal("document", {
    createElement: () => {
      const a: Anchor = { href: "", download: "", rel: "", click: vi.fn(), remove: vi.fn() };
      anchors.push(a);
      return a;
    },
    body: { appendChild: (a: Anchor) => appended.push(a) },
  });
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:made-here"), revokeObjectURL: revoke });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("downloadLink", () => {
  it("clicks one anchor with the link and the file name, attached while it is clicked and removed after", () => {
    expect(downloadLink("https://signed.example/file.png?sig=1", "poster.png")).toBe(true);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toMatchObject({ href: "https://signed.example/file.png?sig=1", download: "poster.png", rel: "noopener" });
    expect(appended).toEqual(anchors);
    expect(anchors[0]!.click).toHaveBeenCalledTimes(1);
    expect(anchors[0]!.remove).toHaveBeenCalledTimes(1);
  });

  it("accepts http as well as https, and trims the address", () => {
    expect(downloadLink("  http://localhost:3000/a.png ", "a.png")).toBe(true);
    expect(anchors[0]!.href).toBe("http://localhost:3000/a.png");
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>1</script>", "blob:https://x/y", "//evil.example/a", "/relative/path", "", "   ", null, undefined])(
    "never makes an anchor for %j (not an http or https address)",
    (bad) => {
      expect(downloadLink(bad as string | null | undefined, "x.png")).toBe(false);
      expect(anchors).toHaveLength(0);
    },
  );
});

describe("downloadBlob and downloadText", () => {
  it("downloads the bytes through their own object URL, and revokes it only after the download has had time to start", () => {
    downloadBlob(new Blob(["hello"]), "hello.txt");
    expect(anchors[0]).toMatchObject({ href: "blob:made-here", download: "hello.txt" });
    expect(anchors[0]!.click).toHaveBeenCalledTimes(1);
    expect(anchors[0]!.remove).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(9_999);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith("blob:made-here");
  });

  it("text becomes a file of the given type", async () => {
    downloadText('{"a":1}', "memory.json", "application/json");
    const made = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Blob;
    expect(made.type).toBe("application/json");
    expect(await made.text()).toBe('{"a":1}');
    expect(anchors[0]!.download).toBe("memory.json");
  });

  it("the object URL is still revoked when the click throws", () => {
    vi.stubGlobal("document", { createElement: () => ({ href: "", download: "", rel: "", click: () => { throw new Error("blocked"); }, remove: vi.fn() }), body: { appendChild: vi.fn() } });
    expect(() => downloadBlob(new Blob(["x"]), "x.bin")).toThrow("blocked");
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith("blob:made-here");
  });

  it("a blob's href is the object URL made here, never a caller's string", () => {
    downloadBlob(new Blob(["x"]), "x.bin");
    expect(anchors[0]!.href).toBe("blob:made-here");
  });
});
