import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALL_STORES_NOTE,
  SCOPE_LABEL,
  dedupeRows,
  offersAllStores,
  openAddress,
  openAllStoresRow,
  openFailedMessage,
  rowOfAllStores,
  scopeFromParam,
  storeChipLabel,
  type AllStoresConversation,
} from "@/lib/inbox-all-stores";
import { allStoresParams } from "@/hooks/use-all-stores-inbox";
import { CHANNEL_LABEL, dmChannelOf, emptyListText, threadFromParam, visibleChannelFilters } from "@/lib/inbox-view";
import { replyWindow, windowFor, composerMode } from "@/lib/wa-inbox-reply";

/**
 * "All my stores" (I3f): the words, the row, the address and the open flow. The api decides who is a member and what each state is
 * (peakhour-api tests/unit/inbox-all-stores.test.ts); this proves what the page does with the answer.
 */

const conv = (over: Partial<AllStoresConversation> = {}): AllStoresConversation => ({
  businessId: "b1",
  businessName: "North store",
  threadId: "whatsapp:1:a",
  channel: "whatsapp",
  contactName: "Asha",
  waId: "",
  status: "active",
  updatedAt: "2026-11-03T10:00:00Z",
  preview: "hello",
  held: null,
  needsYou: false,
  state: "open",
  assignee: null,
  tagIds: [],
  timer: null,
  ...over,
});

describe("the toggle", () => {
  it("is offered to someone with more than one store, and to no one else", () => {
    expect(offersAllStores(0)).toBe(false);
    expect(offersAllStores(1)).toBe(false);
    expect(offersAllStores(2)).toBe(true);
  });
  it("reads the scope from the address: only 'all' means all", () => {
    expect(scopeFromParam("all")).toBe("all");
    for (const v of [null, undefined, "", "store", "ALL", "everything"]) expect(scopeFromParam(v as string | null)).toBe("store");
  });
  it("uses the words the owner's plan names", () => {
    expect(SCOPE_LABEL).toEqual({ store: "This store", all: "All my stores" });
    expect(ALL_STORES_NOTE).toBe("Conversations from all your stores, newest first. Opening one switches to that store.");
  });
});

describe("a row", () => {
  it("keeps the store it belongs to and is titled like any other row", () => {
    const r = rowOfAllStores(conv());
    expect(r).toMatchObject({ businessId: "b1", businessName: "North store", title: "Asha", threadId: "whatsapp:1:a", state: "open" });
  });
  it("falls back to the number, then to a plain word, never to nothing", () => {
    expect(rowOfAllStores(conv({ contactName: null, waId: "919800000001" })).title).toBe("919800000001");
    expect(rowOfAllStores(conv({ contactName: null, waId: "" })).title).toBe("Contact");
    expect(rowOfAllStores(conv({ contactName: null, channel: "storefront" })).title).toBe("Storefront visitor");
  });
  it("lists a conversation once, keeping its first (newest) copy", () => {
    expect(dedupeRows([{ threadId: "a", n: 1 }, { threadId: "b", n: 2 }, { threadId: "a", n: 3 }])).toEqual([{ threadId: "a", n: 1 }, { threadId: "b", n: 2 }]);
  });
  it("labels a store chip with how many of the loaded rows are in it, and nothing for none", () => {
    expect(storeChipLabel({ name: "North store", count: 3, needsYou: 1 })).toBe("North store (3)");
    expect(storeChipLabel({ name: "South store", count: 0, needsYou: 0 })).toBe("South store");
  });
});

describe("the request", () => {
  it("sends the chip, and only the filters that narrow", () => {
    expect(allStoresParams({ status: "open", assignee: "all", channel: "all", store: null }, undefined)).toEqual({ status: "open" });
    expect(allStoresParams({ status: "needs_you", assignee: "mine", channel: "messenger", store: "b2" }, "c1")).toEqual({ status: "needs_you", assignee: "mine", channel: "messenger", store: "b2", cursor: "c1" });
  });
});

