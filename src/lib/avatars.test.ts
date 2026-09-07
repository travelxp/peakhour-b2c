import { describe, it, expect } from "vitest";
import {
  CHARACTER_VARIANTS,
  MONOGRAM_VARIANTS,
  defaultMonogramId,
  initialsOf,
  resolveAvatar,
} from "./avatars";

/**
 * `resolveAvatar` being TOTAL is the contract that lets the api store a loose
 * pattern instead of an enum: retiring a character has to be a change in
 * avatars.ts alone, and the users who had picked it degrade to their initials
 * rather than to an empty circle. Most of these tests are that guarantee.
 */
describe("resolveAvatar", () => {
  it("resolves a known monogram", () => {
    const r = resolveAvatar("monogram:violet", "a@b.com");
    expect(r.family).toBe("monogram");
    expect(r.variant.id).toBe("violet");
  });

  it("resolves a known character", () => {
    const r = resolveAvatar("character:fox", "a@b.com");
    expect(r.family).toBe("character");
    expect(r.variant.id).toBe("fox");
  });

  it("falls back to the seeded monogram for null, empty and malformed tokens", () => {
    const expected = defaultMonogramId("a@b.com");
    for (const token of [null, undefined, "", "nonsense", "monogram", ":", "::"]) {
      const r = resolveAvatar(token, "a@b.com");
      expect(r.family).toBe("monogram");
      expect(r.variant.id).toBe(expected);
    }
  });

  it("falls back for an unknown family", () => {
    expect(resolveAvatar("bitmoji:whatever", "a@b.com").family).toBe("monogram");
  });

  it("falls back for a retired variant rather than returning nothing", () => {
    // The whole reason the stored value is a pattern and not an enum.
    const r = resolveAvatar("character:dodo", "a@b.com");
    expect(r.family).toBe("monogram");
    expect(r.variant.id).toBe(defaultMonogramId("a@b.com"));
  });
});

describe("defaultMonogramId", () => {
  it("is stable for a given seed", () => {
    expect(defaultMonogramId("a@b.com")).toBe(defaultMonogramId("a@b.com"));
  });

  it("always names a real variant", () => {
    const ids = new Set(MONOGRAM_VARIANTS.map((v) => v.id));
    for (const seed of ["", "a", "a@b.com", "ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ", "🙂"]) {
      expect(ids.has(defaultMonogramId(seed))).toBe(true);
    }
  });

  it("spreads different seeds across colours", () => {
    // Always-amber would make a team page a column of identical tiles, which is
    // the one job an avatar has.
    const seeds = ["ann@x.com", "bob@x.com", "cara@x.com", "dev@x.com", "eve@x.com", "fay@x.com"];
    expect(new Set(seeds.map(defaultMonogramId)).size).toBeGreaterThan(1);
  });
});

describe("initialsOf", () => {
  it("takes up to two initials from a name", () => {
    expect(initialsOf("Prashant Chothani")).toBe("PC");
    expect(initialsOf("Ada")).toBe("A");
    expect(initialsOf("Jean Luc Picard")).toBe("JL");
  });

  it("ignores extra whitespace", () => {
    expect(initialsOf("  Ada   Lovelace  ")).toBe("AL");
  });

  it("falls back to the email when there is no name", () => {
    expect(initialsOf(null, "zoe@example.com")).toBe("Z");
    expect(initialsOf("", "zoe@example.com")).toBe("Z");
    expect(initialsOf("   ", "zoe@example.com")).toBe("Z");
  });

  it("returns a question mark when there is nothing at all", () => {
    expect(initialsOf(null, null)).toBe("?");
  });

  it("keeps astral characters whole", () => {
    // `name[0]` on a surrogate pair yields half of it, which renders as U+FFFD
    // — a replacement glyph, for exactly the users the product already
    // struggles to display.
    expect(initialsOf("🦊 Fox Studio")).toBe("🦊F");
    expect(initialsOf("𝒜lpha Beta")).toBe("𝒜B");
  });
});

describe("the registries", () => {
  it("have unique ids within each family", () => {
    // resolveAvatar finds by id; a duplicate would silently make one variant
    // unreachable from Settings.
    expect(new Set(MONOGRAM_VARIANTS.map((v) => v.id)).size).toBe(MONOGRAM_VARIANTS.length);
    expect(new Set(CHARACTER_VARIANTS.map((v) => v.id)).size).toBe(CHARACTER_VARIANTS.length);
  });

  it("only use ids the api's pattern accepts", () => {
    // peakhour-mongodb and peakhour-api both hold
    // /^(monogram|character):[a-z0-9-]{1,32}$/. A variant id outside it would
    // be a 400 on save, discovered only by a user clicking the tile.
    const ok = /^[a-z0-9-]{1,32}$/;
    for (const v of [...MONOGRAM_VARIANTS, ...CHARACTER_VARIANTS]) {
      expect(ok.test(v.id), v.id).toBe(true);
    }
  });
});
