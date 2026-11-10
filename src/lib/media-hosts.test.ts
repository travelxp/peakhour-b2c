import { describe, it, expect } from "vitest";
import { isMediaImageUrl, mediaImageHosts } from "./media-hosts";

describe("mediaImageHosts", () => {
  it("always has the dev media host and adds only bare hostnames from the env list", () => {
    expect(mediaImageHosts(undefined)).toEqual(["media-dev.peakhour.ai"]);
    expect(mediaImageHosts("media.peakhour.ai, MEDIA-EU.peakhour.ai")).toEqual(["media-dev.peakhour.ai", "media.peakhour.ai", "media-eu.peakhour.ai"]);
  });
  it("drops wildcards, schemes, paths and ports: the list can never become an open proxy", () => {
    expect(mediaImageHosts("**, *.com, https://a.example.com, a.example.com/x, a.example.com:8080, localhost")).toEqual(["media-dev.peakhour.ai"]);
  });
});

describe("isMediaImageUrl", () => {
  const hosts = ["media.peakhour.ai"];
  it("accepts https on a listed host only", () => {
    expect(isMediaImageUrl("https://media.peakhour.ai/a/b.png", hosts)).toBe(true);
    expect(isMediaImageUrl("http://media.peakhour.ai/a.png", hosts)).toBe(false);
    expect(isMediaImageUrl("https://evil.example.com/a.png", hosts)).toBe(false);
    expect(isMediaImageUrl("https://media.peakhour.ai.evil.com/a.png", hosts)).toBe(false);
    expect(isMediaImageUrl("blob:https://app/xyz", hosts)).toBe(false);
    expect(isMediaImageUrl("data:image/png;base64,AA", hosts)).toBe(false);
    expect(isMediaImageUrl("", hosts)).toBe(false);
  });
});
