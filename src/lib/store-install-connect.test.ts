import { describe, expect, it } from "vitest";
import {
  BUCKET_EXAMPLE,
  ISSUER_ID_EXAMPLE,
  appStoreConnectBody,
  appStoreFormProblem,
  bucketIdOf,
  looksLikeP8,
  looksLikeServiceAccount,
  playConsoleBody,
  playFormProblem,
} from "./store-install-connect";

const P8 = "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg\n-----END PRIVATE KEY-----\n";
const SA = JSON.stringify({ type: "service_account", client_email: "peakhour@acme.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" });
const apple = { issuerId: ISSUER_ID_EXAMPLE, keyId: "2X9R4HXF34", vendorNumber: "85012345", p8: P8 };

describe("App Store Connect form", () => {
  it("accepts a complete form and sends the key as the credential and the ids as settings, trimmed", () => {
    expect(appStoreFormProblem(apple)).toBeNull();
    expect(appStoreConnectBody({ ...apple, issuerId: ` ${ISSUER_ID_EXAMPLE} `, keyId: " 2X9R4HXF34 ", vendorNumber: " 85012345 ", p8: `\n${P8}\n` })).toEqual({
      apiKey: P8.trim(),
      config: { issuerId: ISSUER_ID_EXAMPLE, keyId: "2X9R4HXF34", vendorNumber: "85012345" },
    });
  });
  it("names the first thing wrong", () => {
    expect(appStoreFormProblem({ ...apple, issuerId: "nope" })).toMatch(/Issuer ID/);
    expect(appStoreFormProblem({ ...apple, keyId: "short" })).toMatch(/Key ID/);
    expect(appStoreFormProblem({ ...apple, vendorNumber: "85a" })).toMatch(/vendor number/);
    expect(appStoreFormProblem({ ...apple, p8: "AuthKey_2X9R4HXF34.p8" })).toMatch(/\.p8/);
  });
  it("tells a .p8 from anything else", () => {
    expect(looksLikeP8(P8)).toBe(true);
    expect(looksLikeP8("-----BEGIN PRIVATE KEY-----")).toBe(false);
    expect(looksLikeP8(SA)).toBe(false);
  });
});

describe("Play Console form", () => {
  it("accepts a bucket id or its gs:// address and a service account key", () => {
    expect(playFormProblem({ bucket: BUCKET_EXAMPLE, serviceAccountJson: SA })).toBeNull();
    expect(playFormProblem({ bucket: `gs://${BUCKET_EXAMPLE}/stats`, serviceAccountJson: SA })).toBeNull();
    expect(playConsoleBody({ bucket: ` gs://${BUCKET_EXAMPLE}/stats/installs `, serviceAccountJson: ` ${SA} ` })).toEqual({ apiKey: SA, config: { bucketId: BUCKET_EXAMPLE } });
  });
  it("names the first thing wrong", () => {
    expect(playFormProblem({ bucket: "my-bucket", serviceAccountJson: SA })).toMatch(/bucket id/);
    expect(playFormProblem({ bucket: BUCKET_EXAMPLE, serviceAccountJson: "{ nope" })).toMatch(/JSON key file/);
    expect(playFormProblem({ bucket: BUCKET_EXAMPLE, serviceAccountJson: JSON.stringify({ type: "authorized_user" }) })).toMatch(/JSON key file/);
  });
  it("tells a service account from other JSON", () => {
    expect(looksLikeServiceAccount(SA)).toBe(true);
    expect(looksLikeServiceAccount("[]")).toBe(false);
    expect(bucketIdOf("gs://b/x/y")).toBe("b");
  });
});
