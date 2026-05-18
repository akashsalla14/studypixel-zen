/**
 * @fileoverview Bayesian Knowledge Tracing (BKT) Engine for StudyPixel-GPT
 * 
 * This module implements the BKT algorithm for probabilistic modeling of
 * student knowledge. BKT tracks the probability that a student has mastered
 * a skill based on their performance over time.
 * 
 * Mathematical Foundation:
 * BKT uses four probabilities to model learning:
 * - P(L₀): Prior knowledge - Initial probability student knows the skill
 * - P(T): Transition/Learning - Probability of learning from one attempt
 * - P(G): Guess - Probability of correct answer despite not knowing
 * - P(S): Slip - Probability of incorrect answer despite knowing
 * 
 * Update Formula (Bayes' Theorem):
 * If correct: P(L|correct) = [P(L) * (1-P(S))] / [P(L)*(1-P(S)) + (1-P(L))*P(G)]
 * If incorrect: P(L|incorrect) = [P(L) * P(S)] / [P(L)*P(S) + (1-P(L))*(1-P(G))]
 * Next state: P(L_new) = P(L|evidence) + (1 - P(L|evidence)) * P(T)
 * 
 * Why BKT: Traditional accuracy-based metrics don't capture learning dynamics.
 * BKT models both current knowledge AND learning progress, enabling adaptive
 * tutoring systems to make intelligent decisions about next steps.
 * 
 * References:
 * - Corbett, A.T., & Anderson, J.R. (1995). Knowledge tracing: Modeling the 
 *   acquisition of procedural knowledge. User Modeling and User-Adapted Interaction.
 */

"use strict";

import { config } from './constants';
import { clamp } from './helpers';

/**
 * Updates knowledge probability based on student's answer
 * 
 * This is the core BKT update step that runs after each student response.
 * It applies Bayesian inference to update our belief about whether the
 * student has mastered the skill.
 * 
 * Process:
 * 1. Calculate posterior probability P(L|evidence) using Bayes' theorem
 * 2. Apply learning transition: P(L_new) = P(L|evidence) + (1-P(L|evidence))*P(T)
 * 3. Clamp result to [0,1] to handle numerical edge cases
 * 
 * Why two-step update:
 * - First step: Update belief based on observed evidence (correct/incorrect)
 * - Second step: Account for learning that happens from the attempt itself
 * 
 * @param {Object} params - Update parameters
 * @param {number} params.prior - Prior knowledge probability (0-1)
 * @param {boolean} params.correct - Whether student answered correctly
 * @returns {number} Updated knowledge probability (0-1)
 * 
 * @example
 * // Student with 50% mastery gets question correct
 * const newMastery = updateKnowledge({ prior: 0.5, correct: true });
 * // newMastery will be higher, reflecting increased confidence
 * 
 * @example
 * // Student with 70% mastery makes mistake (slip)
 * const newMastery = updateKnowledge({ prior: 0.7, correct: false });
 * // newMastery will decrease slightly, but not drastically (slip is rare)
 */
function updateKnowledge({ prior, correct }) {
  const { learnProbability, guessProbability, slipProbability } = config.bkt;
  
  // Step 1: Calculate posterior P(L|evidence) using Bayes' theorem
  // Numerator: P(evidence|L) * P(L)
  const numerator = correct 
    ? prior * (1 - slipProbability)      // P(correct|knows) * P(knows)
    : prior * slipProbability;            // P(incorrect|knows) * P(knows)
  
  // Denominator: P(evidence) = P(evidence|L)*P(L) + P(evidence|¬L)*P(¬L)
  const denominator = correct
    ? prior * (1 - slipProbability) + (1 - prior) * guessProbability
    : prior * slipProbability + (1 - prior) * (1 - guessProbability);
  
  // Posterior probability (handle division by zero edge case)
  const posterior = denominator === 0 ? 0 : numerator / denominator;
  
  // Step 2: Apply learning transition
  // Even if student already knew it, the practice reinforces knowledge
  // If student didn't know, they have P(T) chance of learning
  const next = posterior + (1 - posterior) * learnProbability;
  
  // Step 3: Clamp to valid probability range [0, 1]
  return clamp(next, 0, 1);
}

