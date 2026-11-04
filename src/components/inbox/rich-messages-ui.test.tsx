import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

// Markup only: every hook module is replaced so nothing here reaches the api, the router or the auth provider.
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "b1" } }) }));
vi.mock("@/hooks/use-inbox-media", () => ({
  useThreadMedia: () => ({ data: undefined, isError: false, isFetching: false, error: null, refetch: async () => {} }),
  useObjectUrl: () => null,
}));
// The Save to Drive button needs a query client; its own behaviour is tested in drive/replace-file.test.tsx. Here it is a marker with the source it was given.
vi.mock("@/components/drive/save-to-drive", () => ({
  SaveToDriveButton: ({ source, label }: { source: unknown; label: string }) => <button data-save-source={JSON.stringify(source)}>{label}</button>,
}));
vi.mock("@/hooks/use-wa-conversations", () => ({
  useInboxProducts: () => ({ data: { products: [] }, isLoading: false, isError: false, isSuccess: true, refetch: async () => {} }),
}));

const { Bubble } = await import("./message-bubble");
const { BubbleMedia } = await import("./inbox-media-view");
const { WaRichSend } = await import("./wa-rich-send");

const here = (f: string) => readFileSync(join(__dirname, f), "utf8");
const media = (over: Record<string, unknown> = {}) => ({ ref: "a".repeat(64), kind: "image" as const, mimeType: "image/jpeg", filename: null, bytes: null, ...over });

