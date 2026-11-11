/**
 * What one page of the lane asks the api for.
 *
 * ⚠️THIS IS THE api's HARD MAXIMUM, AND THE ROUTE HAS NO CURSOR. `GET
 * /v1/support/inbox` caps `limit` at 100 and sorts `createdAt: -1`, so a
 * merchant with more than 100 review rows is served the hundred NEWEST — and
 * the ones silently dropped are the OLDEST, which is precisely where an
 * unanswered review has been sitting longest.
 */
export const REVIEW_PAGE_LIMIT = 100;