describe("opening a row", () => {
  it("switches to the row's store FIRST, then opens the conversation", async () => {
    const order: string[] = [];
    const switchBusiness = vi.fn<(id: string) => Promise<void>>(async (id) => void order.push(`switch:${id}`));
    const open = vi.fn<(t: string) => void>((t) => void order.push(`open:${t}`));
    const res = await openAllStoresRow({ row: { businessId: "b2", businessName: "South store", threadId: "whatsapp:2:c" }, activeBusinessId: "b1", switchBusiness, open });
    expect(res).toEqual({ ok: true });
    expect(order).toEqual(["switch:b2", "open:whatsapp:2:c"]);
  });

  it("does not switch for a row in the store the session is already in", async () => {
    const switchBusiness = vi.fn<(id: string) => Promise<void>>(async () => {});
    const open = vi.fn<(t: string) => void>();
    await openAllStoresRow({ row: { businessId: "b1", businessName: "North store", threadId: "whatsapp:1:a" }, activeBusinessId: "b1", switchBusiness, open });
    expect(switchBusiness).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith("whatsapp:1:a");
  });

  it("opens NOTHING when the switch fails, and says which store it could not reach", async () => {
    const switchBusiness = vi.fn<(id: string) => Promise<void>>(async () => {
      throw new Error("403");
    });
    const open = vi.fn<(t: string) => void>();
    const res = await openAllStoresRow({ row: { businessId: "b2", businessName: "South store", threadId: "whatsapp:2:c" }, activeBusinessId: "b1", switchBusiness, open });
    expect(res).toEqual({ ok: false, message: "Couldn't switch to South store, so the conversation was not opened. Try again." });
    expect(open).not.toHaveBeenCalled();
    expect(openFailedMessage("X")).toContain("Couldn't switch to X");
  });

  it("names the thread in the address and drops the scope, keeping the other filters", () => {
    expect(openAddress("/dashboard/inbox", "tab=conversations&scope=all&assignee=mine", "whatsapp:2:c")).toBe("/dashboard/inbox?tab=conversations&assignee=mine&thread=whatsapp%3A2%3Ac");
  });

  it("an address can open a Messenger or Instagram conversation, which the list can now hand over", () => {
    expect(threadFromParam("messenger:123:" + "a".repeat(32))).toBe("messenger:123:" + "a".repeat(32));
    expect(threadFromParam("instagram:123:" + "b".repeat(32))).not.toBeNull();
    expect(threadFromParam("slack:1:2")).toBeNull();
  });
});

describe("the page wiring", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
  const page = read("src/app/(site)/dashboard/inbox/page.tsx");
  const pane = read("src/components/inbox/all-stores-pane.tsx");

  it("shows the toggle and the pane only to someone with more than one store, and the scope only through the address", () => {
    expect(page).toContain("offersAllStores(businesses.length)");
    expect(page).toContain('offersAllStores(businesses.length) ? scopeFromParam(params.get("scope")) : "store"');
    expect(page).toContain("<AllStoresPane onOpen={openFromAllStores} />");
  });
  it("opens a row through the switch-then-open flow, once at a time, and says when it failed", () => {
    expect(pane).toContain("openAllStoresRow({ row, activeBusinessId: business?._id, switchBusiness, open: onOpen })");
    expect(pane).toContain("if (opening) return;");
    expect(pane).toContain("toast.error(res.message)");
  });
  it("offers nothing that writes: no reply, assign or done control in the pane", () => {
    expect(pane).not.toMatch(/useWaReply|useMarkDone|useAssign|WaComposer|api\.(post|put|patch|delete)/);
  });
});

describe("X conversations (I3f)", () => {
  const xThread = "x:1234:" + "a".repeat(32);
  it("has its own label, empty-list sentence and link form", () => {
    expect(CHANNEL_LABEL.x).toBe("X");
    expect(dmChannelOf("x")).toBe("x");
    expect(dmChannelOf("sms")).toBe("whatsapp");
    expect(emptyListText("x", "ok")).toBe("No X conversations yet.");
    expect(threadFromParam(xThread)).toBe(xThread);
  });
  it("the X chip is hidden until the business has an X conversation (or has chosen it)", () => {
    expect(visibleChannelFilters([], "all").map((f) => f.value)).not.toContain("x");
    expect(visibleChannelFilters(["whatsapp"], "all").map((f) => f.value)).not.toContain("x");
    expect(visibleChannelFilters(["x"], "all").map((f) => f.value)).toContain("x");
    expect(visibleChannelFilters([], "x").map((f) => f.value)).toContain("x");
  });
  it("an all-stores X row keeps its channel", () => {
    expect(rowOfAllStores(conv({ threadId: xThread, channel: "x" })).channel).toBe("x");
  });
  it("an X thread never falls to the WhatsApp template picker: it has no window, so free text stays on offer", () => {
    const closed = replyWindow(null, Date.now());
    expect(composerMode({ status: "active", role: "editor", window: closed }).kind).toBe("template");
    expect(composerMode({ status: "active", role: "editor", window: windowFor(xThread, closed) }).kind).toBe("text");
    // every other thread keeps what the api sent
    expect(windowFor("whatsapp:1:a", closed)).toBe(closed);
    expect(windowFor("messenger:1:" + "b".repeat(32), closed)).toBe(closed);
  });
  it("a viewer on an X thread still gets the read-only sentence, not a box", () => {
    expect(composerMode({ status: "active", role: "viewer", window: windowFor(xThread, replyWindow(null, 0)) }).kind).toBe("readonly");
  });
  it("the composer reads the window through windowFor, and the WhatsApp-only sends stay gated to whatsapp threads", () => {
    const composer = readFileSync(resolve(__dirname, "../..", "src/components/inbox/wa-composer.tsx"), "utf8");
    expect(composer).toContain("windowFor(threadId, useReplyWindow(store, threadId, endsAt))");
    expect(composer).toContain('threadId.startsWith("whatsapp:") && (');
  });
});
