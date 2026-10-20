/**
 * The Template Studio route's own limits, shared by the Studio page and the
 * Inbox composer's template picker so the two cannot disagree on whether a
 * list is truncated (b2c review R2/R3 on WA T4).
 *
 * @package peakhour-b2c
 */

/** `GET /v1/meta/whatsapp/studio/templates`'s `.limit(200)`, most recently updated first. */
export const STUDIO_LIST_CAP = 200;
