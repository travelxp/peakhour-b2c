// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  post: vi.fn(),
  patch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number,
    ) {
      super(message);
    }
  }
  return { api: { post: h.post, patch: h.patch, delete: vi.fn() }, ApiError };
});
vi.mock("sonner", () => ({ toast: { success: h.success, error: h.error } }));
vi.mock("@/components/molecules/reject-reason-dialog", () => ({ RejectReasonDialog: () => null }));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: unknown }) => <>{children as never}</>,
  DropdownMenuTrigger: ({ children }: { children: unknown }) => <>{children as never}</>,
  DropdownMenuContent: () => null,
  DropdownMenuItem: () => null,
  DropdownMenuSeparator: () => null,
}));

const { SourceRow } = await import("./source-row");
const { ApiError } = await import("@/lib/api");
type Src = import("../types").TrustedSource;

const BASE: Src = {
  _id: "s1",
  orgId: "o",
  businessId: "b",
  type: "x_handle",
  identifier: "@rosshbaines",
  displayName: "Ross Baines",
  origin: "ai_suggested",
  status: "active",
  trustScore: 0.5,
  fetchFrequency: "daily",
};
const ISSUE = {
  kind: "not_found" as const,
  permanent: true,
  message: "X handle @rosshbaines not found",
  firstSeenAt: "2026-05-12T10:00:00Z",
  lastSeenAt: "2026-11-17T10:00:00Z",
  notifiedAt: null,
  suggestedFix: {
    kind: "replace_handle" as const,
    value: "@rossbaines",
    reason: "Ross Baines is @rossbaines",
  },
};

let root: Root;
let container: HTMLDivElement;

function render(source: Src, highlighted = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={qc}>
        <SourceRow source={source} highlighted={highlighted} />
      </QueryClientProvider>,
    );
  });
}
const button = (label: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.clearAllMocks();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("SourceRow fetch problems", () => {
  it("renders as before when the new fields are absent", () => {
    render(BASE);
    expect(container.textContent).not.toContain("can't read");
    expect(button("Apply fix")).toBeUndefined();
    expect(container.querySelector("[data-highlighted]")).toBeNull();
  });

  it("shows the problem line and suggested fix", () => {
    render({ ...BASE, fetchIssue: ISSUE });
    expect(container.textContent).toContain("X handle @rosshbaines not found");
    expect(container.textContent).toContain("since 12 May");
    expect(container.textContent).toContain("Suggested fix: Ross Baines is @rossbaines");
    expect(button("Apply fix")).toBeDefined();
  });

  it("no Apply fix button without a suggestion", () => {
    render({ ...BASE, fetchIssue: { ...ISSUE, suggestedFix: null } });
    expect(container.textContent).toContain("not found");
    expect(button("Apply fix")).toBeUndefined();
  });

  it("applies the fix and toasts", async () => {
    h.post.mockResolvedValue({});
    render({ ...BASE, fetchIssue: ISSUE });
    await act(async () => button("Apply fix")!.click());
    expect(h.post).toHaveBeenCalledWith("/v1/sources/trusted/s1/apply-fix", {});
    expect(h.success).toHaveBeenCalled();
  });

  it("409 says the fix is no longer available", async () => {
    h.post.mockRejectedValue(new ApiError("CONFLICT", "no fix", 409));
    render({ ...BASE, fetchIssue: ISSUE });
    await act(async () => button("Apply fix")!.click());
    expect(h.error).toHaveBeenCalledWith("That fix is no longer available");
  });

  it("shows the paused state and turns the source back on", async () => {
    h.patch.mockResolvedValue({});
    render({
      ...BASE,
      status: "inactive",
      inactiveReason: "fetch_failing",
      fetchIssue: { ...ISSUE, suggestedFix: null },
    });
    expect(container.textContent).toContain("Paused: we couldn't reach it");
    expect(container.textContent).toContain("X handle @rosshbaines not found");
    await act(async () => button("Turn back on")!.click());
    expect(h.patch).toHaveBeenCalledWith("/v1/sources/trusted/s1", { status: "active" });
  });

  it("a user-paused source is not shown as unreachable", () => {
    render({ ...BASE, status: "inactive", inactiveReason: "user" });
    expect(container.textContent).not.toContain("Paused: we couldn't");
  });

  it("highlights the linked source", () => {
    render(BASE, true);
    const el = container.querySelector("#source-s1");
    expect(el?.getAttribute("data-highlighted")).toBe("true");
  });
});
