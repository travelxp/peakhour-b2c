// @vitest-environment jsdom
/**
 * The review screen for one repurposed batch (W2-G): each channel's text and media, what approving does PER VARIANT,
 * Approve and Reject (each behind a confirm, one decision at a time), the role floor, and the sentence for a batch that can
 * no longer be decided here. A decision posts to the api's approve / reject route and nothing else.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RepurposedBatch, VariantEffect } from "@/hooks/use-repurposed-batch";

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  role: "editor" as string,
}));

vi.mock("@/lib/api", () => ({
  api: { get: h.get, post: h.post },
  API_BASE_URL: "https://api.example",
  ApiError: class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));
vi.mock("sonner", () => ({ toast: { success: h.success, error: h.error, info: h.info } }));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ org: { _id: "o1" }, orgs: [{ _id: "o1", role: h.role }] }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { RepurposedReview, closedSentence, approveSummary } = await import("./repurposed-review");
const { homeSummaryKey } = await import("@/hooks/use-home-summary");
const { needsOkKeys } = await import("@/hooks/use-needs-ok");

const effect = (over: Partial<VariantEffect> & Pick<VariantEffect, "platform">): VariantEffect => ({
  channel: over.platform,
  outcome: "will_publish",
  via: "calendar",
  reason: null,
  ...over,
});
const batch = (over: Partial<RepurposedBatch> = {}): RepurposedBatch => ({
  id: "b1",
  title: "Monsoon menu ideas",
  status: "pending_approval",
  createdAt: null,
  expiresAt: null,
  decidedVia: null,
  canDecide: true,
  approveEffect: [effect({ platform: "linkedin", via: "approval_flow" }), effect({ platform: "x" })],
  mediaUrls: ["https://cdn.example.com/a.png", "https://cdn.example.com/b.png"],
  variants: [
    { platform: "linkedin", text: "LinkedIn text", hook: null, hashtags: ["#menu"], firstComment: null },
    { platform: "x", text: "X text", hook: null, hashtags: [], firstComment: null },
  ],
  ...over,
});

// The api's rules table says which channels take a first comment and how long it may be: LinkedIn and X do here, Threads does not.
const RULES = { rules: [{ key: "post:linkedin", label: "a LinkedIn post", firstComment: { maxLength: 1250 } }, { key: "post:x", label: "a post on X", firstComment: { maxLength: 280 } }, { key: "post:threads", label: "a Threads post" }] };
/** Every get answers with `batch`, except the rules table. */
const serve = (value: unknown) => h.get.mockImplementation(async (url: string) => (String(url).includes("/v1/media/rules") ? RULES : value));

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  h.success.mockReset();
  h.error.mockReset();
  h.info.mockReset();
  h.role = "editor";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
