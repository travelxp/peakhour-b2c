import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { SizesStepView } = await import("./sizes-step");
const { PostStepView } = await import("./post-step");
const { SettingsView } = await import("./settings-sheet");
const { StudioStripView } = await import("./studio-strip");
const { FinalReviewView } = await import("./final-review");

import type { PlacementRow } from "@/lib/api/creative-studio";
import { DEFAULT_STUDIO_SETTINGS } from "@/lib/api/creative";
import { sizeRows, STUDIO_CHANNELS } from "@/lib/studio-publish";
import { studioJobs } from "@/lib/studio-strip";

const noop = () => {};
const pl = (key: string, kind: PlacementRow["kind"], over: Partial<PlacementRow> = {}): PlacementRow => ({
  key,
  channel: key.split(".")[0]!,
  label: "Feed post",
  placement: "instagram_feed",
  format: "feed",
  width: 1080,
  height: 1350,
  specRef: { sourceUrl: "https://x", verifiedAt: "2026-11-01T00:00:00.000Z" },
  kind,
  ...over,
});

const channels = STUDIO_CHANNELS.map((c) => ({ ...c, connected: c.key === "instagram" || c.key === "threads" }));
const rows = sizeRows(
  [
    pl("instagram.instagram_feed.1080x1350", "ready"),
    pl("instagram.instagram_stories.1080x1920", "needs_extend", { label: "Story", height: 1920 }),
    pl("threads.feed.none", "no_spec", { channel: "threads", width: null, height: null, specRef: null }),
  ],
  [],
);

const sizes = (over: Partial<Parameters<typeof SizesStepView>[0]> = {}) =>
  renderToStaticMarkup(
    <SizesStepView
      channels={channels}
      chosenChannels={new Set(["instagram", "threads"])}
      onToggleChannel={noop}
      status="ready"
      rows={rows}
      ticked={new Set(["instagram.instagram_feed.1080x1350"])}
      onToggleRow={noop}
      extendOn
      unitPeaks={200}
      extendTicked={0}
      quote={{ state: "loading" }}
      left={5000}
      proTools={false}
      working={false}
      stillMaking={0}
      canPost
      onRetry={noop}
      onContinue={noop}
      onRequote={noop}
      {...over}
    />,
  );

describe("platform versions (S12)", () => {
  it("shows a free ready size, a size that needs more background with its price, and says unconfirmed sizes are not confirmed", () => {
    const html = sizes();
    expect(html).toContain("Ready");
    expect(html).toContain("Needs more background to fit Story");
    expect(html).toContain("Uses 200 Peaks");
    expect(html).toContain("Sizes for Threads aren&#x27;t confirmed yet");
    expect(html).toContain("Making these sizes is free unless a size needs more background.");
  });

  it("never shows a pixel size or a ratio to a novice, and does for Pro tools", () => {
    expect(sizes()).not.toContain("1080 × 1350");
    expect(sizes({ proTools: true })).toContain("1080 × 1350 pixels");
  });

  it("the size that costs Peaks is not ticked, and its checkbox name carries the price", () => {
    const html = sizes();
    expect(html).toContain("Instagram Story, Needs more background to fit Story, Uses 200 Peaks");
  });

  it("with extend not available the paid size is disabled with the reason, and no price is asked", () => {
    const html = sizes({ extendOn: false, unitPeaks: undefined });
    expect(html).toContain("Sizes that need more background are coming soon.");
    expect(html).not.toContain("Uses 200 Peaks");
  });

  it("ticking a paid size shows the quote block, and Continue carries the count and the price", () => {
    const html = sizes({
      ticked: new Set(["instagram.instagram_feed.1080x1350", "instagram.instagram_stories.1080x1920"]),
      extendTicked: 1,
      quote: { state: "quote", peaks: 200 },
    });
    expect(html).toContain("Make 1 larger and continue · 200 Peaks");
    expect(html).toContain("5,000 left this month");
    expect(html).toContain("Charged only if it works.");
  });

  it("while the price is asked, Continue waits and no figure shows", () => {
    const html = sizes({ ticked: new Set(["instagram.instagram_stories.1080x1920"]), extendTicked: 1, quote: { state: "loading" } });
    expect(html).toContain("Working out what this costs…");
    expect(html).toMatch(/disabled=""[^>]*>Continue/);
  });

  it("no channel connected: the designed empty state, with Connect and no sizes", () => {
    const html = sizes({ channels: channels.map((c) => ({ ...c, connected: false })), chosenChannels: new Set() });
    expect(html).toContain("No channels connected");
    expect(html).toContain("You can still download your picture.");
    expect(html).toContain('href="/dashboard/integrations"');
  });

  it("an unconnected channel offers Connect, not a checkbox", () => {
    expect(sizes()).toContain('aria-label="Facebook Connect"');
  });

  it("a viewer cannot continue; loading and error are their own states", () => {
    expect(sizes({ canPost: false })).toMatch(/disabled=""[^>]*>Continue/);
    expect(sizes({ status: "loading" })).toContain("Looking up the sizes");
    expect(sizes({ status: "error" })).toContain("We couldn&#x27;t load the sizes.");
  });

  it("a refusal is an alert that says nothing was charged", () => {
    const html = sizes({ refusal: { code: "CREDITS_EXHAUSTED", tone: "error", text: "You need 600 Peaks and have 200. Nothing was started and nothing was charged.", action: "add_peaks" } });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Nothing was started and nothing was charged.");
  });

  it("a size still being made says so politely", () => {
    expect(sizes({ stillMaking: 1 })).toContain("1 size is still being made.");
  });
});

