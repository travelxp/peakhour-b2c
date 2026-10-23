import { describe, it, expect } from "vitest";
import type { CreativeReviewItem, CreativesSummary } from "@/lib/api/growth";
import {
  CREATIVE_FILTERS,
  approvalBadge,
  approvalDetail,
  approvedAssetsOffer,
  approvedAssetsWarning,
  creativeActionError,
  emptyState,
  filterFor,
  formatLabel,
  platformLabel,
  reviewEntryLine,
} from "./creative-review-copy";

const S = (over: Partial<CreativesSummary> = {}): CreativesSummary => ({
  total: 0,
  inForce: 0,
  approvedUnusable: 0,
  approvable: 0,
  changedSinceApproved: 0,
  ...over,
});
type Item = Pick<CreativeReviewItem, "approvalState" | "status" | "approval" | "canApprove" | "preflight" | "coverageGap">;
const item = (over: Partial<Item> = {}): Item => ({
  approvalState: "not_approved",
  status: "review",
  approval: null,
  canApprove: true,
  preflight: null,
  coverageGap: null,
  ...over,
});

describe("approvalBadge — ★the api's state, never the status", () => {
  it("★★approved only when the approval still matches", () => {
    expect(approvalBadge(item({ approvalState: "approved", status: "approved" }))).toEqual({ label: "Approved", tone: "approved" });
    expect(approvalBadge(item({ approvalState: "approved", status: "deployed" })).label).toBe("Approved");
  });
  it("★★status approved with a changed copy reads CHANGED SINCE APPROVED, not approved", () => {
    for (const status of ["approved", "deployed", "paused"] as const) {
      expect(approvalBadge(item({ approvalState: "changed_since_approved", status }))).toEqual({
        label: "Changed since approved",
        tone: "changed",
      });
    }
  });
  it("not approved: awaiting review, generating, retired, or run without an approval", () => {
    expect(approvalBadge(item({ status: "review" }))).toEqual({ label: "Not approved", tone: "pending" });
    expect(approvalBadge(item({ status: "draft" }))).toEqual({ label: "Not approved", tone: "pending" });
    expect(approvalBadge(item({ status: "deployed" }))).toEqual({ label: "Not approved", tone: "pending" });
    expect(approvalBadge(item({ status: "generating" }))).toEqual({ label: "Being generated", tone: "muted" });
    expect(approvalBadge(item({ status: "retired" }))).toEqual({ label: "Retired", tone: "muted" });
  });
});

describe("★★approved, but no ad can use it (api review R1)", () => {
  it("★★never the green badge, and says why", () => {
    for (const coverageGap of ["no_landing_page", "no_headline"] as const) {
      expect(approvalBadge(item({ approvalState: "approved", status: "approved", coverageGap }))).toEqual({
        label: "Approved — can't be used",
        tone: "changed",
      });
    }
    expect(
      approvalDetail(item({ approvalState: "approved", status: "approved", coverageGap: "no_landing_page", approval: { at: "x", byYou: true } }), "d"),
    ).toBe("Approved by you on d, but no ad can use it: it has no landing page.");
    expect(
      approvalDetail(item({ approvalState: "approved", status: "approved", coverageGap: "no_headline", approval: { at: "x", byYou: true } }), null),
    ).toBe("Approved by you, but no ad can use it: it has no headline.");
  });
  it("the hub line counts them apart", () => {
    expect(reviewEntryLine(S({ total: 2, inForce: 1, approvedUnusable: 1 }))).toBe("1 approved · 1 approved but unusable.");
  });
  it("★★none usable in force: the switch is not offered, and the warning stands", () => {
    expect(approvedAssetsOffer(S({ total: 1, approvedUnusable: 1 }), false)).toBe("nothing_to_approve");
    expect(approvedAssetsWarning(S({ total: 1, approvedUnusable: 1 }), true)).not.toBeNull();
  });
});

describe("approvalDetail", () => {
  it("★approved: who and when, and that the engine may use it as it reads", () => {
    const s = approvalDetail(item({ approvalState: "approved", status: "approved", approval: { at: "x", byYou: true } }), "22 Oct 2026");
    expect(s).toBe("Approved by you on 22 Oct 2026. Peakhour may use it in ads it creates, exactly as it reads here.");
    expect(approvalDetail(item({ approvalState: "approved", approval: { at: "x", byYou: false } }), null)).toContain(
      "Approved by someone on your team.",
    );
  });
  it("★★changed: says Peakhour won't use it — and whether it can be approved again here", () => {
    const again = approvalDetail(item({ approvalState: "changed_since_approved", status: "approved", canApprove: true, approval: { at: "x", byYou: true } }), "d");
    expect(again).toContain("won't use it until you approve it again");
    const running = approvalDetail(item({ approvalState: "changed_since_approved", status: "deployed", canApprove: false, approval: { at: "x", byYou: true } }), "d");
    expect(running).toContain("can't be approved again here");
    expect(running).toContain("won't use it in a new ad");
  });
  it("not approved: a policy warning points at the note; otherwise says it won't be used", () => {
    expect(approvalDetail(item({ status: "draft", preflight: { decision: "warn", summary: "x" } }), null)).toContain("flagged it");
    expect(approvalDetail(item(), null)).toBe("Not approved. Peakhour won't use it while you only allow approved creatives.");
    expect(approvalDetail(item({ status: "deployed", canApprove: false }), null)).toContain("ran without your approval");
    expect(approvalDetail(item({ status: "generating" }), null)).toContain("Still being written");
    expect(approvalDetail(item({ status: "retired" }), null)).toContain("Retired");
  });
});

