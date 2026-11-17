// @vitest-environment jsdom
/**
 * The CMS Schedules page, rendered from contract fixtures (GET /v1/cms/schedules and
 * /v1/cms/schedules/:name/runs). No schedule name is hardcoded in the page: the
 * labels, areas and cadences come from the api, so the fixtures here carry them.
 * The hooks are replaced; nothing reaches the network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type {
  ScheduleRow,
  ScheduleRun,
  SchedulesResponse,
} from "@/hooks/use-schedules";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let listAnswer: { data?: SchedulesResponse; isPending: boolean; error: Error | null; errorUpdatedAt: number };
let runsAnswer: { data?: { schedule: { name: string; label: string }; runs: ScheduleRun[] }; isPending: boolean; error: Error | null };
const runsCalls: Array<[string | null | undefined, number | undefined]> = [];

vi.mock("@/hooks/use-schedules", async (orig) => {
  const real = await orig<typeof import("@/hooks/use-schedules")>();
  return {
    ...real,
    useCmsSchedules: () => listAnswer,
    useCmsScheduleRuns: (name: string | null | undefined, limit?: number) => {
      runsCalls.push([name, limit]);
      return runsAnswer;
    },
  };
});
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const { default: Page } = await import("./page");

const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();

function row(over: Partial<ScheduleRow> & Pick<ScheduleRow, "name" | "label" | "status">): ScheduleRow {
  return {
    description: `About ${over.label}`,
    area: "alpha",
    cron: "*/15 * * * *",
    cadence: "Every 15 minutes",
    slotGated: false,
    devEnabled: null,
    nextRunAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    lastStartedAt: iso(10),
    lastFinishedAt: iso(9),
    lastHttpStatus: 200,
    lastDurationMs: 1200,
    lastFailedSteps: [],
    consecutiveFailures: 0,
    runs24h: 96,
    failures24h: 0,
    ...over,
  };
}

const ROWS: ScheduleRow[] = [
  row({ name: "zz-healthy-one", label: "Zed healthy", status: "healthy" }),
  row({ name: "aa-failing-one", label: "Aye failing", status: "failing", area: "beta", lastHttpStatus: 500, lastFailedSteps: ["step-x", "step-y"], consecutiveFailures: 3, failures24h: 4 }),
  row({ name: "mm-stuck-one", label: "Em stuck", status: "did_not_finish", area: "beta" }),
  row({ name: "bb-running-one", label: "Bee running", status: "running" }),
  row({ name: "cc-never-one", label: "Cee never", status: "never_ran", lastStartedAt: null, lastFinishedAt: null, lastHttpStatus: null, lastDurationMs: null, runs24h: 0 }),
];

function response(environment: "production" | "dev", schedules: ScheduleRow[] = ROWS): SchedulesResponse {
  return {
    environment,
    areas: [{ area: "beta", label: "Beta area" }, { area: "alpha", label: "Alpha area" }],
    schedules,
  };
}

const RUN_FAILED: ScheduleRun = { startedAt: iso(30), finishedAt: iso(29), durationMs: 2500, httpStatus: 500, outcome: "failed", failedSteps: ["step-x"], executionId: "e1", trigger: "vercel" };
const RUN_OK: ScheduleRun = { startedAt: iso(45), finishedAt: iso(44), durationMs: 800, httpStatus: 200, outcome: "succeeded", failedSteps: [], executionId: "e2", trigger: "vercel" };

let root: Root | undefined;
let host: HTMLElement | undefined;

function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Page />));
}

beforeEach(() => {
  runsCalls.length = 0;
  listAnswer = { data: response("production"), isPending: false, error: null, errorUpdatedAt: 0 };
  runsAnswer = { data: { schedule: { name: "aa-failing-one", label: "Aye failing" }, runs: [RUN_FAILED, RUN_OK] }, isPending: false, error: null };
});
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = undefined;
  document.body.innerHTML = "";
});

