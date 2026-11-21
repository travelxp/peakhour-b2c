import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { BatchQuote } from "@/lib/api/creative-studio";
import { STUDIO_COPY } from "@/lib/studio-copy";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
const prefs = vi.hoisted(() => ({ proTools: true, canMake: true }));
vi.mock("@/hooks/use-studio", () => ({
  useStudioPrefs: () => ({ proTools: prefs.proTools, loading: false }),
  useStudioAvailability: () => ({ capabilities: { previews: "on" } }),
}));
vi.mock("@/hooks/use-studio-flow", () => ({ useStudioAbilities: () => ({ canMake: prefs.canMake }), FLOW_KEYS: { batch: "b" } }));
vi.mock("@/hooks/use-studio-pro", () => ({ useBatchQuote: () => ({}), useCreateBatch: () => ({}) }));

const { BatchConfirmView, MakeForSeveralButton } = await import("./batch-start");
const { ProductPickerView } = await import("./product-picker");

const noop = () => {};
const q: BatchQuote = {
  main: { action: "creative.make_previews", peaks: 1000, units: 20, token: "m", expiresAt: 1 },
  cutout: { action: "creative.cut_out_product", peaks: 100, units: 5, token: "c", expiresAt: 1 },
  totalPeaks: 1100,
  products: 5,
  previewsEach: 4,
};
const confirm = (over: Partial<Parameters<typeof BatchConfirmView>[0]> = {}) =>
  renderToStaticMarkup(
    <BatchConfirmView
      products={5}
      count={4}
      onCount={noop}
      comingSoon={false}
      quote={{ state: "quote", value: q }}
      left={5000}
      canMake
      pending={false}
      onMake={noop}
      onBack={noop}
      onClose={noop}
      onRetryQuote={noop}
      onRequote={noop}
      {...over}
    />,
  );

describe("the entry button", () => {
  it("shows with Pro tools on, for a person who can spend", () => {
    expect(renderToStaticMarkup(<MakeForSeveralButton onPress={noop} />)).toContain("Make previews for several");
  });
  it("is not there with Pro tools off, nor for a viewer", () => {
    prefs.proTools = false;
    expect(renderToStaticMarkup(<MakeForSeveralButton onPress={noop} />)).toBe("");
    prefs.proTools = true;
    prefs.canMake = false;
    expect(renderToStaticMarkup(<MakeForSeveralButton onPress={noop} />)).toBe("");
    prefs.canMake = true;
  });
});

describe("the confirm step", () => {
  it("shows ONE price for the whole batch, in Peaks, with 'Why this price' and a button that names the products", () => {
    const html = confirm();
    expect(html).toContain("Up to 1,100 Peaks for 20 previews");
    expect(html).toContain("5,000 left this month");
    expect(html).toContain("Why this price");
    expect(html).toContain("20 previews: 5 products with 4 each");
    expect(html).toContain("5 product photos prepared first");
    expect(html).toContain("Make previews for 5 products");
    expect(html).not.toMatch(/[₹£$€]/);
    expect((html.match(/Up to /g) ?? []).length).toBe(1);
  });
  it("leaves the photo line out when no photo needs preparing", () => {
    expect(confirm({ quote: { state: "quote", value: { ...q, cutout: null, totalPeaks: 1000 } } })).not.toContain("photos prepared");
  });
  it("has no price and a disabled button while the price is being worked out, and no 'Why' either", () => {
    const html = confirm({ quote: { state: "loading" } });
    expect(html).toContain("Working out what this costs");
    expect(html).not.toContain("Why this price");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Make previews for 5 products/);
  });
  it("is the designed coming-soon card with no price when previews are off", () => {
    const html = confirm({ comingSoon: true });
    expect(html).toContain("Previews are coming soon");
    expect(html).not.toContain("Peaks");
    expect(html).not.toContain("Make previews for 5");
  });
  it("offers 'Make k instead' beside Add Peaks when the balance is short", () => {
    const html = confirm({
      refusal: { code: "CREDITS_EXHAUSTED", tone: "error", text: "You need 1,100 Peaks and have 700. Nothing was started and nothing was charged.", action: "add_peaks", need: 1100, left: 700 },
      makeInstead: { label: STUDIO_COPY.refusal.makeInstead(3, "products"), onPress: noop },
    });
    expect(html).toContain("Make 3 products instead");
    expect(html).toContain("Add Peaks");
    expect(html).toContain('role="alert"');
  });
  it("says a product has no photo instead of a price, and the button stays off", () => {
    const html = confirm({ quote: { state: "loading" }, blocked: "Add a photo of Mug so the picture shows the real one." });
    expect(html).toContain("Add a photo of Mug");
    expect(html).not.toContain("Working out what this costs");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Make previews for 5 products/);
  });
  it("tells a viewer to ask an editor and cannot press", () => {
    const html = confirm({ canMake: false });
    expect(html).toContain("Ask an editor to make these.");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Make previews for 5 products/);
  });
  it("says Starting while the click is on its way", () => {
    expect(confirm({ pending: true })).toContain("Starting");
  });
});

describe("the picker in batch mode", () => {
  const products = [{ id: "p1", title: "Mug" }];
  const view = (over: Partial<Parameters<typeof ProductPickerView>[0]> = {}) =>
    renderToStaticMarkup(<ProductPickerView status="ready" products={products} selected={["p1"]} query="" onQuery={noop} onToggle={noop} onRetry={noop} batch max={60} {...over} />);
  it("counts '{n} chosen' with no 'of 3'", () => {
    expect(view()).toContain("1 chosen");
    expect(view()).not.toContain("of 3");
  });
  it("says the cap in its own words when the next tick is refused", () => {
    expect(view({ overLimit: true })).toContain("You can pick up to 60 at once.");
  });
});