describe("post or schedule (S13)", () => {
  const base = {
    status: "ready" as const,
    versions: [{ id: "v1", channel: "instagram", label: "Feed post", width: 1080, height: 1350 }],
    media: [{ versionId: "v1", url: "https://m/1.png" }],
    channels: ["instagram"],
    captions: { instagram: "Flat 20% off" },
    onCaption: noop,
    when: "now" as const,
    onWhen: noop,
    schedule: <div data-testid="scheduler" />,
    posting: false,
    onPostNow: noop,
    onRetry: noop,
    onBack: noop,
    onUseInAd: noop,
    adPending: false,
    onSaveForLater: noop,
    disclosure: "Made with AI. Some channels ask you to say so.",
  };

  it("Post it, the caption with its counter, the disclosure, and the ad-budget line", () => {
    const html = renderToStaticMarkup(<PostStepView {...base} />);
    expect(html).toContain("Post it");
    expect(html).toContain("Caption for Instagram");
    expect(html).toContain("12 of 2200 characters");
    expect(html).toContain("Made with AI. Some channels ask you to say so.");
    expect(html).toContain("Making a creative never spends ad budget. Your ad budget is set in Growth.");
    expect(html).toContain("Use in an ad");
  });

  it("an empty or too long caption stops Post it and says why", () => {
    expect(renderToStaticMarkup(<PostStepView {...base} captions={{ instagram: "" }} />)).toMatch(/disabled=""[^>]*>Post it/);
    const long = renderToStaticMarkup(<PostStepView {...base} channels={["threads"]} captions={{ threads: "a".repeat(501) }} />);
    expect(long).toContain("Threads takes up to 500 characters.");
    expect(long).toMatch(/disabled=""[^>]*>Post it/);
  });

  it("Pick a time shows the scheduler's own composer, and only once every caption is fine", () => {
    expect(renderToStaticMarkup(<PostStepView {...base} when="later" />)).toContain('data-testid="scheduler"');
    const bad = renderToStaticMarkup(<PostStepView {...base} when="later" captions={{ instagram: "" }} />);
    expect(bad).not.toContain('data-testid="scheduler"');
    expect(bad).toContain("Write a caption first.");
  });

  it("preparing, failed, done and the ad hand-off are their own states", () => {
    expect(renderToStaticMarkup(<PostStepView {...base} status="loading" />)).toContain("Getting your pictures ready…");
    expect(renderToStaticMarkup(<PostStepView {...base} status="error" />)).toContain("We couldn&#x27;t get your pictures ready. Try again.");
    const done = renderToStaticMarkup(<PostStepView {...base} done={{ text: "Posted." }} />);
    expect(done).toContain("Posted.");
    expect(done).toContain("See it in Calendar");
    expect(done).toContain("Make another");
    const ad = renderToStaticMarkup(<PostStepView {...base} adNote={{ text: "Added to Growth. Approve it there to use it in an ad.", growthHref: "/dashboard/ads" }} />);
    expect(ad).toContain("Open in Growth");
    const failed = renderToStaticMarkup(<PostStepView {...base} failure="Instagram did not take the post. You can see it on the calendar." />);
    expect(failed).toContain('role="alert"');
  });
});

