// @vitest-environment jsdom
/**
 * First run's shared-network opt-in (PL-6): unticked unless the business already shares; the label is the consent text
 * the api serves and the answer is recorded under that text's version; only an admin or owner can answer (anyone else
 * sees the box off, with the reason); not ticking sends nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

const V2 = { version: "pin-v2", text: "Share my results, anonymised, so Peakhour can compare me with similar businesses", canAnswer: true };
type Status = { data: unknown; isPending: boolean; isError: boolean };
type Consent = { isPending: boolean; isError: boolean; isSuccess: boolean; variables: { share: boolean; version: string } | undefined; mutate: ReturnType<typeof vi.fn<(v: { share: boolean; version: string }) => void>> };

const h = vi.hoisted(() => ({
  status: undefined as unknown as Status,
  consent: undefined as unknown as Consent,
  role: "owner" as string | undefined,
  post: vi.fn<(path: string, body?: unknown) => Promise<unknown>>(),
  get: vi.fn<(path: string) => Promise<unknown>>(),
}));
vi.mock("@/lib/api", () => ({ api: { post: h.post, get: h.get } }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "b1" }, org: { _id: "o1" }, orgs: [{ _id: "o1", role: h.role }] }) }));

const pinModule = await import("@/lib/api/pin");
vi.spyOn(pinModule, "usePinStatus").mockImplementation(() => h.status as never);
vi.spyOn(pinModule, "usePinConsent").mockImplementation(() => h.consent as never);
const { ShareResultsOptIn, SHARE_EXPLAINER, ADMIN_ONLY } = await import("./share-results-opt-in");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const newConsent = (over: Partial<Consent> = {}): Consent => ({ isPending: false, isError: false, isSuccess: false, variables: undefined, mutate: vi.fn<(v: { share: boolean; version: string }) => void>(), ...over });

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  h.status = { data: { pin: null, consent: V2 }, isPending: false, isError: false };
  h.consent = newConsent();
  h.role = "owner";
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const box = () => host.querySelector("#first-run-share") as HTMLButtonElement;
const render = async () => act(async () => root.render(<ShareResultsOptIn />));

describe("the share-results box", () => {
  it("is unticked by default, shows the api's consent words, and sends nothing until ticked", async () => {
    await render();
    expect(box().getAttribute("aria-checked")).toBe("false");
    expect(host.querySelector("label")?.textContent).toBe(V2.text);
    expect(host.textContent).toContain(SHARE_EXPLAINER);
    expect(SHARE_EXPLAINER).toBe("Only shown once at least 20 similar businesses take part. No business is ever named.");
    expect(h.consent.mutate).not.toHaveBeenCalled();
  });

  it("ticking records the consent under the version whose words were shown", async () => {
    h.status = { data: { pin: null, consent: { ...V2, version: "pin-v7", text: "Other words" } }, isPending: false, isError: false };
    await render();
    expect(host.querySelector("label")?.textContent).toBe("Other words");
    await act(async () => box().click());
    expect(h.consent.mutate).toHaveBeenCalledWith({ share: true, version: "pin-v7" });
  });

  it("a business that already shares sees it ticked, and unticking withdraws", async () => {
    h.status = { data: { pin: { consentStatus: { pin_contribution: "opted_in" } }, consent: V2 }, isPending: false, isError: false };
    await render();
    expect(box().getAttribute("aria-checked")).toBe("true");
    await act(async () => box().click());
    expect(h.consent.mutate).toHaveBeenCalledWith({ share: false, version: "pin-v2" });
  });

  it("a withdrawn business is unticked; the box is off, with no words, while the status loads; a failed save says so", async () => {
    h.status = { data: { pin: { consentStatus: { pin_contribution: "revoked" } }, consent: V2 }, isPending: false, isError: false };
    await render();
    expect(box().getAttribute("aria-checked")).toBe("false");
    h.status = { data: undefined, isPending: true, isError: false };
    await render();
    expect(box().disabled).toBe(true);
    expect(host.querySelector("label")?.textContent, "no placeholder words anybody could consent to").toBe("");
    h.status = { data: { pin: null, consent: V2 }, isPending: false, isError: false };
    h.consent = newConsent({ isPending: true, variables: { share: true, version: "pin-v2" } });
    await render();
    expect(box().getAttribute("aria-checked"), "the answer being saved, not the status it replaces").toBe("true");
    h.consent = newConsent({ isError: true, variables: { share: true, version: "pin-v2" } });
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/could not save/);
  });
});

describe("admin or owner only", () => {
  for (const role of ["editor", "viewer", undefined]) {
    it(`${role ?? "no role"}: the box is off with the reason, and a click sends nothing`, async () => {
      h.role = role;
      h.status = { data: { pin: null, consent: { ...V2, canAnswer: false } }, isPending: false, isError: false };
      await render();
      expect(box().disabled).toBe(true);
      expect(host.textContent).toContain(ADMIN_ONLY);
      expect(box().getAttribute("aria-describedby")).toBe("first-run-share-admin-only");
      await act(async () => box().click());
      expect(h.consent.mutate).not.toHaveBeenCalled();
    });
  }
  it("the api's answer wins over the org role: an admin the api says may not answer is still off", async () => {
    h.role = "admin";
    h.status = { data: { pin: null, consent: { ...V2, canAnswer: false } }, isPending: false, isError: false };
    await render();
    expect(box().disabled).toBe(true);
  });
  it("a status with no consent words (an api before PL-6) leaves the box off for everyone, and the role decides the reason", async () => {
    h.status = { data: { pin: null }, isPending: false, isError: false };
    h.role = "owner";
    await render();
    expect(box().disabled, "no words, no consent").toBe(true);
    expect(host.textContent).not.toContain(ADMIN_ONLY);
    h.role = "editor";
    await render();
    expect(host.textContent, "an editor is below admin by the org role").toContain(ADMIN_ONLY);
  });
  it("PASS: an admin can answer", async () => {
    h.role = "admin";
    await render();
    expect(box().disabled).toBe(false);
    expect(host.textContent).not.toContain(ADMIN_ONLY);
  });
});

describe("a failed status read", () => {
  it("is not 'not sharing': the box is disabled and says it could not check, so no second opt-in is written", async () => {
    h.status = { data: undefined, isPending: false, isError: true };
    await render();
    expect(box().disabled).toBe(true);
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/could not check whether you share/);
    await act(async () => box().click());
    expect(h.consent.mutate).not.toHaveBeenCalled();
  });
});

describe("after a save", () => {
  it("a re-read that fails keeps the recorded answer and the box usable", async () => {
    h.status = { data: { pin: null, consent: V2 }, isPending: false, isError: true };
    h.consent = newConsent({ isSuccess: true, variables: { share: true, version: "pin-v2" } });
    await render();
    expect(box().getAttribute("aria-checked")).toBe("true");
    expect(box().disabled).toBe(false);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});

describe("pinApi", () => {
  it("posts to the existing consent routes with the version it was given", async () => {
    h.post.mockResolvedValue({ status: "opted_in" });
    await pinModule.pinApi.optIn("first_run", "pin-v2");
    await pinModule.pinApi.withdraw("first_run", "pin-v2");
    expect(h.post.mock.calls).toEqual([
      ["/v1/pin/consent", { consentType: "pin_contribution", source: "first_run", version: "pin-v2" }],
      ["/v1/pin/consent/withdraw", { consentType: "pin_contribution", source: "first_run", version: "pin-v2" }],
    ]);
  });

  it("isSharing is true only for an opt-in", () => {
    expect(pinModule.isSharing(undefined)).toBe(false);
    expect(pinModule.isSharing({ pin: null })).toBe(false);
    expect(pinModule.isSharing({ pin: { consentStatus: { pin_contribution: "pending" } } })).toBe(false);
    expect(pinModule.isSharing({ pin: { consentStatus: { pin_contribution: "opted_in" } } })).toBe(true);
  });
});
