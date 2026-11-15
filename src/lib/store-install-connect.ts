/**
 * The two app-store connect forms (GG-4b): what a merchant pastes, checked in the browser before anything is sent. The api checks
 * again and proves the credentials against the store; this only stops an obvious slip (a path pasted for a key, a label for an id)
 * from costing a round trip.
 */

export const ISSUER_ID_EXAMPLE = "57246542-96fe-1a63-e053-0824d011072a";
export const BUCKET_EXAMPLE = "pubsite_prod_rev_01234567890987654321";

const ISSUER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_ID_RE = /^[A-Z0-9]{10}$/;
const VENDOR_RE = /^\d{1,12}$/;
const BUCKET_RE = /^pubsite_prod_rev_\d{6,30}$/;

/** The .p8 file Apple lets a merchant download once: a PEM private key. */
export const looksLikeP8 = (text: string): boolean => /^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----$/.test(text.trim());

/** The JSON key file Google Cloud gives for a service account. */
export function looksLikeServiceAccount(text: string): boolean {
  try {
    const v = JSON.parse(text) as { type?: unknown; client_email?: unknown; private_key?: unknown };
    return v.type === "service_account" && typeof v.client_email === "string" && typeof v.private_key === "string";
  } catch {
    return false;
  }
}

/** The bucket id from what was pasted: the id itself, or the gs:// address Play Console shows. */
export function bucketIdOf(input: string): string {
  return input.trim().replace(/^gs:\/\//, "").replace(/\/.*$/, "");
}

export interface AppStoreForm {
  issuerId: string;
  keyId: string;
  vendorNumber: string;
  p8: string;
}

/** The first thing wrong with the App Store Connect form, in plain words, or null when it can be sent. */
export function appStoreFormProblem(f: AppStoreForm): string | null {
  if (!ISSUER_RE.test(f.issuerId.trim())) return `The Issuer ID looks like ${ISSUER_ID_EXAMPLE}.`;
  if (!KEY_ID_RE.test(f.keyId.trim())) return "The Key ID is 10 letters and digits.";
  if (!VENDOR_RE.test(f.vendorNumber.trim())) return "The vendor number is digits only.";
  if (!looksLikeP8(f.p8)) return "Paste the whole text of the .p8 file, including the BEGIN and END lines.";
  return null;
}

/** The request body parts the api takes: the key is the credential, the ids are settings. */
export function appStoreConnectBody(f: AppStoreForm): { apiKey: string; config: Record<string, string> } {
  return { apiKey: f.p8.trim(), config: { issuerId: f.issuerId.trim(), keyId: f.keyId.trim(), vendorNumber: f.vendorNumber.trim() } };
}

export interface PlayForm {
  bucket: string;
  serviceAccountJson: string;
}

export function playFormProblem(f: PlayForm): string | null {
  if (!BUCKET_RE.test(bucketIdOf(f.bucket))) return `The bucket id looks like ${BUCKET_EXAMPLE}.`;
  if (!looksLikeServiceAccount(f.serviceAccountJson)) return "Paste the whole text of the service account's JSON key file.";
  return null;
}

export function playConsoleBody(f: PlayForm): { apiKey: string; config: Record<string, string> } {
  return { apiKey: f.serviceAccountJson.trim(), config: { bucketId: bucketIdOf(f.bucket) } };
}