describe("Studio settings (S19)", () => {
  const view = (over: Partial<Parameters<typeof SettingsView>[0]> = {}) =>
    renderToStaticMarkup(
      <SettingsView settings={DEFAULT_STUDIO_SETTINGS} proTools={false} whatsappConnected canChange saving={false} onPatch={noop} {...over} />,
    );

  it("has No AI people, the monthly limit with use so far, Pro tools, WhatsApp, reminders and Scheduled drafts as Coming soon", () => {
    const html = view({ settings: { ...DEFAULT_STUDIO_SETTINGS, usedThisMonthPeaks: 1240 } });
    expect(html).toContain("No AI people");
    expect(html).toContain("Pictures won&#x27;t show generated people.");
    expect(html).toContain("No limit");
    expect(html).toContain("Used 1,240 Peaks this month");
    expect(html).toContain("Pro tools");
    expect(html).toContain("Tell me on WhatsApp when previews are ready");
    expect(html).toContain("Remind me about shortlisted previews");
    expect(html).toContain("Coming soon");
  });

  it("a limit shows its number and 'Used 1,240 of 5,000 Peaks this month'", () => {
    const html = view({ settings: { ...DEFAULT_STUDIO_SETTINGS, monthlyCapPeaks: 5000, usedThisMonthPeaks: 1240 } });
    expect(html).toContain("Used 1,240 of 5,000 Peaks this month");
    expect(html).toContain('value="5000"');
  });

  it("a viewer reads but cannot change", () => {
    const html = view({ canChange: false });
    expect(html).toContain("Ask an editor to change these.");
    expect(html).toContain('disabled=""');
  });

  it("WhatsApp not connected sends to its settings, with the switch off", () => {
    const html = view({ whatsappConnected: false });
    expect(html).toContain("Connect WhatsApp first");
    expect(html).toContain('href="/dashboard/settings/whatsapp"');
  });
});

describe("the running-jobs strip (4.4)", () => {
  const jobs = studioJobs([{ _id: "j1", kind: "creative_previews", displayName: "Making your previews", progress: { totalUnits: 4, processedUnits: 2 } }]);

  it("one polite line with the count, a link and Stop", () => {
    const html = renderToStaticMarkup(<StudioStripView jobs={jobs} href={() => "/dashboard/studio/c/c1"} canStop stopping={false} onStop={noop} />);
    expect(html).toContain("Making your previews · 2 of 4 ready");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('href="/dashboard/studio/c/c1"');
    expect(html).toContain("Stop");
  });

  it("nothing at all when nothing is running; a viewer has no Stop", () => {
    expect(renderToStaticMarkup(<StudioStripView jobs={[]} href={() => null} canStop stopping={false} onStop={noop} />)).toBe("");
    expect(renderToStaticMarkup(<StudioStripView jobs={jobs} href={() => null} canStop={false} stopping={false} onStop={noop} />)).not.toContain("Stop");
  });
});

describe("the final review (S11)", () => {
  const review = (over: Partial<Parameters<typeof FinalReviewView>[0]> = {}) =>
    renderToStaticMarkup(
      <FinalReviewView
        finalUrl="https://m/final.png"
        previewUrl="https://m/preview.png"
        width={2048}
        height={2560}
        finalAlt="Final: Flat 20% off, Silk saree"
        previewAlt="Your preview: Flat 20% off, Silk saree"
        canPost
        onChoose={noop}
        onReport={async () => {}}
        onImageError={noop}
        {...over}
      />,
    );

  it("the final with real alt text, a Final / Your preview tab pair, zoom, report, download and the one next step", () => {
    const html = review();
    expect(html).toContain('alt="Final: Flat 20% off, Silk saree"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("Your preview");
    expect(html).toContain("Look closely");
    expect(html).toContain("Looks different? Tell us");
    expect(html).toContain("Choose where to post");
    expect(html).toContain("Download");
    expect(html).toContain("In your Library");
    expect(html).toContain("Made with AI. Some channels ask you to say so.");
  });

  it("there is no second approval button", () => {
    expect(review()).not.toMatch(/>Approve</);
  });

  it("no preview to compare: the tab pair is left out", () => {
    expect(review({ previewUrl: null })).not.toContain('role="tablist"');
  });

  it("a viewer sees the picture, and who can post", () => {
    const html = review({ canPost: false });
    expect(html).toMatch(/disabled=""[^>]*>Choose where to post/);
    expect(html).toContain("Ask an editor to post this.");
  });
});
