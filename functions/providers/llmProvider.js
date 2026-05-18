/**
 * @fileoverview LLM Provider abstraction layer for StudyPixel.
 *
 * This module enables seamless switching between:
 * - Cloud providers: DigitalOcean Gradient AI (primary fallback: Gemini, OpenAI)
 * - Local providers: Ollama, llama.cpp, vLLM
 *
 * Usage in index.js:
 *   const {Provider} = require('./providers/llmProvider');
 *   const provider = Provider.getInstance();
 *   const result = await provider.sendRequest(payload, memberConfig);
 *
 * Environment Variables:
 *   LLM_MODE: 'cloud' (default) or 'local'
 *   LLM_PROVIDER: 'digitalocean' (default), 'gemini', 'openai', 'ollama', 'llamacpp'
 *   LLM_INFERENCE_URL: Custom inference URL (for local)
 *   LLM_HARDWARE_PROFILE: 'tier-1-budget', 'tier-2-workstation', 'tier-3-server'
 *
 * @example
 *
 * // Automatic mode selection:
 * const provider = Provider.getInstance();
 * const response = await provider.sendRequest(payload, config);
 *
 * // Manual mode override:
 * const provider = Provider.getInstance('local');
 * const response = await provider.sendRequest(payload, config);
 */

"use strict";

const logger = require("firebase-functions/logger");
const {defineString} = require("firebase-functions/params");

// Import model configs
const modelsApi = require("../config/models.api");
const modelsLocal = require("../config/models.local");

// Optional: Import external providers (if they're available)
let VertexAI;
try {
  ({VertexAI} = require("@google-cloud/vertexai"));
} catch (e) {
  // Gemini support is optional
}

const digitalOceanApiKey = defineString("DIGITALOCEAN_API_KEY");
const openaiApiKey = defineString("OPENAI_API_KEY");

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

class LLMProvider {
  constructor(mode = null) {
    this.mode = mode || process.env.LLM_MODE || "cloud";
    this.modelConfig = this.mode === "local" ? modelsLocal : modelsApi;
    logger.info(`🤖 LLM Provider initialized in ${this.mode} mode`, {
      profile: modelsLocal.PROFILE_NAME || "cloud",
      models: {
        router: this.modelConfig.ROUTER_MODEL,
        instructor: this.modelConfig.INSTRUCTOR_MODEL,
      },
    });
  }

  /**
   * Singleton pattern: Get or create the provider instance.
   * @param {string} forceMode Optional mode override ('local' or 'cloud')
   * @return {LLMProvider}
   */
  static getInstance(forceMode = null) {
    if (!LLMProvider.instance || forceMode) {
      LLMProvider.instance = new LLMProvider(forceMode);
    }
    return LLMProvider.instance;
  }

  /**
   * Route a request to the appropriate provider.
   * @param {object} payload Request payload (prompt, chatHistory, context)
   * @param {object} memberConfig Member config (role, modelId, systemPrompt, temperature)
   * @return {Promise<object>} Response {model, response, confidence}
   */
  async sendRequest(payload, memberConfig) {
    if (this.mode === "local") {
      return this.sendToLocal(payload, memberConfig);
    } else {
      return this.sendToCloud(payload, memberConfig);
    }
  }

