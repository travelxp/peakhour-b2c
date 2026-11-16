// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("token=t&email=a%40b.co"),
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ refreshUser: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ acceptInvite: vi.fn(), sendMagicLink: vi.fn() }));

import { acceptInvite, sendMagicLink } from "@/lib/auth";
import AcceptInvitePage from "./page";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  vi.mocked(acceptInvite).mockResolvedValue({ status: "signup_required", message: "Sign up first", orgName: "Acme" } as never);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

async function openSignup() {
  await act(async () => {
    root.render(<AcceptInvitePage />);
  });
}
const sendButton = () => [...host.querySelectorAll("button")].find((b) => /Send sign-in link/.test(b.textContent ?? ""))!;

describe("/auth/accept-invite signup state", () => {
  it("shows and announces the failure when the sign-in link does not send", async () => {
    vi.mocked(sendMagicLink).mockRejectedValue(new Error("Failed to send sign-in link"));
    await openSignup();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    await act(async () => {
      sendButton().click();
    });
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe("Failed to send sign-in link. Try again in a moment.");
    expect(sendButton()).toBeTruthy(); // still on the signup state, can retry
  });

  it("falls back to plain copy, and clears the notice on a successful retry", async () => {
    vi.mocked(sendMagicLink).mockRejectedValueOnce("boom").mockResolvedValueOnce(undefined as never);
    await openSignup();
    await act(async () => {
      sendButton().click();
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("The sign-in link didn’t send. Try again.");
    await act(async () => {
      sendButton().click();
    });
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain("Check your email");
  });
});
