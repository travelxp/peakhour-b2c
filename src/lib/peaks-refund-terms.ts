/**
 * What the site says about refunding Peaks, in one place.
 *
 * The Terms and the Peaks page used to say purchased Peaks "are non-refundable"
 * flat out, while the product gives credits back when a task failed or a charge
 * was made in error (a refund is its own line in the charge record, and a failed
 * task is credited back automatically). One sentence, owner-approved 2026-11-04,
 * so the pages cannot drift from each other or from what the product does.
 */
export const PEAKS_REFUND_SENTENCE = "Purchased Peaks are non-refundable, except where a task failed or a charge was made in error.";

/** Plan and other fees: unchanged in substance; Peaks are carved out because the sentence above governs them. */
export const FEES_REFUND_SENTENCE =
  "All fees other than purchased Peaks are non-refundable except as required by applicable law or as explicitly stated in these Terms.";

/** Said once in the Terms, so the carve-out cannot be read as taking away a refund the law gives. */
export const REFUND_LAW_SENTENCE = "Nothing in this section limits a refund that applicable law requires.";
