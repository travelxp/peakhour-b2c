import { describe, expect, it } from "vitest";
import { appendUrls, lineCount, removeUrl, urlsOf } from "./add-drive-urls";

describe("adding Drive files to a one-address-per-line box", () => {
  it("puts each new address on its own line after what was typed", () => {
    expect(appendUrls("", ["https://m/a.jpg", "https://m/b.jpg"])).toBe("https://m/a.jpg\nhttps://m/b.jpg");
    expect(appendUrls("https://m/a.jpg\n", ["https://m/b.jpg"])).toBe("https://m/a.jpg\nhttps://m/b.jpg");
  });

  it("never adds an address that is already there, and leaves the box as it was when nothing is new", () => {
    expect(appendUrls("https://m/a.jpg\r\nhttps://m/b.jpg", ["https://m/a.jpg"])).toBe("https://m/a.jpg\r\nhttps://m/b.jpg");
    expect(appendUrls("https://m/a.jpg", ["https://m/a.jpg", "https://m/c.jpg"])).toBe("https://m/a.jpg\nhttps://m/c.jpg");
  });
});

describe("the box's own cap", () => {
  it("counts the addresses already typed, ignoring blank lines", () => {
    expect(lineCount("")).toBe(0);
    expect(lineCount(["https://m/a.jpg", "", "  ", "https://m/b.jpg", ""].join("\n"))).toBe(2);
  });
});

describe("the chosen pictures", () => {
  it("lists the addresses without blanks, and removes one without touching the rest", () => {
    const box = ["https://m/a.jpg", "", "https://m/b.jpg", "  https://m/c.jpg  "].join(String.fromCharCode(10));
    expect(urlsOf(box)).toEqual(["https://m/a.jpg", "https://m/b.jpg", "https://m/c.jpg"]);
    expect(removeUrl(box, "https://m/b.jpg")).toBe(["https://m/a.jpg", "https://m/c.jpg"].join(String.fromCharCode(10)));
    expect(removeUrl("https://m/a.jpg", "https://m/a.jpg")).toBe("");
  });
});
