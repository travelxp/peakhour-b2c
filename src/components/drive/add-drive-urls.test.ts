import { describe, expect, it } from "vitest";
import { appendUrls } from "./add-drive-urls";

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