describe("an attachment in a bubble", () => {
  it("is a button to press, not a file already fetched: nothing is loaded until it is pressed", () => {
    const html = renderToStaticMarkup(<BubbleMedia threadId="whatsapp:1:abc" media={media()} />);
    expect(html).toContain("View photo");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<audio");
  });

  it("names what it opens for each kind, and the size when it is known", () => {
    const at = (m: Record<string, unknown>) => renderToStaticMarkup(<BubbleMedia threadId="t" media={media(m)} />);
    expect(at({ kind: "audio", mimeType: "audio/ogg; codecs=opus" })).toContain("Play voice note");
    expect(at({ kind: "video", mimeType: "video/mp4" })).toContain("Play video");
    expect(at({ kind: "sticker" })).toContain("View sticker");
    const doc = at({ kind: "document", filename: "invoice.pdf", bytes: 2 * 1024 * 1024 });
    expect(doc).toContain("Download invoice.pdf");
    expect(doc).toContain("2.0 MB");
  });

  it("a photo, video or document can be saved to Drive, privately, by the conversation and the message's own key; a voice note or sticker cannot", () => {
    const at = (m: Record<string, unknown>) => renderToStaticMarkup(<BubbleMedia threadId="whatsapp:1:abc" media={media(m)} />);
    for (const kind of ["image", "video", "document"]) {
      const html = at({ kind });
      expect(html, kind).toContain("Save to Drive (private)");
      expect(html, kind).toContain(`data-save-source="{&quot;from&quot;:&quot;inbox&quot;,&quot;threadId&quot;:&quot;whatsapp:1:abc&quot;,&quot;ref&quot;:&quot;${"a".repeat(64)}&quot;}"`);
    }
    for (const kind of ["audio", "sticker"]) expect(at({ kind }), kind).not.toContain("Save to Drive");
  });

  it("the bubble shows the button and not the placeholder line it stands in for", () => {
    const html = renderToStaticMarkup(<Bubble role="user" content="[Photo]" sender="Asha" media={media()} threadId="whatsapp:1:abc" />);
    expect(html).toContain("View photo");
    expect(html).not.toContain("[Photo]");
  });

  it("a caption stays beside the button", () => {
    const html = renderToStaticMarkup(<Bubble role="user" content="do you have this in blue?" sender="Asha" media={media()} threadId="whatsapp:1:abc" />);
    expect(html).toContain("View photo");
    expect(html).toContain("do you have this in blue?");
  });

  it("a line with no attachment is exactly as it was, and an attachment with no thread to open it in shows its words", () => {
    const plain = renderToStaticMarkup(<Bubble role="user" content="hi" sender="Asha" />);
    expect(plain).toContain("hi");
    expect(plain).not.toContain("View");
    const orphan = renderToStaticMarkup(<Bubble role="user" content="[Photo]" sender="Asha" media={media()} />);
    expect(orphan).toContain("[Photo]");
    expect(orphan).not.toContain("View photo");
  });

  it("uses theme tokens only, like the bubble it sits in", () => {
    const HEX = /(?:bg|text|border|ring|fill|stroke|from|to|via)-\[#[0-9a-fA-F]{3,8}\]|["'`(]#[0-9a-fA-F]{3,8}["'`)]/;
    for (const f of ["inbox-media-view.tsx", "wa-rich-send.tsx", "message-bubble.tsx"]) expect(here(f), f).not.toMatch(HEX);
  });
});

describe("the composer's rich buttons", () => {
  const markup = renderToStaticMarkup(<WaRichSend threadId="whatsapp:1:abc" disabled={false} unknownSig={null} onSend={async () => true} />);

  it("offers the three ways, and opens none of them by itself", () => {
    expect(markup).toContain("Attach from Drive");
    expect(markup).not.toContain("<input");
    expect(markup).toContain("Send a product");
    expect(markup).toContain("Send a checkout link");
    expect(markup).not.toContain("Search your products");
  });

  it("the Drive picker greys out what WhatsApp will not take (JPEG, PNG and PDF only, up to 4 MB), and a Private file is allowed", () => {
    const src = here("wa-rich-send.tsx");
    expect(src).toMatch(/unusable=\{\(f\) => attachmentProblem\(\{ type: f\.mimeType, size: f\.sizeBytes \}\)\}/);
    expect(src).toContain("requirePublicUrl={false}");
    // the file goes by id and the api reads its bytes: no signed link is fetched for it
    expect(src).toContain("needUrl={false}");
    // and a file uploaded from here is Private: a shopper's photo gets no public address
    expect(src).toContain('uploadAs="private"');
  });

  it("every button is off while a send is in flight (one press, one send)", () => {
    const busy = renderToStaticMarkup(<WaRichSend threadId="t" disabled unknownSig={null} onSend={async () => true} />);
    expect(busy.match(/<button[^>]*disabled/g)?.length).toBe(3);
  });

  it("they are offered only in the free-text box, not in the template box that replaces it after the 24 hours", () => {
    const src = here("wa-composer.tsx");
    const rich = src.indexOf("<WaRichSend");
    const templateMode = src.indexOf("template mode: the window has closed");
    expect(rich).toBeGreaterThan(0);
    expect(templateMode).toBeGreaterThan(rich);
    expect(src.indexOf("<WaRichSend", rich + 1)).toBe(-1);
  });

  it("a send whose outcome is unknown asks for a confirming press: the label says so, and only for that same send", () => {
    const src = here("wa-rich-send.tsx");
    expect(src).toContain('"Send again anyway"');
    expect(src).toMatch(/replySignature\(payload\) === unknownSig/);
    expect(src).toMatch(/cardLabel=\{sendLabel\(\{ kind: "product"/);
    expect(here("wa-composer.tsx")).toMatch(/unknownSig=\{mem\.attempt\?\.unknown \? mem\.attempt\.sig : null\}/);
  });

  it("a send of unknown outcome blocks a DIFFERENT rich send (the one attempt would be dropped), and says why", () => {
    const src = here("wa-rich-send.tsx");
    expect(src).toMatch(/unknownSig !== null && replySignature\(payload\) !== unknownSig/);
    // the definition's own parameter list is not a call: the attach, the card and the checkout buttons are the three
    expect((src.match(/blocked\(/g) ?? []).length).toBe(3);
    const html = renderToStaticMarkup(<WaRichSend threadId="t" disabled={false} unknownSig={"[\"text\",\"hi\"]"} onSend={async () => true} />);
    expect(html).toContain("A message you sent may not have arrived.");
    expect(renderToStaticMarkup(<WaRichSend threadId="t" disabled={false} unknownSig={null} onSend={async () => true} />)).not.toContain("may not have arrived");
  });

  it("a Messenger or Instagram conversation (same composer) is offered none of them: they are WhatsApp's", () => {
    expect(here("wa-composer.tsx")).toMatch(/\{threadId\.startsWith\("whatsapp:"\) && \(\s*<WaRichSend/);
  });

  it("an attachment's panel clears only when it was sent, so a refused send keeps what the person chose", () => {
    const src = here("wa-rich-send.tsx");
    expect(src).toMatch(/if \(sent\) \{\s*setFile\(null\);\s*setCaption\(""\);/);
    expect(src).toMatch(/if \(await onSend\(\{ kind: "product", productId: p\.productId \}\)\) onDone\(\)/);
    expect(src).toMatch(/if \(await onSend\(\{ kind: "checkout", items: checkoutItems\(lines\) \}\)\) onDone\(\)/);
  });

  it("the storefront (read-only) view never reaches them: the composer is only mounted for a WhatsApp thread", () => {
    const pane = here("conversations-pane.tsx");
    expect(pane).toMatch(/selectedChannel === "whatsapp" && waThread && waThread\.threadId === selected && \(\s*<div className="sticky bottom-0 border-t bg-background">\s*<WaComposer/);
  });
});
