/**
 * Each Meta card's actions run under its product's own Meta login
 * (api `helpers/meta-login-purpose.ts`): Pages and Instagram are Content,
 * Meta Ads is Growth, WhatsApp is Embedded Signup and has no purpose.
 */
import { describe, it, expect } from "vitest";
import {
  META_VIRTUAL_CARDS,
  metaActionPurpose,
  metaCardServedBy,
  metaCardsDisconnectedBy,
  metaDisconnectCopy,
  metaGrantNote,
  metaLoginPurposeFor,
  withMetaLoginPurpose,
  type MetaLoginInfo,
} from "./integrations-meta";

const SHARED_ONLY: MetaLoginInfo = { metaConnections: [{ purpose: null, status: "active" }] };
const SHARED_AND_ADS: MetaLoginInfo = {
  metaConnections: [
    { purpose: null, status: "active" },
    { purpose: "ads", status: "active" },
  ],
};
const ADS_ONLY: MetaLoginInfo = { metaConnections: [{ purpose: "ads", status: "active" }] };

describe("Meta card → login purpose", () => {
  it("maps every virtual card, and WhatsApp to none", () => {
    expect(metaLoginPurposeFor("facebook_pages")).toBe("content");
    expect(metaLoginPurposeFor("instagram")).toBe("content");
    expect(metaLoginPurposeFor("meta_ads")).toBe("ads");
    expect(metaLoginPurposeFor("whatsapp")).toBeUndefined();
    expect(metaLoginPurposeFor("linkedin_ads")).toBeUndefined();
  });

  it("★every non-WhatsApp Meta card carries a purpose — a new card cannot silently connect all-purpose", () => {
    for (const card of META_VIRTUAL_CARDS) {
      if (card.virtualProvider === "whatsapp") continue;
      expect(card.loginPurpose, card.virtualProvider).toBeDefined();
    }
  });
});

describe("withMetaLoginPurpose", () => {
  it("sets the parameter on a path with a query, without one, and before a fragment", () => {
    expect(withMetaLoginPurpose("/v1/integrations/facebook/authorize?returnTo=%2Fx", "ads")).toBe(
      "/v1/integrations/facebook/authorize?returnTo=%2Fx&purpose=ads",
    );
    expect(withMetaLoginPurpose("/v1/integrations/facebook", "content")).toBe(
      "/v1/integrations/facebook?purpose=content",
    );
    expect(withMetaLoginPurpose("/a?b=1#frag", "ads")).toBe("/a?b=1&purpose=ads#frag");
    expect(withMetaLoginPurpose("/a?purpose=content", "ads")).toBe("/a?purpose=ads");
  });

  it("leaves the path alone with no purpose", () => {
    expect(withMetaLoginPurpose("/v1/integrations/linkedin_ads", undefined)).toBe("/v1/integrations/linkedin_ads");
  });
});

describe("★which row serves a card, and what an action sends", () => {
  it("a purpose row wins over the shared row, as in the api's resolver", () => {
    expect(metaCardServedBy(SHARED_AND_ADS, "meta_ads")).toBe("purpose");
    expect(metaCardServedBy(SHARED_AND_ADS, "facebook_pages")).toBe("shared");
    expect(metaCardServedBy(ADS_ONLY, "facebook_pages")).toBe("none");
  });

  it("connect sends the card's purpose", () => {
    expect(metaActionPurpose({}, "meta_ads")).toBe("ads");
    expect(metaActionPurpose(ADS_ONLY, "instagram")).toBe("content");
  });

  it("★★reconnecting a card served by a BROKEN shared row runs all-purpose, so the shared token is replaced in place", () => {
    const broken: MetaLoginInfo = { metaConnections: [{ purpose: null, status: "needs_reauth" }] };
    expect(metaActionPurpose(broken, "meta_ads")).toBeUndefined();
    expect(metaActionPurpose(broken, "facebook_pages")).toBeUndefined();
    // But a card with its OWN row reconnects that row.
    const brokenSharedLiveAds: MetaLoginInfo = {
      metaConnections: [
        { purpose: null, status: "needs_reauth" },
        { purpose: "ads", status: "needs_reauth" },
      ],
    };
    expect(metaActionPurpose(brokenSharedLiveAds, "meta_ads")).toBe("ads");
  });

  it("WhatsApp never sends a purpose", () => {
    expect(metaActionPurpose(SHARED_ONLY, "whatsapp")).toBeUndefined();
  });
});

describe("★the grant note says only what is true in this environment", () => {
  it("without a dedicated configuration it says the login is combined", () => {
    for (const p of ["facebook_pages", "instagram", "meta_ads"]) {
      expect(metaGrantNote(p, { content: false, ads: false })).toMatch(/together/);
      expect(metaGrantNote(p, undefined)).toMatch(/together/);
    }
    expect(metaGrantNote("facebook_pages", { ads: true })).toMatch(/together/);
  });

  it("with one, Meta Ads promises no Page posting and Content promises no ad accounts", () => {
    expect(metaGrantNote("meta_ads", { ads: true })).toMatch(/only for ad account/);
    expect(metaGrantNote("meta_ads", { ads: true })).toMatch(/not to post/);
    expect(metaGrantNote("facebook_pages", { content: true })).toMatch(/not your ad accounts/);
  });

  it("WhatsApp and non-Meta cards have nothing to say", () => {
    expect(metaGrantNote("whatsapp", { content: true, ads: true })).toBeNull();
    expect(metaGrantNote("x", { ads: true })).toBeNull();
  });
});

describe("★★Disconnect names exactly what goes", () => {
  it("a shared row takes Pages, Instagram and Meta Ads together", () => {
    expect(metaCardsDisconnectedBy(SHARED_ONLY, "meta_ads").sort()).toEqual(["facebook_pages", "instagram", "meta_ads"]);
    expect(metaDisconnectCopy(SHARED_ONLY, "meta_ads")).toBe(
      "This disconnects Facebook Pages, Instagram and Meta Ads, which share one Meta login. WhatsApp Business stays connected.",
    );
  });

  it("a Growth row takes only Meta Ads", () => {
    expect(metaCardsDisconnectedBy(SHARED_AND_ADS, "meta_ads")).toEqual(["meta_ads"]);
    expect(metaDisconnectCopy(SHARED_AND_ADS, "meta_ads")).toBe(
      "This disconnects Meta Ads. Facebook Pages, Instagram and WhatsApp Business stay connected.",
    );
  });

  it("the shared row beside a Growth row takes only the cards it still serves", () => {
    expect(metaCardsDisconnectedBy(SHARED_AND_ADS, "facebook_pages").sort()).toEqual(["facebook_pages", "instagram"]);
    expect(metaDisconnectCopy(SHARED_AND_ADS, "instagram")).toBe(
      "This disconnects Facebook Pages and Instagram, which share one Meta login. Meta Ads and WhatsApp Business stay connected.",
    );
  });

  it("never claims WhatsApp goes with it", () => {
    for (const info of [SHARED_ONLY, SHARED_AND_ADS, ADS_ONLY, {}]) {
      for (const p of ["facebook_pages", "instagram", "meta_ads"]) {
        expect(metaDisconnectCopy(info, p)).toMatch(/WhatsApp Business (stay|stays) connected/);
      }
    }
  });
});