/**
 * Calculates memory retention using the Ebbinghaus forgetting curve
 * 
 * The forgetting curve models how memory decays over time without review:
 * R(t) = e^(-t/S)
 * where:
 * - R(t): Retention at time t
 * - t: Time since last review
 * - S: Stability factor (controls decay rate)
 * 
 * Why this matters: Even if a student masters a topic, they will forget
 * without periodic review. This function helps the system decide when
 * to trigger spaced repetition sessions.
 * 
 * @param {number} timeSinceLastReview - Days since last review
 * @param {number} stability - Memory stability factor (higher = slower decay)
 * @returns {number} Retention probability (0-1)
 * 
 * @example
 * // Check retention after 3 days with stability=0.5
 * const retention = calculateRetention(3, 0.5);
 * // Returns ~0.0025 (very low - needs review!)
 * 
 * @example
 * // Check retention after 1 day with stability=2.0
 * const retention = calculateRetention(1, 2.0);
 * // Returns ~0.606 (still good retention)
 */
function calculateRetention(timeSinceLastReview, stability) {
  // Exponential decay function from Ebbinghaus forgetting curve
  return Math.exp(-timeSinceLastReview / stability);
}

/**
 * Determines if a skill needs review based on retention threshold
 * 
 * Combines current mastery level with time-based decay to decide
 * whether a spaced repetition review session is needed.
 * 
 * @param {number} mastery - Current mastery probability (0-1)
 * @param {number} daysSinceReview - Days since last review
 * @returns {boolean} True if review is needed
 */
function needsReview(mastery, daysSinceReview) {
  const { stabilityFactor, retentionThreshold } = config.memoryDecay;
  const retention = calculateRetention(daysSinceReview, stabilityFactor);
  const effectiveMastery = mastery * retention;
  return effectiveMastery < retentionThreshold;
}

/**
 * Calculates optimal review timing using spaced repetition principles
 * 
 * Higher mastery = longer intervals between reviews
 * This follows the spacing effect: increasing intervals maximize retention
 * 
 * @param {number} mastery - Current mastery level (0-1)
 * @param {number} reviewCount - Number of times already reviewed
 * @returns {number} Recommended days until next review
 */
function calculateReviewInterval(mastery, reviewCount) {
  // Base interval increases exponentially with each review (SM-2 algorithm inspiration)
  const baseInterval = Math.pow(2, reviewCount);
  
  // Adjust based on mastery level (higher mastery = longer intervals)
  // Mastery of 1.0 doubles the interval, mastery of 0.5 keeps it the same
  const masteryMultiplier = 0.5 + mastery;
  
  return Math.ceil(baseInterval * masteryMultiplier);
}

/**
 * Simulates student correctness based on reasoning quality (for demo mode)
 * 
 * In demo mode without real LLM evaluation, this provides a heuristic for
 * whether a student's answer shows true understanding vs. lucky guess.
 * 
 * Criteria:
 * - Length: Detailed explanations suggest deeper understanding
 * - Keywords: Causal reasoning words indicate logical thinking
 * 
 * In production: Replace with actual LLM-based reasoning evaluation
 * 
 * @param {string} reasoning - Student's explanation text
 * @returns {boolean} Simulated correctness
 */
function simulateCorrectness(reasoning) {
  const { minReasoningLength, reasoningKeywords } = config.simulation;
  
  // Check if explanation is detailed enough
  const hasLength = reasoning.length >= minReasoningLength;
  
  // Check for causal reasoning indicators
  const hasKeywords = reasoningKeywords.some(keyword => 
    reasoning.toLowerCase().includes(keyword)
  );
  
  // Simple heuristic: needs both length AND logical reasoning
  return hasLength && hasKeywords;
}

export {
  updateKnowledge,
  calculateRetention,
  needsReview,
  calculateReviewInterval,
  simulateCorrectness
};