import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { adImageUploadFailure } from "@/lib/meta-ads-view";

const api = (code: string, message: string, status: number) => new ApiError(code, message, status);

describe("adImageUploadFailure: what the ad dialog says when the server could not send the Drive image to Meta", () => {
  it("a file that can never work is named and let go", () => {
    expect(adImageUploadFailure(api("IMAGE_TOO_LARGE", "That image is over 30 MB, Meta's limit.", 413))).toEqual({
      message: "That image is over 30 MB, Meta's limit.",
      clearImage: true,
    });
    expect(adImageUploadFailure(api("IMAGE_INVALID", "That file isn't a JPEG or PNG image.", 400)).clearImage).toBe(true);
    expect(adImageUploadFailure(api("NOT_FOUND", "That file is no longer in Drive.", 404))).toEqual({
      message: "That image is no longer in your Drive. Choose another one.",
      clearImage: true,
    });
  });

  it("a role or storage problem keeps the image and never says to pick another", () => {
    const role = adImageUploadFailure(api("FORBIDDEN", "This action requires editor role", 403));
    expect(role.clearImage).toBe(false);
    expect(role.message).toMatch(/editor access/);
    for (const code of ["READ_FAILED", "PRIVATE_STORAGE_UNAVAILABLE"]) {
      const r = adImageUploadFailure(api(code, "raw server text", code === "READ_FAILED" ? 502 : 503));
      expect(r).toEqual({ message: "We couldn't read that image from your Drive just now. Try again in a moment.", clearImage: false });
    }
  });

  it("anything else is a neutral retry, not 'try a different one'", () => {
    const r = adImageUploadFailure(api("UPLOAD_FAILED", "graph said no", 400));
    expect(r.clearImage).toBe(false);
    expect(r.message).not.toMatch(/different one/);
    expect(adImageUploadFailure(new Error("boom")).clearImage).toBe(false);
  });
});
