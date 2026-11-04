import { describe, expect, it } from "vitest";
import { adapterChannel, anyVerdict, fitNote, orderByFit, targetLabel } from "./fit";
import type { DriveFile } from "./files";

type F = Pick<DriveFile, "channelFit" | "describeState"> & { id: string };
const f = (id: string, channelFit?: DriveFile["channelFit"], describeState?: string): F => ({ id, channelFit, describeState });

describe("what a file says for the place it is going", () => {
  it("good fits, a possible fit asks for a check, a poor fit says so, and each carries the api's own reason", () => {
    expect(fitNote(f("a", [{ channel: "instagram", fit: "good" }]), "instagram")).toMatchObject({ label: "Fits", tone: "good", rank: 0 });
    expect(fitNote(f("a", [{ channel: "instagram", fit: "possible", reason: "Size could not be measured" }]), "instagram")).toMatchObject({
      label: "Check before using",
      tone: "warn",
      rank: 1,
      reason: "Size could not be measured",
    });
    expect(fitNote(f("a", [{ channel: "instagram", fit: "poor", reason: "Instagram takes shapes from 0.8:1 to 1.91:1" }]), "instagram")).toMatchObject({
      label: "Doesn't fit",
      rank: 3,
      reason: "Instagram takes shapes from 0.8:1 to 1.91:1",
    });
  });

  it("reads only the target channel's verdict, not another channel's", () => {
    const file = f("a", [{ channel: "linkedin", fit: "good" }]);
    expect(fitNote(file, "instagram").verdict).toBe("unchecked");
    expect(fitNote(file, "linkedin").verdict).toBe("good");
  });

  it("a file the describer has not reached is 'Not checked yet', or 'Checking fit' while it is being described; neither claims a verdict", () => {
    expect(fitNote(f("a"), "instagram")).toMatchObject({ label: "Not checked yet", verdict: "unchecked" });
    expect(fitNote(f("a", undefined, "pending"), "instagram")).toMatchObject({ label: "Checking fit…", verdict: "checking" });
    expect(fitNote(f("a", undefined, "describing"), "instagram").verdict).toBe("checking");
    // a file that was described and FAILED is not "checking" for ever
    expect(fitNote(f("a", undefined, "failed"), "instagram").verdict).toBe("unchecked");
  });

  it("with no place named there is nothing to say", () => {
    expect(fitNote(f("a", [{ channel: "instagram", fit: "poor" }]), undefined)).toMatchObject({ label: "", verdict: "none" });
  });

  it("scheduler names map to the api's adapter keys", () => {
    expect(adapterChannel("beehiiv")).toBe("newsletter");
    expect(adapterChannel("Google_Business")).toBe("googlebusiness");
    expect(adapterChannel("instagram")).toBe("instagram");
    expect(fitNote(f("a", [{ channel: "newsletter", fit: "good" }]), "beehiiv").verdict).toBe("good");
  });
});

describe("ordering", () => {
  const ids = (xs: F[]) => xs.map((x) => x.id);

  it("fits first, then maybe, then not-checked, then doesn't fit; equal fits keep the api's (newest first) order", () => {
    const files = [
      f("poor1", [{ channel: "instagram", fit: "poor" }]),
      f("none1"),
      f("good1", [{ channel: "instagram", fit: "good" }]),
      f("maybe1", [{ channel: "instagram", fit: "possible" }]),
      f("good2", [{ channel: "instagram", fit: "good" }]),
      f("none2"),
    ];
    expect(ids(orderByFit(files, "instagram"))).toEqual(["good1", "good2", "maybe1", "none1", "none2", "poor1"]);
  });

  it("with no place named the order is untouched, and the input is never mutated", () => {
    const files = [f("a", [{ channel: "instagram", fit: "poor" }]), f("b", [{ channel: "instagram", fit: "good" }])];
    expect(ids(orderByFit(files, undefined))).toEqual(["a", "b"]);
    orderByFit(files, "instagram");
    expect(ids(files)).toEqual(["a", "b"]);
  });

  it("'fits first' is a claim the grid keeps only when at least one file has a verdict", () => {
    expect(anyVerdict([f("a"), f("b", undefined, "pending")], "instagram")).toBe(false);
    expect(anyVerdict([f("a"), f("b", [{ channel: "instagram", fit: "poor" }])], "instagram")).toBe(true);
    expect(anyVerdict([f("a", [{ channel: "instagram", fit: "good" }])], undefined)).toBe(false);
  });
});

describe("the words for where a file is going", () => {
  it("uses an or a by the first letter of the name", () => {
    expect(targetLabel("Instagram")).toBe("an Instagram post");
    expect(targetLabel("LinkedIn")).toBe("a LinkedIn post");
  });
});
