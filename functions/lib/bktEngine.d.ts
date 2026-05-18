/**
 * Updates the mastery probability based on continuous evidence.
 *
 * @param {number} prior - The previous mastery probability (0.0 to 1.0)
 * @param {number} evidence - The confidence/correctness of the current interaction (0.0 to 1.0)
 * @param {Object} params - BKT parameters (Learn, Guess, Slip)
 * @returns {number} The new posterior mastery probability
 */
export function calculatePosteriorMastery(prior: number | undefined, evidence: number, params?: Object): number;
/**
 * Estimates current memory retention based on time elapsed and mastery.
 *
 * @param {number} mastery - The current BKT mastery score (0.0 to 1.0)
 * @param {number} daysSinceReview - Days elapsed since last interaction
 * @returns {number} Estimated retention percentage (0 to 100)
 */
export function calculateRetention(mastery: number, daysSinceReview: number): number;
export namespace DEFAULT_BKT_PARAMS {
    let P_LEARN: number;
    let P_GUESS: number;
    let P_SLIP: number;
    let P_INIT: number;
}