const names = () => Array.from(host!.querySelectorAll("tbody tr td:first-child .font-mono")).map((e) => e.textContent);
const body = () => document.body.textContent ?? "";

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("CMS schedules page", () => {
  it("shows each result badge, with the api's labels", () => {
    listAnswer = { data: response("dev", [...ROWS, row({ name: "dd-off-one", label: "Dee off", status: "healthy", devEnabled: false })]), isPending: false, error: null, errorUpdatedAt: 0 };
    mount();
    const table = host!.querySelector("table")!.textContent!;
    for (const label of ["Healthy", "Failing", "Didn't finish", "Running", "Never ran", "Off on dev"]) {
      expect(table).toContain(label);
    }
    // friendly label and the technical name below it
    expect(table).toContain("Aye failing");
    expect(table).toContain("aa-failing-one");
    // the area label comes from the api
    expect(table).toContain("Beta area");
  });

  it("sorts Failing and Didn't finish first", () => {
    mount();
    expect(names().slice(0, 2)).toEqual(["aa-failing-one", "mm-stuck-one"]);
    expect(names()[names().length - 1]).toBe("zz-healthy-one");
  });

  it("production: says Production, and has no dev chip or dev badge", () => {
    mount();
    expect(body()).toContain("Production");
    expect(body()).not.toContain("Off on dev");
    expect(body()).not.toContain("Dev: only schedules");
  });

  it("dev: names the environment, shows the Off on dev chip and badge, and counts it apart", () => {
    listAnswer = { data: response("dev", [...ROWS, row({ name: "dd-off-one", label: "Dee off", status: "healthy", devEnabled: false })]), isPending: false, error: null, errorUpdatedAt: 0 };
    mount();
    expect(body()).toContain("Dev: only schedules switched on for dev run here");
    const chip = Array.from(host!.querySelectorAll("button")).find((b) => b.textContent?.startsWith("Off on dev"))!;
    expect(chip.textContent).toContain("1");
    const healthy = Array.from(host!.querySelectorAll("button")).find((b) => b.textContent?.startsWith("Healthy"))!;
    expect(healthy.textContent).toContain("1"); // the off-on-dev row is not counted healthy
  });

  it("searches by the technical name and by the label", () => {
    mount();
    const input = host!.querySelector("input")!;
    type(input, "mm-stuck");
    expect(names()).toEqual(["mm-stuck-one"]);
    type(input, "bee run");
    expect(names()).toEqual(["bb-running-one"]);
    type(input, "nothing-like-this");
    expect(host!.textContent).toContain("No schedules match these filters.");
  });

  it("filters by status from a summary chip", () => {
    mount();
    const chip = Array.from(host!.querySelectorAll("button")).find((b) => b.textContent?.startsWith("Failing"))!;
    act(() => chip.click());
    expect(names()).toEqual(["aa-failing-one"]);
  });

  it("opens the sheet on a row click: runs list, failed steps, copy command", () => {
    mount();
    const tr = Array.from(host!.querySelectorAll("tbody tr")).find((r) => r.textContent?.includes("aa-failing-one"))!;
    act(() => (tr as HTMLElement).click());
    expect(runsCalls.at(-1)).toEqual(["aa-failing-one", 50]);
    const sheet = document.querySelector('[role="dialog"]')!;
    const text = sheet.textContent!;
    expect(text).toContain("About Aye failing");
    expect(text).toContain("Last failed steps");
    expect(text).toContain("step-x");
    expect(text).toContain("step-y");
    // two runs: duration, http status, outcome, failed steps
    expect(sheet.querySelectorAll("tbody tr").length).toBe(2);
    expect(text).toContain("2.50s");
    expect(text).toContain("500");
    expect(text).toContain("Failed");
    expect(text).toContain("Succeeded");
    expect(text).toContain("vercel schedules invoke aa-failing-one");
    expect(text).not.toContain("--git-branch");
    expect(text).not.toMatch(/run now/i);
  });

  it("dev: the copied command adds --git-branch master", () => {
    listAnswer = { data: response("dev"), isPending: false, error: null, errorUpdatedAt: 0 };
    mount();
    const tr = Array.from(host!.querySelectorAll("tbody tr")).find((r) => r.textContent?.includes("aa-failing-one"))!;
    act(() => (tr as HTMLElement).click());
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain("vercel schedules invoke aa-failing-one --git-branch master");
  });

  it("says so when a schedule has no runs yet", () => {
    runsAnswer = { data: { schedule: { name: "cc-never-one", label: "Cee never" }, runs: [] }, isPending: false, error: null };
    mount();
    const tr = Array.from(host!.querySelectorAll("tbody tr")).find((r) => r.textContent?.includes("cc-never-one"))!;
    act(() => (tr as HTMLElement).click());
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain("No runs recorded");
  });
});
