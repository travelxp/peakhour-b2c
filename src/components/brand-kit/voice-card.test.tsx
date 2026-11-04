// @vitest-environment jsdom
/**
 * The Brand Kit's Voice card, edited (lane F): who may edit, what the form holds, what a save sends, what a failed one says, and that a Private
 * font is shown for what it is. The api client is replaced, so nothing here reaches the network.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), getWithMeta: vi.fn() }, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { VoiceCard, BrandKitView } = await import("./brand-kit-view");
const { voiceSummary, draftFromView } = await import("@/lib/brand-kit");

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = undefined;
});

const VOICE = { tone: "Warm and unhurried.", vocabulary: ["estate", "first flush"], avoidTerms: ["cheap"], sampleHeadlines: ["From our hills, with love"] };

function mount(props: { voice?: typeof VOICE | null; canEdit: boolean; onSave?: (v: unknown) => Promise<void> }) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const voice = props.voice === undefined ? VOICE : props.voice;
  act(() => root!.render(<VoiceCard voice={voice} summary={voiceSummary(voice)} canEdit={props.canEdit} onSave={(props.onSave ?? (async () => undefined)) as never} />));
  return host;
}
const button = (el: HTMLElement, text: string) => [...el.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
const field = (el: HTMLElement, id: string) => el.querySelector<HTMLTextAreaElement>(`#${id}`)!;
async function type(el: HTMLTextAreaElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => {
    set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const submit = (el: HTMLElement) => act(async () => void el.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

describe("Voice card", () => {
  it("a viewer sees the voice and no way to change it; an editor sees Edit voice", () => {
    expect(button(mount({ canEdit: false }), "Edit voice")).toBeUndefined();
    act(() => root!.unmount());
    host!.remove();
    expect(button(mount({ canEdit: true }), "Edit voice")).toBeDefined();
  });

  it("with no voice recorded an editor is invited to write one, a viewer is told one is read from the website", () => {
    const editor = mount({ voice: null, canEdit: true });
    expect(button(editor, "Write your voice")).toBeDefined();
    expect(editor.textContent).toContain("Write one here");
    act(() => root!.unmount());
    host!.remove();
    const viewer = mount({ voice: null, canEdit: false });
    expect(button(viewer, "Write your voice")).toBeUndefined();
    expect(viewer.textContent).not.toContain("Write one here");
  });

  it("Edit opens a form holding the WHOLE voice (not the eight-word summary), one entry per line", async () => {
    const long = { ...VOICE, vocabulary: Array.from({ length: 12 }, (_, i) => `word${i}`) };
    const el = mount({ voice: long, canEdit: true });
    await act(async () => button(el, "Edit voice")!.click());
    expect(field(el, "voice-tone").value).toBe("Warm and unhurried.");
    expect(field(el, "voice-uses").value.split("\n")).toHaveLength(12);
    expect(field(el, "voice-headlines").value).toBe("From our hills, with love");
    expect((button(el, "Save voice") as HTMLButtonElement).disabled).toBe(true); // nothing changed yet
  });

  it("Save sends every field, words split on lines and commas, a headline kept whole; the form closes on success", async () => {
    const onSave = vi.fn(async () => undefined);
    const el = mount({ canEdit: true, onSave });
    await act(async () => button(el, "Edit voice")!.click());
    await type(field(el, "voice-tone"), "  Calm, plain.  ");
    await type(field(el, "voice-uses"), "estate, first flush\nleaf\nleaf");
    await type(field(el, "voice-avoids"), "");
    await type(field(el, "voice-headlines"), "Steep in joy, daily\n");
    await submit(el);
    expect(onSave).toHaveBeenCalledWith({ tone: "Calm, plain.", vocabulary: ["estate", "first flush", "leaf"], avoidTerms: [], sampleHeadlines: ["Steep in joy, daily"] });
    expect(el.querySelector("form")).toBeNull();
  });

  it("a failed save keeps the form and what was typed, and says why", async () => {
    const onSave = vi.fn(async () => {
      throw new Error("The Brand Voice could not be saved. Try again.");
    });
    const el = mount({ canEdit: true, onSave });
    await act(async () => button(el, "Edit voice")!.click());
    await type(field(el, "voice-tone"), "Changed");
    await submit(el);
    expect(el.querySelector("form")).not.toBeNull();
    expect(field(el, "voice-tone").value).toBe("Changed");
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("could not be saved");
  });

  it("a tone over 512 characters cannot be saved, and the box says by how much", async () => {
    const onSave = vi.fn(async () => undefined);
    const el = mount({ canEdit: true, onSave });
    await act(async () => button(el, "Edit voice")!.click());
    await type(field(el, "voice-tone"), "x".repeat(513));
    expect((button(el, "Save voice") as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("513");
    await submit(el);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Cancel drops the edit", async () => {
    const el = mount({ canEdit: true });
    await act(async () => button(el, "Edit voice")!.click());
    await type(field(el, "voice-tone"), "Changed");
    await act(async () => button(el, "Cancel")!.click());
    expect(el.querySelector("form")).toBeNull();
    expect(el.textContent).toContain("Warm and unhurried.");
  });
});

describe("Fonts card: a Private font", () => {
  const props = (fonts: unknown[]) =>
    ({
      scope: "org",
      scopes: ["org", "business"],
      businessName: "Monsoon Tea Co.",
      draft: draftFromView({ logos: [], colors: [], fonts: fonts as never, guidelines: [], from: { logos: "none", colors: "none", fonts: "org", guidelineMediaIds: "none" } }),
      effective: null,
      voice: null,
      canEditVoice: true,
      onSaveVoice: async () => undefined,
      websiteUrl: null,
      dirty: false,
      saving: false,
      error: null,
      hasOverride: false,
      review: null,
      prefillBusy: false,
      fontHintText: null,
      onScope() {},
      onSave() {},
      onDiscard() {},
      onRevert() {},
      onPrefill() {},
      onAddLogo() {},
      onLogoForm() {},
      onRemoveLogo() {},
      onAddColor: () => null,
      onColorRole() {},
      onRemoveColor() {},
      onAddFont() {},
      onFontRole() {},
      onRemoveFont() {},
      onAddGuideline() {},
      onRemoveGuideline() {},
      onOpenGuideline() {},
    }) as Parameters<typeof BrandKitView>[0];

  it("is marked Private, is still listed when its link could not be made, and the card says it has no public address", () => {
    const out = renderToStaticMarkup(<BrandKitView {...props([{ mediaId: "f1", role: "heading", family: "Licensed Serif", visibility: "private", mimeType: "font/woff2" }])} />);
    expect(out).toContain("Licensed Serif");
    expect(out).toContain(">Private</span>");
    expect(out).toContain("A Private font has no public address");
  });

  it("a Published font carries no Private mark", () => {
    const out = renderToStaticMarkup(<BrandKitView {...props([{ mediaId: "f1", role: "heading", family: "Open Serif", visibility: "published", url: "https://m/f.woff2", mimeType: "font/woff2" }])} />);
    expect(out).toContain("Open Serif");
    expect(out).not.toContain(">Private</span>");
  });
});
