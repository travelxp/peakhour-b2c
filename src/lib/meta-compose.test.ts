import { describe, expect, it } from "vitest";
import {
  buildMetaChannel,
  countHashtags,
  metaComposeTargets,
  metaPostProblems,
  metaPostTitle,
  publishedLink,
  threadsTextLength,
  type MetaIntegrationRow,
  type MetaMedia,
} from "./meta-compose";

const photo = (n = 1): MetaMedia[] => Array.from({ length: n }, (_, i) => ({ url: `https://cdn.example.com/${i}.jpg`, mime: "image/jpeg" }));
const clip: MetaMedia = { url: "https://cdn.example.com/clip.mp4", mime: "video/mp4" };
const draft = (text: string, media: MetaMedia[] = [], link = "") => ({ text, media, link });

describe("metaPostProblems: Instagram", () => {
  it("needs a picture or a video, and says so in plain words", () => {
    expect(metaPostProblems("instagram", draft("Fresh bread today"))).toEqual(["Instagram posts need a picture or a video. Add one from Drive."]);
    expect(metaPostProblems("instagram", draft("Fresh bread today", photo()))).toEqual([]);
  });

  it("holds a caption to 2,200 characters, at the boundary", () => {
    expect(metaPostProblems("instagram", draft("x".repeat(2200), photo()))).toEqual([]);
    expect(metaPostProblems("instagram", draft("x".repeat(2201), photo()))).toEqual(["Instagram allows 2,200 characters. This is 2,201."]);
  });

  it("holds a caption to 30 hashtags, at the boundary", () => {
    const tags = (n: number) => Array.from({ length: n }, (_, i) => `#tag${i}`).join(" ");
    expect(metaPostProblems("instagram", draft(tags(30), photo()))).toEqual([]);
    expect(metaPostProblems("instagram", draft(tags(31), photo()))).toEqual(["Instagram allows 30 hashtags. This has 31."]);
  });

  it("takes up to 10 pictures, and a video only on its own", () => {
    expect(metaPostProblems("instagram", draft("Hi", photo(10)))).toEqual([]);
    expect(metaPostProblems("instagram", draft("Hi", photo(11)))).toEqual(["Instagram takes up to 10 pictures in one post. Remove 1."]);
    expect(metaPostProblems("instagram", draft("Hi", [clip]))).toEqual([]);
    expect(metaPostProblems("instagram", draft("Hi", [...photo(), clip]))).toEqual(["A video goes on its own. Remove the other items, or use pictures only."]);
  });

  it("needs a caption", () => {
    expect(metaPostProblems("instagram", draft("   ", photo()))).toEqual(["Write a caption for your post."]);
  });
});

describe("metaPostProblems: Threads", () => {
  it("allows text only, up to 500, counting an emoji as its bytes", () => {
    expect(metaPostProblems("threads", draft("Hello"))).toEqual([]);
    expect(metaPostProblems("threads", draft("a".repeat(500)))).toEqual([]);
    expect(metaPostProblems("threads", draft("a".repeat(501)))).toEqual(["Threads allows 500 characters. This is 501."]);
    // 496 letters + one emoji (4 bytes) is exactly 500; the emoji counts for more than one
    expect(threadsTextLength("a".repeat(496) + "😀")).toBe(500);
    expect(metaPostProblems("threads", draft("a".repeat(497) + "😀"))).toEqual(["Threads allows 500 characters. This is 501."]);
  });

  it("takes pictures only", () => {
    expect(metaPostProblems("threads", draft("Look", photo(3)))).toEqual([]);
    expect(metaPostProblems("threads", draft("Look", [clip]))).toEqual(["Threads posts from here take pictures only. Remove the video."]);
  });

  it("takes up to 12 pictures, the most the scheduler accepts in one post", () => {
    expect(metaPostProblems("threads", draft("Look", photo(12)))).toEqual([]);
    expect(metaPostProblems("threads", draft("Look", photo(13)))).toEqual(["Threads takes up to 12 pictures in one post. Remove 1."]);
  });

  it("allows 5 links, counting each once and a bare domain as a link, like the api", () => {
    const links = (n: number) => Array.from({ length: n }, (_, i) => `https://shop${i}.example.com/p`).join(" ");
    expect(metaPostProblems("threads", draft(links(5)))).toEqual([]);
    expect(metaPostProblems("threads", draft(links(6)))).toEqual(["Threads allows 5 links in a post. This has 6."]);
    expect(metaPostProblems("threads", draft("https://a.example.com/x/ www.a.example.com/x a.example.com/x"))).toEqual([]);
    expect(metaPostProblems("threads", draft("a.com b.com c.com d.com e.com f.com"))).toEqual(["Threads allows 5 links in a post. This has 6."]);
    expect(metaPostProblems("threads", draft("mail me@acme.com"))).toEqual([]);
  });

  it("has no hashtag limit of its own", () => {
    const tags = Array.from({ length: 40 }, (_, i) => `#t${i}`).join(" ");
    expect(metaPostProblems("threads", draft(tags))).toEqual([]);
  });
});

