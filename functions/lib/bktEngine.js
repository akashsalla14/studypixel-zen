/**
 * @fileoverview Bayesian Knowledge Tracing (BKT) and Retention Engine
 *
 * Calculates probability of student mastery (P(L)) based on evidence,
 * and calculates memory decay (retention percentage) using the Ebbinghaus forgetting curve.
 */
"use strict";
const DEFAULT_BKT_PARAMS = {
    P_LEARN: 0.3, // Probability of learning the concept after an interaction
    P_GUESS: 0.2, // Probability of guessing correctly without knowing
    P_SLIP: 0.05, // Probability of making a mistake despite knowing
    P_INIT: 0.25 // Baseline prior probability for a new concept
};
/**
 * Updates the mastery probability based on continuous evidence.
 *
 * @param {number} prior - The previous mastery probability (0.0 to 1.0)
 * @param {number} evidence - The confidence/correctness of the current interaction (0.0 to 1.0)
 * @param {Object} params - BKT parameters (Learn, Guess, Slip)
 * @returns {number} The new posterior mastery probability
 */
function calculatePosteriorMastery(prior = DEFAULT_BKT_PARAMS.P_INIT, evidence, params = DEFAULT_BKT_PARAMS) {
    // Clamp evidence
    const safeEvidence = Math.max(0.0, Math.min(1.0, evidence));
    // Continuous Bayesian Update
    const pObsGivenL = safeEvidence * (1 - params.P_SLIP) + (1 - safeEvidence) * params.P_SLIP;
    const pObsGivenNotL = safeEvidence * params.P_GUESS + (1 - safeEvidence) * (1 - params.P_GUESS);
    const numerator = prior * pObsGivenL;
    const denominator = numerator + (1 - prior) * pObsGivenNotL;
    const posterior = denominator === 0 ? 0 : numerator / denominator;
    // Apply learning probability transition
    const newMastery = posterior + (1 - posterior) * params.P_LEARN;
    return Math.max(0.0, Math.min(1.0, newMastery)); // Clamp to [0, 1]
}
/**
 * Estimates current memory retention based on time elapsed and mastery.
 *
 * @param {number} mastery - The current BKT mastery score (0.0 to 1.0)
 * @param {number} daysSinceReview - Days elapsed since last interaction
 * @returns {number} Estimated retention percentage (0 to 100)
 */
function calculateRetention(mastery, daysSinceReview) {
    if (daysSinceReview === 0)
        return 100;
    const strength = Math.max(0.1, mastery * 10); // Memory strength multiplier
    const retention = Math.exp(-daysSinceReview / strength) * 100;
    return Math.max(0, Math.min(100, retention));
}
module.exports = { calculatePosteriorMastery, calculateRetention, DEFAULT_BKT_PARAMS };
