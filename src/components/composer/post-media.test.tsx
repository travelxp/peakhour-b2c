// @vitest-environment jsdom
/** usePostMedia / PostMedia: the shared pictures state of the LinkedIn and X composers. The picker's rules are its own (drive-picker tests). */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act, useEffect } from "react";

const h = vi.hoisted(() => ({
  pick: { current: null as null | ((a: { id: string; url: string; mime: string; name?: string }[]) => void) },
  drop: { current: null as null | { destination: unknown; attached?: number; disabled?: boolean; onAdd: (a: never[]) => void; onRefuse?: (r: { name: string; reason: string }[]) => void } },
  picker: { current: null as null | { destination: unknown; attached?: number } },
}));
vi.mock("@/components/drive/drive-picker", () => ({
  DrivePicker: (p: { destination: unknown; attached?: number; onSelect: (a: { id: string; url: string; mime: string; name?: string }[]) => void }) => {
    h.pick.current = p.onSelect;
    h.picker.current = p;
    return <button type="button">Drive</button>;
  },
  useDropPaste: (o: never) => {
    h.drop.current = o;
    return { ref: () => undefined, busy: false, dragging: false };
  },
}));
const { usePostMedia, PostMedia } = await import("./post-media");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const seen: { state: ReturnType<typeof usePostMedia> | null } = { state: null };
function Probe({ channel, locked, dropOff }: { channel: string; locked?: boolean; dropOff?: boolean }) {
  const s = usePostMedia(channel, { disabled: dropOff });
  useEffect(() => {
    seen.state = s;
  });
  return <PostMedia state={s} locked={locked} />;
}
function mount(channel = "x", locked = false, dropOff = false) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Probe channel={channel} locked={locked} dropOff={dropOff} />));
}
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const a = (n: number) => ({ id: `m${n}`, url: `https://m.example/${n}.png`, mime: "image/png", name: `${n}.png` });

describe("usePostMedia", () => {
  it("asks the picker and the drop for THIS channel's post, with how many are on it", () => {
    mount("linkedin");
    expect(h.picker.current).toMatchObject({ destination: { kind: "post", channel: "linkedin" }, attached: 0 });
    expect(h.drop.current).toMatchObject({ destination: { kind: "post", channel: "linkedin" }, attached: 0 });
    act(() => h.pick.current!([a(1), a(2)]));
    expect(h.picker.current!.attached).toBe(2);
    expect(h.drop.current!.attached).toBe(2);
  });
  it("keeps a file once, whichever way it came", () => {
    mount();
    act(() => h.pick.current!([a(1)]));
    act(() => h.drop.current!.onAdd([a(1), a(2)] as never[]));
    expect(seen.state!.media.map((m) => m.id)).toEqual(["m1", "m2"]);
  });
  it("the same Drive file chosen again with a fresh link is still one file; urls and ids are what a payload carries", () => {
    mount();
    act(() => h.pick.current!([a(1)]));
    act(() => h.pick.current!([{ ...a(1), url: "https://m.example/1.png?sig=2" }, a(2)]));
    expect(seen.state!.ids).toEqual(["m1", "m2"]);
    expect(seen.state!.urls).toEqual(["https://m.example/1.png", "https://m.example/2.png"]);
  });
  it("a drop's refusals show with their reasons, and a pick clears them", () => {
    mount();
    act(() => h.drop.current!.onRefuse!([{ name: "big.png", reason: "X takes pictures up to 5 MB." }]));
    expect(host.querySelector('[data-testid="post-media-refusals"]')!.textContent).toContain("big.png: X takes pictures up to 5 MB.");
    act(() => h.pick.current!([a(1)]));
    expect(host.querySelector('[data-testid="post-media-refusals"]')).toBeNull();
  });
  it("remove takes one off, clear takes all and the refusals", () => {
    mount();
    act(() => h.pick.current!([a(1), a(2)]));
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Remove 1.png"]')!.click());
    expect(seen.state!.media.map((m) => m.id)).toEqual(["m2"]);
    act(() => h.drop.current!.onRefuse!([{ name: "x", reason: "y" }]));
    act(() => seen.state!.clear());
    expect(seen.state!.media).toEqual([]);
    expect(host.querySelector('[data-testid="post-media-refusals"]')).toBeNull();
  });
  it("a drop is turned off when the host says so (a LinkedIn post that holds a link or a poll)", () => {
    mount("linkedin", false, true);
    expect(h.drop.current!.disabled).toBe(true);
    act(() => root.unmount());
    host.remove();
    mount("linkedin");
    expect(h.drop.current!.disabled).toBeFalsy();
  });
  it("a locked post offers no picker and no remove", () => {
    mount("x", true);
    expect(host.querySelector("button")).toBeNull();
  });
});