describe("metaPostProblems: Facebook", () => {
  it("takes text alone, with the link optional", () => {
    expect(metaPostProblems("facebook", draft("Sale on now"))).toEqual([]);
    expect(metaPostProblems("facebook", draft("Sale on now", [], "https://shop.example.com/sale"))).toEqual([]);
  });

  it("refuses a link that is not a web address", () => {
    expect(metaPostProblems("facebook", draft("Sale", [], "shop.example.com"))).toEqual(["The link needs to start with http:// or https://."]);
    expect(metaPostProblems("facebook", draft("Sale", [], "javascript:alert(1)"))).toEqual(["The link needs to start with http:// or https://."]);
  });

  it("refuses a link with pictures, because Facebook shows the pictures and drops the link", () => {
    expect(metaPostProblems("facebook", draft("Sale", photo(), "https://shop.example.com"))).toEqual(["A link can't go with pictures. Remove the pictures, or the link."]);
  });

  it("holds text to what the scheduler takes, 20,000 characters", () => {
    expect(metaPostProblems("facebook", draft("x".repeat(20_000)))).toEqual([]);
    expect(metaPostProblems("facebook", draft("x".repeat(20_001)))).toEqual(["Facebook allows 20,000 characters. This is 20,001."]);
  });

  it("takes up to 10 pictures and no video", () => {
    expect(metaPostProblems("facebook", draft("Album", photo(10)))).toEqual([]);
    expect(metaPostProblems("facebook", draft("Album", photo(11)))).toEqual(["Facebook takes up to 10 pictures in one post. Remove 1."]);
    expect(metaPostProblems("facebook", draft("Clip", [clip]))).toEqual(["Facebook posts from here take pictures only. Remove the video."]);
  });

  it("an empty post says what to do", () => {
    expect(metaPostProblems("facebook", draft(""))).toEqual(["Write something to post."]);
  });
});

describe("countHashtags", () => {
  it("counts a tag only where one starts a word", () => {
    expect(countHashtags("#a #b_2 #ñandú")).toBe(3);
    expect(countHashtags("C# and a#b and ##x and # alone")).toBe(0);
  });
});

describe("buildMetaChannel: what is sent", () => {
  it("sends the channel, the trimmed text and the media, and no page id", () => {
    expect(buildMetaChannel("instagram", draft("  Fresh bread  ", photo(2)))).toEqual({
      channel: "instagram",
      payload: { text: "Fresh bread", mediaUrls: ["https://cdn.example.com/0.jpg", "https://cdn.example.com/1.jpg"] },
    });
  });

  it("sends a Facebook link as a channel option, and only for Facebook", () => {
    expect(buildMetaChannel("facebook", draft("Sale", [], " https://shop.example.com "))).toEqual({
      channel: "facebook",
      payload: { text: "Sale", channelOptions: { link: "https://shop.example.com" } },
    });
    expect(buildMetaChannel("threads", draft("Hi", [], "https://shop.example.com")).payload).toEqual({ text: "Hi" });
  });

  it("says a single Instagram video is a Reel, because its address may not end in a video extension", () => {
    const signed: MetaMedia = { url: "https://cdn.example.com/media/abc123", mime: "video/mp4" };
    expect(buildMetaChannel("instagram", draft("Clip", [signed])).payload).toEqual({
      text: "Clip",
      mediaUrls: ["https://cdn.example.com/media/abc123"],
      channelOptions: { mediaType: "REELS" },
    });
    expect(buildMetaChannel("instagram", draft("Pic", photo())).payload).not.toHaveProperty("channelOptions");
  });

  it("sends a text-only post with no media key at all", () => {
    expect(buildMetaChannel("threads", draft("Hi")).payload).not.toHaveProperty("mediaUrls");
  });
});

