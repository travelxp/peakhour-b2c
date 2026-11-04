import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ShareAccessEntry, ShareAccessHistory } from "@/lib/api/drive-share";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() }, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));
vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));

const { SharePrivacyNoteView, ShareAccessList } = await import("./share-privacy");

const entry = (over: Partial<ShareAccessEntry> = {}): ShareAccessEntry => ({
  id: "e1",
  kind: "opened",
  at: "2026-11-03T10:00:00.000Z",
  browser: "Chrome",
  device: "phone",
  deviceLabel: "Chrome on a phone",
  ip: "203.0.113.9",
  detailsRemoved: false,
  ...over,
});
const history = (entries: ShareAccessEntry[], over: Partial<ShareAccessHistory> = {}): ShareAccessHistory => ({ entries, retentionDays: 90, truncated: false, ...over });
const fmt = (iso: string) => `at:${iso.slice(0, 10)}`;
const list = (h: ShareAccessHistory | undefined, extra: { loading?: boolean; error?: boolean } = {}) =>
  renderToStaticMarkup(<ShareAccessList history={h} formatDate={fmt} {...extra} />);

describe("the share dialog's line", () => {
  it("is the approved sentence with the api's number", () => {
    expect(renderToStaticMarkup(<SharePrivacyNoteView retentionDays={90} />)).toContain(
      "When someone opens this link, we keep their IP address and device for 90 days so you can spot a leak.",
    );
  });
  it("follows the number: change the setting and the line changes", () => {
    const html = renderToStaticMarkup(<SharePrivacyNoteView retentionDays={30} />);
    expect(html).toContain("for 30 days so you can spot a leak");
    expect(html).not.toContain("90 days");
  });
  it("says it without a number when the api could not give one, and never invents one", () => {
    const html = renderToStaticMarkup(<SharePrivacyNoteView retentionDays={null} />);
    expect(html).toContain("IP address and device");
    expect(html).not.toMatch(/\d/);
  });
});

describe("the Opened by list", () => {
  it("a link nobody opened says so", () => {
    expect(list(history([]))).toContain("Not opened yet.");
  });

  it("shows each open with its date and device, and the IP while it is kept", () => {
    const html = list(history([entry(), entry({ id: "e2", at: "2026-11-02T10:00:00.000Z", deviceLabel: "Safari on a computer", ip: "198.51.100.4" })]));
    expect(html).toContain("at:2026-11-03");
    expect(html).toContain("Chrome on a phone");
    expect(html).toContain("203.0.113.9");
    expect(html).toContain("Safari on a computer");
    expect(html).toContain("198.51.100.4");
    expect(html.match(/data-testid="share-access-entry"/g)).toHaveLength(2);
  });

  it("after the window it says the details were removed, with the api's number, and shows no IP or device", () => {
    const html = list(history([entry({ detailsRemoved: true, ip: null, deviceLabel: "Unknown device", at: "2026-06-01T10:00:00.000Z" })]));
    expect(html).toContain("Details removed after 90 days");
    expect(html).toContain("at:2026-06-01"); // the open's date survives
    expect(html).not.toContain("203.0.113");
    expect(html).not.toContain("Unknown device");
    expect(list(history([entry({ detailsRemoved: true, ip: null })], { retentionDays: 30 }))).toContain("Details removed after 30 days");
  });

  it("a removed row never shows an address even if one were passed", () => {
    expect(list(history([entry({ detailsRemoved: true, ip: "203.0.113.9" })]))).not.toContain("203.0.113.9");
  });

  it("a wrong password try is told apart from an open", () => {
    const html = list(history([entry({ kind: "wrong_password" })]));
    expect(html).toContain("Wrong password");
    expect(html).not.toContain(">Opened<");
  });

  it("says when the list is the most recent only, and when it cannot load", () => {
    expect(list(history([entry()], { truncated: true }))).toContain("most recent");
    expect(list(undefined, { error: true })).toContain("could not load");
    expect(list(undefined, { loading: true })).toContain("Loading");
  });
});
