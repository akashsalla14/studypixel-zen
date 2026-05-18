/**
 * @fileoverview Central configuration and constants for StudyPixel-GPT
 * 
 * This file contains all application-wide configuration settings including:
 * - BKT (Bayesian Knowledge Tracing) engine parameters
 * - Memory decay and spaced repetition settings
 * - API simulation delays for demo mode
 * - Mastery thresholds and learning parameters
 * 
 * Why: Centralizing configuration makes it easy to adjust parameters without
 * searching through multiple files, and enables environment-based configuration
 * for switching between development, demo, and production modes.
 * 
 * How to use: Import the config object in any file that needs these settings.
 * For real API integration, adjust the simulation delays or replace with
 * environment variables.
 */

"use strict";

/**
 * Application configuration object
 * Contains all tunable parameters for the learning system
 * 
 * @constant {Object} config - Main configuration object
 * @property {number} masteryThreshold - Threshold for considering a topic mastered (0-1 scale)
 * @property {Object} bkt - Bayesian Knowledge Tracing parameters
 * @property {Object} memoryDecay - Ebbinghaus forgetting curve parameters
 * @property {Object} simulation - Demo mode simulation settings
 */
const config = {
  // Mastery is considered achieved when knowledge probability reaches this threshold
  masteryThreshold: 0.95,
  
  /**
   * BKT (Bayesian Knowledge Tracing) Engine Parameters
   * 
   * These probabilities model the student's learning process:
   * - P(L₀): Initial knowledge - probability student already knows the skill
   * - P(T): Learning/transition - probability of learning from one attempt
   * - P(G): Guess - probability of correct answer despite not knowing
   * - P(S): Slip - probability of incorrect answer despite knowing
   * 
   * Values based on research: Corbett & Anderson (1995)
   */
  bkt: {
    initialKnowledge: 0.25,    // P(L₀) - Start with 25% assumed knowledge
    learnProbability: 0.3,      // P(T) - 30% chance of learning per interaction
    guessProbability: 0.2,      // P(G) - 20% chance of guessing correctly (MCQ typical)
    slipProbability: 0.05,      // P(S) - 5% chance of careless mistakes
  },
  
  /**
   * Memory Decay & Spaced Repetition Parameters
   * 
   * Based on Ebbinghaus forgetting curve: R(t) = e^(-t/S)
   * - Stability Factor (S): Controls how quickly knowledge decays
   * - Retention Threshold: Minimum acceptable retention before triggering review
   * 
   * Higher stability = slower forgetting
   */
  memoryDecay: {
    stabilityFactor: 0.5,       // Controls decay rate (days as unit)
    retentionThreshold: 0.4,    // Trigger revision when retention drops below 40%
  },
  
  /**
   * Simulation Settings for Demo Mode
   * 
   * These delays simulate realistic network latency for demonstration purposes.
   * In production, replace with actual API calls to Gemini, ChatGPT, Claude.
   * 
   * The correctness simulation evaluates student reasoning quality:
   * - Checks for minimum explanation length
   * - Looks for causal reasoning keywords (because, therefore, etc.)
   */
  simulation: {
    // API call delays (milliseconds) - simulates network latency
    apiDelay: 300,              // Standard LLM API call delay
    apiDelaySynthesis: 200,     // Council synthesis is faster (local computation)
    apiDelayPersistence: 100,   // Database writes are fastest
    
    // Reasoning quality thresholds for correctness simulation
    minReasoningLength: 20,     // Minimum characters for detailed explanation
    reasoningKeywords: [        // Indicators of causal reasoning
      'because', 
      'therefore', 
      'thus', 
      'hence'
    ],
  },
};

// Export for use throughout the application
export { config };