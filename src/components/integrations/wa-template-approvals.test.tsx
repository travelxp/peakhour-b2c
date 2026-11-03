import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TemplateApprovals } from "@/lib/wa-template-approvals";
import { TemplateApprovalsView } from "./wa-template-approvals";

const data = (over: Partial<TemplateApprovals> = {}): TemplateApprovals => ({
  connected: true,
  allApproved: false,
  counts: { approved: 1, waiting: 1, notApproved: 1 },
  templates: [
    { name: "peakhour_cod", language: "en", purpose: "Asks a shopper to confirm a Cash on Delivery order", unlocks: "Cash on Delivery order confirmation", state: "approved", message: "Approved by Meta.", reason: null },
    { name: "peakhour_cart", language: "en", purpose: "Reminds a shopper about a cart", unlocks: "WhatsApp cart reminders", state: "waiting", message: "Waiting for Meta. Reviews usually take a few minutes and can take up to a day or two.", reason: null },
    { name: "peakhour_prepay", language: "en", purpose: "Offers pay-online on a COD order", unlocks: "Cash on Delivery orders with the pay-online option", state: "not_approved", message: "Meta did not approve this. Contact support and we will sort it out.", reason: "The sample does not match the body." },
  ],
  ...over,
});

describe("Messages Meta must approve", () => {
  it("lists each message with its status and what it unlocks", () => {
    const out = renderToStaticMarkup(<TemplateApprovalsView data={data()} />);
    expect(out).toContain("Messages Meta must approve");
    expect(out).toContain("Needed for: Cash on Delivery order confirmation");
    expect(out).toContain("Needed for: WhatsApp cart reminders");
    expect(out).toMatch(/data-state="approved"[^>]*>Approved</);
    expect(out).toMatch(/data-state="waiting"[^>]*>Waiting for Meta</);
    expect(out).toMatch(/data-state="not_approved"[^>]*>Not approved</);
  });

  it("a rejected message says what to do and quotes Meta's reason", () => {
    const out = renderToStaticMarkup(<TemplateApprovalsView data={data()} />);
    expect(out).toContain("Meta did not approve this. Contact support and we will sort it out.");
    expect(out).toContain("Meta said: The sample does not match the body.");
  });

  it("offers no way to submit: no button, no form", () => {
    const out = renderToStaticMarkup(<TemplateApprovalsView data={data()} />);
    expect(out).not.toMatch(/<button|<form|<input/);
    expect(out).toContain("Peakhour sends these to Meta for you.");
  });

  it("says when everything is approved", () => {
    expect(renderToStaticMarkup(<TemplateApprovalsView data={data({ allApproved: true })} />)).toContain("All of them are approved.");
    expect(renderToStaticMarkup(<TemplateApprovalsView data={data()} />)).not.toContain("All of them are approved.");
  });

  it("renders nothing when WhatsApp is not connected or there is nothing to approve", () => {
    expect(renderToStaticMarkup(<TemplateApprovalsView data={data({ connected: false })} />)).toBe("");
    expect(renderToStaticMarkup(<TemplateApprovalsView data={data({ templates: [] })} />)).toBe("");
  });
});
