/**
 * Each Meta card's actions run under its product's own Meta login
 * (api `helpers/meta-login-purpose.ts`): Pages and Instagram are Content,
 * Meta Ads is Growth, WhatsApp is Embedded Signup and has no purpose.
 */
import { describe, it, expect } from "vitest";
import {
  META_VIRTUAL_CARDS,
  metaDisconnectCopy,
  metaGrantNote,
  metaLoginPurposeFor,
  withMetaLoginPurpose,
} from "./integrations-meta";

describe("Meta card → login purpose", () => {
  it("maps every virtual card, and WhatsApp to none", () => {
    expect(metaLoginPurposeFor("facebook_pages")).toBe("content");
    expect(metaLoginPurposeFor("instagram")).toBe("content");
    expect(metaLoginPurposeFor("meta_ads")).toBe("ads");
    expect(metaLoginPurposeFor("whatsapp")).toBeUndefined();
    expect(metaLoginPurposeFor("linkedin_ads")).toBeUndefined();
  });

  it("★every non-WhatsApp Meta card has a purpose — a new card cannot silently connect all-purpose", () => {
    for (const card of META_VIRTUAL_CARDS) {
      if (card.virtualProvider === "whatsapp") continue;
      expect(metaLoginPurposeFor(card.virtualProvider), card.virtualProvider).toBeDefined();
    }
  });
});

describe("withMetaLoginPurpose", () => {
  it("appends to a path with a query, and to one without", () => {
    expect(withMetaLoginPurpose("/v1/integrations/facebook/authorize?returnTo=%2Fx", "meta_ads")).toBe(
      "/v1/integrations/facebook/authorize?returnTo=%2Fx&purpose=ads",
    );
    expect(withMetaLoginPurpose("/v1/integrations/facebook", "facebook_pages")).toBe(
      "/v1/integrations/facebook?purpose=content",
    );
  });

  it("leaves every other card's path alone", () => {
    expect(withMetaLoginPurpose("/v1/integrations/linkedin_ads", "linkedin_ads")).toBe("/v1/integrations/linkedin_ads");
    expect(withMetaLoginPurpose("/v1/integrations/facebook", "whatsapp")).toBe("/v1/integrations/facebook");
  });
});

describe("★the grant note says only what is true in this environment", () => {
  it("without a dedicated configuration it says the login is combined", () => {
    for (const p of ["facebook_pages", "instagram", "meta_ads"]) {
      expect(metaGrantNote(p, false)).toMatch(/together/);
      expect(metaGrantNote(p, undefined)).toMatch(/together/);
    }
  });

  it("with one, Meta Ads promises no Page posting and Content promises no ad accounts", () => {
    expect(metaGrantNote("meta_ads", true)).toMatch(/only for ad account/);
    expect(metaGrantNote("meta_ads", true)).toMatch(/not to post/);
    expect(metaGrantNote("facebook_pages", true)).toMatch(/not your ad accounts/);
  });

  it("WhatsApp and non-Meta cards have nothing to say", () => {
    expect(metaGrantNote("whatsapp", true)).toBeNull();
    expect(metaGrantNote("x", true)).toBeNull();
  });
});

describe("Disconnect copy", () => {
  it("never claims WhatsApp goes with it", () => {
    for (const p of ["facebook_pages", "instagram", "meta_ads"]) {
      expect(metaDisconnectCopy(p)).toMatch(/WhatsApp stays connected/);
    }
  });
});
