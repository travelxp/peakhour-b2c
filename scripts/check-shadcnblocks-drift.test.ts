import { describe, it, expect } from "vitest";
import { candidateNames, classify, normalise, pickContent, type DriftConfig } from "./check-shadcnblocks-drift";

const config: DriftConfig = {
  localOnly: { item: "none" },
  allowlist: { "chart-card15": "lint fixes" },
};

describe("normalise", () => {
  it("ignores CRLF, trailing whitespace and extra blank lines", () => {
    expect(normalise("a  \r\n\r\n\r\n\r\nb\r\n")).toBe(normalise("a\n\nb"));
  });
  it("maps cn and registry import paths to local ones", () => {
    const remote = 'import { cn } from "cn";\nimport { X } from "@/components/diceui/x";\nimport { Y } from "@/components/shadcnblocks/y";';
    const local = 'import { cn } from "@/lib/utils";\nimport { X } from "@/components/blocks/x";\nimport { Y } from "@/components/blocks/y";';
    expect(normalise(remote)).toBe(normalise(local));
  });
  it("still sees a real code change", () => {
    expect(normalise("<Button>Skip</Button>")).not.toBe(normalise("<Button>Later</Button>"));
  });
});

describe("candidateNames", () => {
  it("tries the plain name then the first-segment-prefixed one", () => {
    expect(candidateNames("stat-delta-1")).toEqual(["stat-delta-1", "stat-stat-delta-1"]);
    expect(candidateNames("stepper-onboarding-1")[1]).toBe("stepper-stepper-onboarding-1");
  });
});

describe("classify", () => {
  it("local-only wins without a remote", () => expect(classify("item", "x", null, config)).toBe("local-only"));
  it("identical after normalisation", () => expect(classify("a", "x\r\n", "x\n", config)).toBe("identical"));
  it("differs", () => expect(classify("a", "x", "y", config)).toBe("differs"));
  it("allowlisted difference is not a failure status", () => expect(classify("chart-card15", "x", "y", config)).toBe("allowlisted"));
  it("not-found when no item resolves", () => expect(classify("a", "x", null, config)).toBe("not-found"));
});

describe("pickContent", () => {
  it("prefers the file with the matching basename", () => {
    const item = { files: [{ path: "a/other.tsx", content: "1" }, { path: "b/chart.tsx", content: "2" }] };
    expect(pickContent(item, "chart.tsx")).toBe("2");
    expect(pickContent(item, "none.tsx")).toBe("1");
    expect(pickContent({}, "x.tsx")).toBeNull();
  });
});