async function mount(id = "b1") {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <RepurposedReview id={id} />
      </QueryClientProvider>,
    );
  });
  await flush();
}
const dialog = () => document.querySelector("[role=alertdialog]") as HTMLElement;
const button = (label: string, scope: ParentNode = document) =>
  [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined;
const approveThroughDialog = async (label = "Approve") => {
  await act(async () => button(label, container)!.click());
  await act(async () => button(label, dialog())!.click());
  await flush();
  await flush(); // the focus move is a timeout of its own
};
const { ApiError } = await import("@/lib/api");

describe("RepurposedReview", () => {
  it("shows each channel's text and media, and per variant what approving does", async () => {
    serve(batch());
    await mount();
    expect([...container.querySelectorAll("h2")].map((e) => e.textContent)).toEqual(["LinkedIn", "X"]);
    expect(container.textContent).toContain("LinkedIn text");
    const lines = [...container.querySelectorAll("[data-effect]")].map((e) => e.textContent);
    expect(lines[0]).toContain("publishes it to LinkedIn now");
    expect(lines[1]).toContain("queues it for the next few minutes");
    expect(container.textContent).toContain("Approving sends all 2 drafts out. Approving is free.");
    expect(container.textContent).toContain("reply YES on WhatsApp");
    expect(h.get).toHaveBeenCalledWith("/v1/content/repurposed/b1");
  });

  it("never says all of it goes out when part of it will not: names which variants, and why", async () => {
    serve(
      batch({
        approveEffect: [
          effect({ platform: "linkedin", via: "approval_flow" }),
          effect({ platform: "x", outcome: "not_connected", via: null, reason: "X is not connected, so it will not be published." }),
        ],
      }),
    );
    await mount();
    expect(container.textContent).toContain("Approving sends 1 of 2 drafts out");
    expect(container.textContent).not.toContain("sends all");
    const lines = [...container.querySelectorAll("[data-effect]")];
    expect(lines[1]!.getAttribute("data-effect")).toBe("not_connected");
    expect(lines[1]!.textContent).toBe("X is not connected, so it will not be published.");
  });

  it("when nothing can go out it says so", () => {
    expect(approveSummary([effect({ platform: "x", outcome: "not_allowed", via: null, reason: "r" })])).toContain("None of these drafts can go out");
  });

  it("Approve asks first, then posts to the approve route and shows the api's sentence", async () => {
    serve(batch());
    h.post.mockResolvedValue({ id: "b1", status: "approved", alreadyDecided: false, message: "Approved. Going out: LinkedIn, X.", variants: [] });
    await mount();
    await act(async () => button("Approve", container)!.click());
    expect(h.post).not.toHaveBeenCalled(); // the confirm is open, nothing sent yet
    await act(async () => button("Approve", dialog())!.click());
    await flush();
    expect(h.post).toHaveBeenCalledWith("/v1/content/repurposed/b1/approve");
    expect(h.success).toHaveBeenCalledWith("Approved. Going out: LinkedIn, X.");
  });

  it("Reject posts to the reject route", async () => {
    serve(batch());
    h.post.mockResolvedValue({ id: "b1", status: "discarded", alreadyDecided: false, message: "Rejected.", variants: [] });
    await mount();
    await approveThroughDialog("Reject");
    expect(h.post).toHaveBeenCalledWith("/v1/content/repurposed/b1/reject");
  });

  it("a refused decision shows the api's sentence as an error", async () => {
    serve(batch());
    h.post.mockRejectedValue(new ApiError("EXPIRED", "These drafts waited too long for an answer.", 409));
    await mount();
    await approveThroughDialog();
    expect(h.error).toHaveBeenCalledWith("These drafts waited too long for an answer.");
  });

  it("a batch already decided shows the sentence and no buttons", async () => {
    serve(batch({ status: "approved", decidedVia: "whatsapp", canDecide: false, approveEffect: [] }));
    await mount();
    expect(container.textContent).toContain("Approved on WhatsApp. Nothing more to do here.");
    expect(button("Approve", container)).toBeUndefined();
    expect(button("Reject", container)).toBeUndefined();
    expect(container.querySelector("[data-effect]")).toBeNull();
  });

  it("a batch past its window says so and offers no decision", async () => {
    serve(batch({ canDecide: false, approveEffect: [] }));
    await mount();
    expect(container.textContent).toContain("waited too long");
    expect(button("Approve", container)).toBeUndefined();
  });
});

describe("RepurposedReview, not found and load errors", () => {
  it.each([404, 400])("another business's batch or a malformed id (the api answers %i) is the not-found page with a way back", async (status) => {
    h.get.mockRejectedValue(new ApiError("NOT_FOUND", "That batch was not found for this business.", status));
    await mount();
    expect(container.textContent).toContain("Drafts not found");
    expect(container.querySelector('a[href="/dashboard/content/needs-ok"]')).not.toBeNull();
  });

  it("a dropped connection or a 500 is a try-again state, never 'not found'", async () => {
    h.get.mockRejectedValue(new ApiError("INTERNAL", "boom", 500));
    await mount();
    expect(container.textContent).toContain("Could not load these drafts");
    expect(container.textContent).not.toContain("Drafts not found");
    expect(button("Try again", container)).toBeDefined();
  });

  it("encodes the id in the url", async () => {
    serve(batch());
    await mount("../x");
    expect(h.get).toHaveBeenCalledWith("/v1/content/repurposed/..%2Fx");
  });
});

describe("★RepurposedReview, one decision at a time", () => {
  it("while a decision (and its refetch) is in flight both decision buttons are disabled, the area is aria-busy, and a second confirm is ignored", async () => {
    serve(batch());
    let release!: (v: unknown) => void;
    h.post.mockReturnValue(new Promise((r) => (release = r)));
    await mount();
    await act(async () => button("Approve", container)!.click());
    await act(async () => button("Approve", dialog())!.click()); // first confirm: now pending
    expect(h.post).toHaveBeenCalledTimes(1);
    expect(button("Approve", container)!.disabled).toBe(true);
    expect(button("Reject", container)!.disabled).toBe(true);
    expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
    // No second decision can be opened or confirmed meanwhile: both triggers are disabled and no dialog is open.
    await act(async () => button("Reject", container)!.click());
    expect(dialog()).toBeNull();
    expect(h.post).toHaveBeenCalledTimes(1);
    await act(async () => release({ id: "b1", status: "approved", alreadyDecided: false, message: "Approved.", variants: [] }));
    await flush();
  });

  it("the buttons stay disabled until the refetch after the decision lands", async () => {
    let refetches = 0;
    let finishRefetch!: (v: unknown) => void;
    h.get.mockImplementation((url: string) => {
      if (String(url).includes("/v1/media/rules")) return Promise.resolve(RULES);
      refetches++;
      if (refetches === 1) return Promise.resolve(batch());
      return new Promise((r) => (finishRefetch = r)); // the post-decision refetch, held
    });
    h.post.mockResolvedValue({ id: "b1", status: "approved", alreadyDecided: false, message: "Approved.", variants: [] });
    await mount();
    await act(async () => button("Approve", container)!.click());
    await act(async () => button("Approve", dialog())!.click());
    await flush();
    expect(h.post).toHaveBeenCalledTimes(1);
    expect(button("Approve", container)!.disabled).toBe(true); // refetch still in flight: still the old state, still locked
    await act(async () => finishRefetch(batch({ status: "approved", canDecide: false, approveEffect: [], decidedVia: "dashboard" })));
    await flush();
    expect(button("Approve", container)).toBeUndefined();
    expect(container.textContent).toContain("Approved. Nothing more to do here.");
  });

  it("an answer that nothing changed (already approved elsewhere) is shown as information, not as success", async () => {
    serve(batch());
    h.post.mockResolvedValue({ id: "b1", status: "approved", alreadyDecided: true, message: "Monsoon menu ideas is already approved. Nothing changed.", variants: [] });
    await mount();
    await approveThroughDialog();
    expect(h.info).toHaveBeenCalledWith("Monsoon menu ideas is already approved. Nothing changed.");
    expect(h.success).not.toHaveBeenCalled();
  });

  it("after a decision Needs your OK, this batch and Home's summary are all refetched", async () => {
    serve(batch());
    h.post.mockResolvedValue({ id: "b1", status: "discarded", alreadyDecided: false, message: "Rejected.", variants: [] });
    await mount();
    const spy = vi.spyOn(client, "invalidateQueries");
    await approveThroughDialog("Reject");
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(keys).toContain(JSON.stringify(homeSummaryKey));
    expect(keys).toContain(JSON.stringify(needsOkKeys.all));
    expect(keys).toContain(JSON.stringify(["repurposed-batch", "b1"]));
  });
});

describe("RepurposedReview, role", () => {
  it.each(["viewer", ""])("a %s sees the drafts and one line why there is no Approve or Reject", async (role) => {
    h.role = role;
    serve(batch());
    await mount();
    expect(container.textContent).toContain("LinkedIn text");
    expect(button("Approve", container)).toBeUndefined();
    expect(button("Reject", container)).toBeUndefined();
    expect(container.textContent).toContain("Only an editor, admin or owner can approve or reject");
  });

  it.each(["editor", "admin", "owner"])("%s may decide", async (role) => {
    h.role = role;
    serve(batch());
    await mount();
    expect(button("Approve", container)).toBeDefined();
  });
});

describe("RepurposedReview, accessibility", () => {
  it("pictures say which one of how many", async () => {
    serve(batch());
    await mount();
    expect([...container.querySelectorAll("img")].map((i) => i.getAttribute("alt"))).toEqual(["Picture 1 of 2", "Picture 2 of 2"]);
  });

  it("the polite live region exists before the result, then holds it, and focus moves to it", async () => {
    serve(batch());
    h.post.mockResolvedValue({ id: "b1", status: "approved", alreadyDecided: false, message: "Approved. Going out: X.", variants: [] });
    await mount();
    const region = container.querySelector("[role=status][aria-live=polite]") as HTMLElement;
    expect(region).not.toBeNull();
    expect(region.textContent).toBe(""); // mounted empty, so the later text is announced
    await approveThroughDialog();
    expect(container.querySelector("[role=status][aria-live=polite]")).toBe(region); // the same node, not a fresh one
    expect(region.textContent).toBe("Approved. Going out: X.");
    expect(document.activeElement).toBe(region);
  });

  it("a refusal is announced in the same region and takes focus", async () => {
    serve(batch());
    h.post.mockRejectedValue(new ApiError("CHANGED", "Just changed by someone else.", 409));
    await mount();
    await approveThroughDialog();
    const region = container.querySelector("[role=status][aria-live=polite]") as HTMLElement;
    expect(region.textContent).toBe("Just changed by someone else.");
    expect(document.activeElement).toBe(region);
  });
});

describe("closedSentence", () => {
  it.each([
    ["approved", "dashboard", "Approved. Nothing more to do here."],
    ["published", "whatsapp", "Approved on WhatsApp. Nothing more to do here."],
    ["discarded", null, "Rejected. Nothing goes out."],
    ["skipped", "whatsapp", "Rejected. Nothing goes out."],
    ["failed", null, "These drafts are no longer waiting for your approval."],
  ])("%s via %s", (status, via, want) => {
    expect(closedSentence(batch({ status, decidedVia: via, canDecide: false }))).toBe(want);
  });
});

describe("RepurposedReview: the first comment", () => {
  const withSuggestions = () =>
    batch({
      variants: [
        { platform: "linkedin", text: "LinkedIn text", hook: null, hashtags: [], firstComment: "Read more: https://example.com/menu" },
        { platform: "x", text: "X text", hook: null, hashtags: [], firstComment: null },
      ],
    });
  const boxes = () => [...container.querySelectorAll("[data-testid=first-comment-field] textarea")] as HTMLTextAreaElement[];
  const type = async (box: HTMLTextAreaElement, text: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(box, text);
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("prefills each box with the writer's suggestion, and leaves a channel with none empty", async () => {
    serve(withSuggestions());
    await mount();
    expect(boxes().map((b) => b.value)).toEqual(["Read more: https://example.com/menu", ""]);
  });

  it("shows no box for a channel that takes none", async () => {
    serve(
      batch({
        variants: [
          { platform: "threads", text: "T text", hook: null, hashtags: [], firstComment: null },
          { platform: "x", text: "X text", hook: null, hashtags: [], firstComment: null },
        ],
        approveEffect: [],
      }),
    );
    await mount();
    expect(boxes()).toHaveLength(1);
  });

  it("approving with the suggestion untouched sends the same request it always did, with no body", async () => {
    serve(withSuggestions());
    h.post.mockResolvedValue({ id: "b1", status: "approved", alreadyDecided: false, message: "Approved.", variants: [] });
    await mount();
    await approveThroughDialog();
    expect(h.post).toHaveBeenCalledWith("/v1/content/repurposed/b1/approve");
  });

  it("an edit goes with the approval for its own channel only", async () => {
    serve(withSuggestions());
    h.post.mockResolvedValue({ id: "b1", status: "approved", alreadyDecided: false, message: "Approved.", variants: [] });
    await mount();
    await type(boxes()[1]!, "What do you steep?");
    await approveThroughDialog();
    expect(h.post).toHaveBeenLastCalledWith("/v1/content/repurposed/b1/approve", { firstComments: { x: "What do you steep?" } });
  });

  it("clearing the suggestion is sent as a blank, so nothing is posted", async () => {
    serve(withSuggestions());
    h.post.mockResolvedValue({ id: "b1", status: "approved", alreadyDecided: false, message: "Approved.", variants: [] });
    await mount();
    await type(boxes()[0]!, "");
    await approveThroughDialog();
    expect(h.post).toHaveBeenLastCalledWith("/v1/content/repurposed/b1/approve", { firstComments: { linkedin: "" } });
  });

  it("a comment over the channel's limit shows how far over and holds the Approve button", async () => {
    serve(withSuggestions());
    await mount();
    await type(boxes()[1]!, "w".repeat(285));
    expect(container.textContent).toContain("5 over the 280 characters this channel takes");
    expect(button("Approve", container)!.disabled).toBe(true);
    await type(boxes()[1]!, "w".repeat(280));
    expect(button("Approve", container)!.disabled).toBe(false);
  });

  it("Reject sends no first comments, and a batch that can no longer be decided shows no boxes", async () => {
    serve(withSuggestions());
    h.post.mockResolvedValue({ id: "b1", status: "discarded", alreadyDecided: false, message: "Rejected.", variants: [] });
    await mount();
    await type(boxes()[1]!, "typed then rejected");
    await act(async () => button("Reject", container)!.click());
    await act(async () => button("Reject", dialog())!.click());
    await flush();
    expect(h.post).toHaveBeenLastCalledWith("/v1/content/repurposed/b1/reject");

    act(() => root.unmount());
    root = createRoot(container);
    serve({ ...withSuggestions(), canDecide: false, approveEffect: [], status: "approved" });
    await mount();
    expect(boxes()).toHaveLength(0);
  });

  it("a viewer who cannot approve sees no boxes", async () => {
    h.role = "viewer";
    serve(withSuggestions());
    await mount();
    expect(boxes()).toHaveLength(0);
  });
});