describe("metaComposeTargets: only what is connected", () => {
  const facebookRow = (extra: Record<string, unknown>, connected = true): MetaIntegrationRow => ({ provider: "facebook", connected, account: { extra } });
  const pages = [
    { pageId: "p1", pageName: "Acme Bakery", instagramAccountId: "ig1", instagramUsername: "acmebakery" },
    { pageId: "p2", pageName: "Acme Cafe" },
  ];

  it("offers nothing before the list has loaded or when nothing is connected", () => {
    expect(metaComposeTargets(undefined)).toEqual([]);
    expect(metaComposeTargets([])).toEqual([]);
    expect(metaComposeTargets([facebookRow({ pages }, false)])).toEqual([]);
  });

  it("offers Facebook and Instagram from one connection, naming the saved Page and account", () => {
    expect(metaComposeTargets([facebookRow({ pages, primaryPageId: "p2", instagramAccountId: "ig1" })])).toEqual([
      { channel: "facebook", postingTo: "Posting to Acme Cafe" },
      { channel: "instagram", postingTo: "Posting to @acmebakery" },
    ]);
  });

  it("does not offer Instagram when no Page has an account linked", () => {
    expect(metaComposeTargets([facebookRow({ pages: [pages[1]], primaryPageId: "p2" })])).toEqual([{ channel: "facebook", postingTo: "Posting to Acme Cafe" }]);
  });

  it("does not offer Facebook when the Pages capability is off, but still offers Instagram", () => {
    const row = facebookRow({ pages, instagramAccountId: "ig1", capabilities: { pages: { enabled: false } } });
    expect(metaComposeTargets([row]).map((t) => t.channel)).toEqual(["instagram"]);
  });

  it("names the linked Page when an Instagram account has no username", () => {
    const row = facebookRow({ pages: [{ pageId: "p1", pageName: "Acme Bakery", instagramAccountId: "ig1" }], instagramAccountId: "ig1" });
    expect(metaComposeTargets([row])[1]).toEqual({ channel: "instagram", postingTo: "Posting to the Instagram account linked to Acme Bakery" });
  });

  it("offers Threads from its own connection", () => {
    const threads: MetaIntegrationRow = { provider: "threads", connected: true, account: { name: "Acme", extra: { username: "acme" } } };
    expect(metaComposeTargets([threads])).toEqual([{ channel: "threads", postingTo: "Posting to @acme" }]);
    expect(metaComposeTargets([{ ...threads, connected: false }])).toEqual([]);
  });

  it("offers a connected channel even when the connection names nothing", () => {
    expect(metaComposeTargets([facebookRow({ pages: [] })])).toEqual([]);
    expect(metaComposeTargets([{ provider: "threads", connected: true }])).toEqual([{ channel: "threads", postingTo: null }]);
  });
});

describe("publishedLink", () => {
  it("sends Facebook and Instagram to their hub and Threads to the post", () => {
    expect(publishedLink("facebook", undefined).href).toBe("/dashboard/content/facebook");
    expect(publishedLink("instagram", "https://instagram.com/p/x")).toMatchObject({ href: "/dashboard/content/instagram", external: false });
    expect(publishedLink("threads", "https://www.threads.com/@acme/post/1")).toEqual({ href: "https://www.threads.com/@acme/post/1", label: "View on Threads", external: true });
    expect(publishedLink("threads", undefined)).toMatchObject({ href: "/dashboard/calendar", external: false });
  });
});

describe("metaPostTitle", () => {
  it("is the first non-empty line, cut to 120", () => {
    expect(metaPostTitle("\n\n  Fresh bread\nmore")).toBe("Fresh bread");
    expect(metaPostTitle("x".repeat(200))).toHaveLength(120);
    expect(metaPostTitle("   ")).toBeUndefined();
  });
});