  /**
   * Send request to local LLM (Ollama, llama.cpp, vLLM).
   * All local providers expose OpenAI-compatible endpoints.
   * @private
   */
  async sendToLocal(payload, memberConfig) {
    try {
      const {prompt, chatHistory} = payload;
      const url = this.modelConfig.INFERENCE_URL;

      // Use model from memberConfig or fall back to config
      const modelId = memberConfig.modelId || memberConfig.modelId;
      if (!modelId) {
        logger.warn("No modelId provided to sendToLocal");
        return {
          model: `Local-${memberConfig.role}`,
          response: {action: "SPEAK", mentor_speech: "Configuration error."},
          confidence: 0.0,
        };
      }

      // Format chat history
      const formattedHistory = (chatHistory || []).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const messages = [
        {role: "system", content: memberConfig.systemPrompt},
        ...formattedHistory,
        {role: "user", content: prompt},
      ];

      const temperature = memberConfig.temperature ?? 0.7;
      const maxTokens = memberConfig.maxTokens ?? 512;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Some local servers require Authorization header; Ollama does not
          "Authorization": `Bearer ${this.modelConfig.getApiKey()}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.warn(`Local LLM Error (${memberConfig.role}):`, {
          status: response.status,
          url: url,
          model: modelId,
          error: errorBody?.substring?.(0, 200),
        });
        throw new Error(`Local LLM request failed with status ${response.status}`);
      }

      const data = await response.json();
      const rawResponseText = data.choices?.[0]?.message?.content ?? "{}";

      // Parse response JSON
      let parsedResponse = this.parseLlmJson(rawResponseText);
      if (!parsedResponse) {
        parsedResponse = {action: "SPEAK", mentor_speech: rawResponseText};
      }

      // Local models typically have high confidence when they produce valid JSON
      const confidence = parsedResponse.action === "SPEAK" ? 0.75 : 0.85;

      return {
        model: `${memberConfig.role} (Local: ${modelId})`,
        response: parsedResponse,
        confidence: confidence,
      };
    } catch (error) {
      logger.error(`Failed to call local LLM (${memberConfig.role}):`, error);
      return {
        model: `Local-${memberConfig.role}`,
        response: {
          action: "SPEAK",
          mentor_speech: "I'm having trouble thinking right now. (Local LLM unavailable)",
        },
        confidence: 0.0,
      };
    }
  }

  /**
   * Send request to cloud providers (DigitalOcean, Gemini, OpenAI).
   * Implements fallback chain: DO → Gemini → OpenAI
   * @private
   */
  async sendToCloud(payload, memberConfig) {
    // Try DigitalOcean first (primary)
    const doResult = await this.sendToDigitalOcean(payload, memberConfig).catch(() => null);
    if (doResult && doResult.confidence > 0) return doResult;

    // Fallback to Gemini
    const geminiResult = await this.sendToGemini(payload).catch(() => null);
    if (geminiResult && geminiResult.confidence > 0) return geminiResult;

    // Final fallback to OpenAI
    const openaiResult = await this.sendToOpenAI(payload).catch(() => null);
    if (openaiResult && openaiResult.confidence > 0) return openaiResult;

    // All providers failed
    logger.error("All cloud providers failed for role:", memberConfig.role);
    return {
      model: `Cloud-${memberConfig.role}`,
      response: {action: "SPEAK", mentor_speech: "All providers unavailable."},
      confidence: 0.0,
    };
  }

  /**
   * Send request to DigitalOcean Gradient AI.
   * @private
   */
  async sendToDigitalOcean(payload, memberConfig) {
    try {
      let apiKey;
      try {
        apiKey = digitalOceanApiKey.value();
      } catch (e) {
        throw new Error("DigitalOcean API key not configured");
      }

      if (!apiKey) {
        throw new Error("DigitalOcean API key is empty");
      }

      const {prompt, chatHistory} = payload;
      const url = modelsApi.INFERENCE_URL;

      const formattedHistory = (chatHistory || []).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const messages = [
        {role: "system", content: memberConfig.systemPrompt},
        ...formattedHistory,
        {role: "user", content: prompt},
      ];

      const temperature = memberConfig.temperature ?? 0.7;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: memberConfig.modelId,
          messages: messages,
          temperature: temperature,
          max_tokens: 512,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.warn(`DigitalOcean API Error (${memberConfig.role}):`, {
          status: response.status,
          body: errorBody?.substring?.(0, 200),
        });
        throw new Error(`DO API request failed: ${response.status}`);
      }

      const data = await response.json();
      const rawResponseText = data.choices?.[0]?.message?.content ?? "{}";

      let parsedResponse = this.parseLlmJson(rawResponseText);
      if (!parsedResponse) {
        parsedResponse = {action: "SPEAK", mentor_speech: rawResponseText};
      }

      return {
        model: `DO-${memberConfig.role}`,
        response: parsedResponse,
        confidence: 0.85,
      };
    } catch (error) {
      logger.warn(`DigitalOcean provider failed:`, error.message);
      throw error;
    }
  }

  /**
   * Send request to Google Gemini API (fallback).
   * @private
   */
  async sendToGemini(payload) {
    try {
      if (!VertexAI) {
        throw new Error("Gemini dependencies not available");
      }

      const {prompt} = payload;
      const project = process.env.GCLOUD_PROJECT;
      const location = "us-central1";

      const vertexAI = new VertexAI({project, location});
      const generativeModel = vertexAI.getGenerativeModel({
        model: "gemini-1.5-pro",
      });

      const result = await generativeModel.generateContent({
        contents: [{role: "user", parts: [{text: prompt}]}],
      });

      const rawResponseText =
        result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      let parsedResponse = this.parseLlmJson(rawResponseText);
      if (!parsedResponse) {
        parsedResponse = {action: "SPEAK", mentor_speech: rawResponseText};
      }

      return {
        model: "Gemini (1.5-pro)",
        response: parsedResponse,
        confidence: 0.88,
      };
    } catch (error) {
      logger.warn("Gemini provider failed:", error.message);
      throw error;
    }
  }

  /**
   * Send request to OpenAI ChatGPT API (last resort fallback).
   * @private
   */
  async sendToOpenAI(payload) {
    try {
      let apiKey;
      try {
        apiKey = openaiApiKey.value();
      } catch (e) {
        throw new Error("OpenAI API key not configured");
      }

      if (!apiKey) {
        throw new Error("OpenAI API key is empty");
      }

      const {prompt} = payload;
      const url = "https://api.openai.com/v1/chat/completions";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{role: "user", content: prompt}],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.warn("OpenAI API Error:", {status: response.status});
        throw new Error(`OpenAI request failed: ${response.status}`);
      }

      const data = await response.json();
      const rawResponseText = data.choices?.[0]?.message?.content || "{}";

      let parsedResponse = this.parseLlmJson(rawResponseText);
      if (!parsedResponse) {
        parsedResponse = {action: "SPEAK", mentor_speech: rawResponseText};
      }

      return {
        model: "ChatGPT (3.5-turbo)",
        response: parsedResponse,
        confidence: 0.80,
      };
    } catch (error) {
      logger.warn("OpenAI provider failed:", error.message);
      throw error;
    }
  }

  /**
   * Parse JSON from LLM response robustly.
   * Handles markdown blocks, escaped quotes, and nested objects.
   * @private
   */
  parseLlmJson(text) {
    if (!text) return null;

    // Try raw JSON first
    try {
      return JSON.parse(text);
    } catch (e) {
      // Continue to heuristics
    }

    // Try markdown code blocks
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      try {
        return JSON.parse(markdownMatch[1]);
      } catch (e) {
        // Continue
      }
    }

    // Robust brace-depth extraction
    const firstBrace = text.indexOf("{");
    if (firstBrace !== -1) {
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = firstBrace; i < text.length; i++) {
        const ch = text[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\" && inString) {
          escape = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(text.substring(firstBrace, i + 1));
            } catch (e) {
              return null;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Get the currently active model configuration.
   * Useful for logging or debugging.
   * @return {object}
   */
  getConfig() {
    return {
      mode: this.mode,
      config: this.modelConfig,
    };
  }

  /**
   * Switch provider mode at runtime (useful for testing).
   * @param {string} newMode 'local' or 'cloud'
   */
  setMode(newMode) {
    if (newMode !== "local" && newMode !== "cloud") {
      throw new Error(`Invalid mode: ${newMode}. Use 'local' or 'cloud'.`);
    }
    this.mode = newMode;
    this.modelConfig = newMode === "local" ? modelsLocal : modelsApi;
    logger.info(`🔄 LLM Provider switched to ${newMode} mode`);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  Provider: LLMProvider,
  getInstance: () => LLMProvider.getInstance(),
};