describe("emptyState — ★an empty list is never \"all fine\"", () => {
  it("★★no creative at all: says nothing was ever generated, and what the switch would do", () => {
    for (const f of CREATIVE_FILTERS) {
      const e = emptyState(S({ total: 0 }), f.key);
      expect(e.title).toBe("No ad creatives yet");
      expect(e.body).toContain("hasn't written any ad creatives");
      expect(e.body).toContain("will create no ads of its own");
    }
  });
  it("★a filter that matches none says so, with the business's total", () => {
    expect(emptyState(S({ total: 3 }), "to_review")).toEqual({
      title: "Nothing waiting for you",
      body: "No creative is waiting for your review. You have 3 creatives in all.",
    });
    expect(emptyState(S({ total: 1 }), "approved").body).toContain("You have 1 creative in all.");
    expect(emptyState(S({ total: 2 }), "running").title).toBe("None running");
    expect(emptyState(S({ total: 2 }), "retired").title).toBe("None retired");
    expect(emptyState(S({ total: 2 }), "all").title).toBe("No creatives");
  });
});

describe("★★approvedAssetsOffer — the guardrails card does not offer it with nothing to approve", () => {
  it("★★nothing ever generated, or nothing approvable: not offered", () => {
    expect(approvedAssetsOffer(S(), false)).toBe("nothing_to_approve");
    expect(approvedAssetsOffer(S({ total: 4, changedSinceApproved: 1 }), false)).toBe("nothing_to_approve");
  });
  it("★offered with one approved, or one waiting to be approved", () => {
    expect(approvedAssetsOffer(S({ total: 1, inForce: 1 }), false)).toBe("offer");
    expect(approvedAssetsOffer(S({ total: 1, approvable: 1 }), false)).toBe("offer");
  });
  it("★★always while on, so it can be turned off — even with nothing, even unknown", () => {
    expect(approvedAssetsOffer(S(), true)).toBe("offer");
    expect(approvedAssetsOffer(undefined, true)).toBe("offer");
  });
  it("★unknown (loading or failed) is not \"nothing to approve\"", () => {
    expect(approvedAssetsOffer(undefined, false)).toBe("unknown");
  });
});

describe("approvedAssetsWarning — on, with nothing in force", () => {
  it("★★on and none approved: every engine ad is refused, and says whether any wait", () => {
    expect(approvedAssetsWarning(S(), true)).toBe(
      "No creative is approved, and there is none to approve, so Peakhour creates no ads of its own.",
    );
    expect(approvedAssetsWarning(S({ total: 2, approvable: 2 }), true)).toContain("2 are waiting for your review");
    expect(approvedAssetsWarning(S({ total: 1, approvable: 1 }), true)).toContain("1 is waiting");
  });
  it("silent when off, when one is in force, or when unknown", () => {
    expect(approvedAssetsWarning(S(), false)).toBeNull();
    expect(approvedAssetsWarning(S({ total: 1, inForce: 1 }), true)).toBeNull();
    expect(approvedAssetsWarning(undefined, true)).toBeNull();
  });
});

describe("reviewEntryLine", () => {
  it("names what waits, what is approved and what changed", () => {
    expect(reviewEntryLine(S())).toBe("No ad creatives yet — nothing to review.");
    expect(reviewEntryLine(S({ total: 5, approvable: 2, inForce: 1, changedSinceApproved: 1 }))).toBe(
      "2 waiting for your review · 1 approved · 1 changed since approved.",
    );
    expect(reviewEntryLine(S({ total: 1 }))).toBe("1 creative, none to review.");
  });
});

describe("creativeActionError", () => {
  it("★each api refusal in the merchant's words", () => {
    expect(creativeActionError({ code: "CREATIVE_CHANGED", status: 409 }, "approve")).toContain("changed while you were looking");
    expect(creativeActionError({ code: "NOT_APPROVABLE", status: 409 }, "approve")).toContain("can't be approved now");
    expect(creativeActionError({ code: "NOT_APPROVED", status: 409 }, "withdraw")).toContain("isn't running");
    expect(creativeActionError({ code: "NOT_FOUND", status: 404 }, "approve")).toBe("This creative no longer exists.");
    expect(creativeActionError({ status: 401 }, "approve")).toContain("Sign in again");
    expect(creativeActionError({ status: 403 }, "withdraw")).toContain("Ask an owner");
    expect(creativeActionError(null, "approve")).toContain("couldn't reach");
    expect(creativeActionError({ code: "X", status: 500 }, "withdraw")).toBe("We couldn't take this approval back. Try again.");
    expect(creativeActionError({ code: "X", status: 500 }, "approve")).toBe("We couldn't approve this creative. Try again.");
  });
});

describe("filters and labels", () => {
  it("the default tab is To review (draft and review); an unknown key falls back to it", () => {
    expect(filterFor(null).statuses).toEqual(["draft", "review"]);
    expect(filterFor("nope").key).toBe("to_review");
    expect(filterFor("all").statuses).toEqual([]);
    expect(filterFor("running").statuses).toEqual(["deployed", "paused"]);
  });
  it("labels", () => {
    expect(platformLabel("google_ads")).toBe("Google Ads");
    expect(platformLabel("tiktok")).toBe("tiktok");
    expect(formatLabel("lead_gen_form")).toBe("Lead form");
    expect(formatLabel("new_thing")).toBe("new thing");
    expect(formatLabel(null)).toBeNull();
  });
});
