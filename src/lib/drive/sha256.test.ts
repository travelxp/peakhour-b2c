import { describe, it, expect } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { Sha256, sha256OfFile, NATIVE_DIGEST_MAX_BYTES, type Sliceable } from "./sha256";

const ref = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const asFile = (b: Uint8Array): Sliceable => ({
  size: b.length,
  slice: (s, e) => ({ arrayBuffer: async () => b.slice(s, e).buffer as ArrayBuffer }),
});

describe("the streaming SHA-256", () => {
  it("matches the standard test vectors", () => {
    expect(new Sha256().update(new Uint8Array()).hex()).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(new Sha256().update(new TextEncoder().encode("abc")).hex()).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("matches Node for every length around the block and padding edges, fed in uneven pieces", () => {
    for (const len of [1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000, 4097]) {
      const data = new Uint8Array(randomBytes(len));
      const h = new Sha256();
      let at = 0;
      for (const step of [1, 7, 64, 3, 100]) {
        h.update(data.subarray(at, at + step));
        at += step;
      }
      h.update(data.subarray(at));
      expect(h.hex(), `length ${len}`).toBe(ref(data));
    }
  });
});

describe("sha256OfFile", () => {
  it("uses the native digest for a small file and the slices for a large one, and both agree with Node", async () => {
    const small = new Uint8Array(randomBytes(5000));
    expect(await sha256OfFile(asFile(small))).toBe(ref(small));
    const big = new Uint8Array(randomBytes(NATIVE_DIGEST_MAX_BYTES + 12_345));
    const seen: number[] = [];
    expect(await sha256OfFile(asFile(big), (f) => seen.push(f))).toBe(ref(big));
    expect(seen.length).toBeGreaterThan(1);
    expect(seen[seen.length - 1]).toBe(1);
  });
});
