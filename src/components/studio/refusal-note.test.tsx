import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { RefusalNote } = await import("./refusal-note");
import type { StudioRefusal } from "@/lib/studio-flow";

const note = (r: Partial<StudioRefusal>, props: Partial<Parameters<typeof RefusalNote>[0]> = {}) =>
  renderToStaticMarkup(<RefusalNote refusal={{ code: "X", tone: "error", text: "A plain sentence.", ...r }} {...props} />);

describe("a refusal always has its next step (spec 4.2)", () => {
  it("an alert with the sentence", () => {
    const html = note({});
    expect(html).toContain('role="alert"');
    expect(html).toContain("A plain sentence.");
  });
  it("too few Peaks: Add Peaks (the existing top-up path)", () => {
    expect(note({ action: "add_peaks" })).toContain('href="/dashboard/peaks"');
  });
  it("a plan that cannot change (BRIEF_LOCKED, TOO_MANY_PREVIEWS): Start a new plan, a real link", () => {
    const html = note({ action: "new_plan" });
    expect(html).toContain("Start a new plan");
    expect(html).toContain('href="/dashboard/studio/new"');
  });
  it("already running: See progress, a link to the progress card", () => {
    const html = note({ action: "see_progress" });
    expect(html).toContain("See progress");
    expect(html).toContain('href="#studio-making-title"');
  });
  it("a changed price: a button to ask again, shown only when the screen can", () => {
    expect(note({ action: "requote" }, { onRequote: () => {} })).toContain("Retry");
    expect(note({ action: "requote" })).not.toContain("Retry");
  });
  it("went wrong: Try again", () => {
    expect(note({ action: "retry" }, { onRetry: () => {} })).toContain("Try again");
  });
  it("Make {k} instead only beside Add Peaks", () => {
    const html = note({ action: "add_peaks" }, { makeInstead: { label: "Make 3 previews instead", onPress: () => {} } });
    expect(html).toContain("Make 3 previews instead");
    expect(note({ action: "retry" }, { makeInstead: { label: "Make 3 previews instead", onPress: () => {} } })).not.toContain("instead");
  });
});
