import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { THREAD_LIFT_DELETES } from "@/lib/legal-hold";

// Markup only: the hooks module is replaced so nothing here reaches the api or the auth provider.
vi.mock("@/hooks/use-legal-holds", () => ({ useLegalHolds: () => ({}), useBusinessHold: () => ({}), useThreadHold: () => ({}) }));

const { ReasonForm } = await import("./legal-hold");

const form = (warning: string | null, confirmLabel: string) =>
  renderToStaticMarkup(<ReasonForm lifting warning={warning} confirmLabel={confirmLabel} pending={false} onCancel={() => {}} onConfirm={() => {}} />);

describe("the lift confirmation (H4)", () => {
  it("KILL: a deletion warning is shown, in an alert, with the 'Lift and delete' button", () => {
    const html = form(THREAD_LIFT_DELETES, "Lift and delete");
    expect(html).toContain('role="alert"');
    expect(html).toContain("deletes this conversation permanently right away");
    expect(html).toContain("This cannot be undone.");
    expect(html).toContain("Lift and delete");
    // the 180-day restart promise is false for this lift, so it is not said beside the warning
    expect(html).not.toContain("restarts the normal 180 days");
  });
  it("PASS: with no warning the dialog is the ordinary one", () => {
    const html = form(null, "Lift hold");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("permanently");
    expect(html).not.toContain("Lift and delete");
    expect(html).toContain("Lift hold");
    expect(html).toContain("restarts the normal 180 days");
  });
});
