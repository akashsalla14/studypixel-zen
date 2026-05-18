/**
 * @fileoverview API Inference model configuration for StudyPixel.
 *
 * Used by the default `index.js` backend when running with DigitalOcean
 * Gradient AI serverless inference (the "cloud" version).
 *
 * To switch to this config: ensure LLM_MODE is NOT set to "local".
 */

"use strict";

const {defineString} = require("firebase-functions/params");
const digitalOceanApiKey = defineString("DIGITALOCEAN_API_KEY");

module.exports = {
  INFERENCE_URL: "https://inference.do-ai.run/v1/chat/completions",

  // Intent router — fast, cheap model
  ROUTER_MODEL: "llama3-8b-instruct",

  // Assessment council — three distinct evaluator models for diversity
  EVALUATOR_A_MODEL: "mistral-nemo-instruct-2407",
  EVALUATOR_B_MODEL: "llama3-8b-instruct",
  EVALUATOR_C_MODEL: "llama3-8b-instruct",

  // Teaching instructor — largest, most capable model
  INSTRUCTOR_MODEL: "llama3.3-70b-instruct",

  /**
   * Returns the API key for DigitalOcean Gradient AI.
   * Throws if the Firebase param is not configured.
   * @return {string}
   */
  getApiKey: () => digitalOceanApiKey.value(),

  // Run evaluators in parallel (safe with remote endpoints)
  SEQUENTIAL_EVALUATORS: false,
};
