import { describe, expect, it } from "vitest";
import { finishedJobs, jobLine, studioJobs, workHref } from "./studio-strip";

const row = (over: Record<string, unknown> = {}) => ({
  _id: "j1",
  kind: "creative_previews",
  displayName: "Making your previews",
  progress: { totalUnits: 4, processedUnits: 2 },
  ...over,
});

describe("the running-jobs strip (4.4)", () => {
  it("keeps only Studio's jobs, with the api's own plain name for each", () => {
    const jobs = studioJobs([row(), row({ _id: "j2", kind: "content_analyse" }), row({ _id: "j3", kind: "creative_extend", displayName: "Making more background" })]);
    expect(jobs.map((j) => [j.id, j.kind])).toEqual([
      ["j1", "previews"],
      ["j3", "extend"],
    ]);
  });

  it("reads 'Making your previews · 2 of 4 ready'", () => {
    expect(jobLine(studioJobs([row()])[0]!)).toBe("Making your previews · 2 of 4 ready");
  });

  it("falls back to its own name when the api names none, and to the name alone while no count is known", () => {
    const j = studioJobs([row({ displayName: undefined, kind: "creative_final", progress: undefined })])[0]!;
    expect(jobLine(j)).toBe("Making your finals…");
  });

  it("never shows more done than the total, or a negative count", () => {
    const j = studioJobs([row({ progress: { totalUnits: 3, processedUnits: 9 } })])[0]!;
    expect(j.done).toBe(3);
    expect(studioJobs([row({ progress: { totalUnits: 3, processedUnits: -1 } })])[0]!.done).toBe(0);
  });

  it("names the jobs that have left the running list", () => {
    const before = studioJobs([row(), row({ _id: "j2" })]);
    const now = studioJobs([row({ _id: "j2" })]);
    expect(finishedJobs(before, now).map((j) => j.id)).toEqual(["j1"]);
    expect(finishedJobs(before, before)).toEqual([]);
  });

  it("carries the creative a job names, and none for an older row", () => {
    const jobs = studioJobs([row({ creativeId: "c1" }), row({ _id: "j2" })]);
    expect(jobs.map((j) => j.creativeId)).toEqual(["c1", null]);
  });

  it("finals show on the Shortlist; the rest on the creative the job names, and on the Studio home when it names none", () => {
    const paths = { home: "/h", shortlist: "/s", creative: (id: string) => `/c/${id}` };
    expect(workHref("final", "c1", paths)).toBe("/s");
    expect(workHref("previews", "c1", paths)).toBe("/c/c1");
    expect(workHref("extend", null, paths)).toBe("/h");
  });
});
