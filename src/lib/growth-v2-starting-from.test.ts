/**
 * PL-7: the words for where a starting number came from. ★WHAT ONLY THIS TEST CAN GET WRONG: that a band is said as its floor and never
 * as a count; that the pooled sentence is built from the band and the industry's word and reads whole without either; that a line and a
 * playbook name themselves and an unnamed one is a starting guess; and that the weakest layer is the only "Starting guess" of a named layer.
 */
import { describe, it, expect } from "vitest";
import { bandWord, startingFromWords } from "./growth-v2-starting-from";

describe("startingFromWords", () => {
  it("own results", () => {
    expect(startingFromWords({ layer: "own", n: 30 })).toBe("Starting from your own results");
  });

  it("pooled: the band's floor and the industry's word", () => {
    expect(startingFromWords({ layer: "pooled", band: "20-49", industry: "travel" })).toBe("Starting from 20+ travel businesses like yours");
    expect(startingFromWords({ layer: "pooled", band: "50-99", industry: "travel_hotels" })).toBe("Starting from 50+ hotel businesses like yours");
    expect(startingFromWords({ layer: "pooled", band: "100+", industry: "fashion" })).toBe("Starting from 100+ fashion businesses like yours");
    expect(startingFromWords({ layer: "pooled", band: "20-49", industry: "saas" })).toBe("Starting from 20+ software businesses like yours");
  });

  it("pooled reads whole with the band or the industry missing, or an industry it has no word for", () => {
    expect(startingFromWords({ layer: "pooled", band: "20-49" })).toBe("Starting from 20+ businesses like yours");
    expect(startingFromWords({ layer: "pooled", industry: "travel" })).toBe("Starting from travel businesses like yours");
    expect(startingFromWords({ layer: "pooled" })).toBe("Starting from businesses like yours");
    expect(startingFromWords({ layer: "pooled", band: "20-49", industry: "other" })).toBe("Starting from 20+ businesses like yours");
    expect(startingFromWords({ layer: "pooled", band: "20-49", industry: "unheard_of" })).toBe("Starting from 20+ businesses like yours");
  });

  it("never shows a number that is not a band's floor", () => {
    expect(bandWord("20-49")).toBe("20+");
    expect(bandWord("50-99")).toBe("50+");
    expect(bandWord("100+")).toBe("100+");
    expect(bandWord("37")).toBeUndefined();
    expect(bandWord(undefined)).toBeUndefined();
    expect(startingFromWords({ layer: "pooled", band: "37", industry: "travel" })).toBe("Starting from travel businesses like yours");
  });

  it("a line or a playbook names itself; an unnamed one is a starting guess", () => {
    expect(startingFromWords({ layer: "line", label: "Hotels" })).toBe("Starting from the Hotels playbook");
    expect(startingFromWords({ layer: "playbook", label: "Travel, India" })).toBe("Starting from the Travel, India playbook");
    expect(startingFromWords({ layer: "playbook" })).toBe("Starting guess");
    expect(startingFromWords({ layer: "line", label: "  " })).toBe("Starting guess");
  });

  it("the weakest layer is a starting guess, whatever it carries", () => {
    expect(startingFromWords({ layer: "everyone", band: "100+", industry: "travel" })).toBe("Starting guess");
  });

  it("a guess carries its own sentence (PL-5), whatever layer it names", () => {
    expect(startingFromWords({ layer: "playbook", reason: "Peakhour has no plan yet for a business like yours." })).toBe("Peakhour has no plan yet for a business like yours.");
    expect(startingFromWords({ layer: "everyone", reason: "Our general plan." })).toBe("Our general plan.");
  });

  it("says nothing when the api sent nothing", () => {
    expect(startingFromWords(undefined)).toBeUndefined();
  });
});
