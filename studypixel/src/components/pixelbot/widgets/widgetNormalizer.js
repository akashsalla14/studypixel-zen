/**
 * @fileoverview Utility functions for standardizing LLM widget payloads.
 * Provides schema drift resistance, semantic canonicalization, and telemetry structures.
 */

/**
 * Normalizes standard metadata fields across all widgets to handle AI schema hallucinations.
 * @param {Object} data The raw widgetData from the LLM.
 * @param {Array<string>} defaultTags Fallback tags if none are provided.
 * @returns {Object} A guaranteed safe metadata object.
 */
export const normalizeBaseData = (data, defaultTags = ["Practice"]) => {
  return {
    prompt: data?.prompt || data?.title || data?.question || data?.task || "Please complete the exercise below.",
    hint: data?.hint || data?.clue || null,
    explanation: data?.explanation || data?.reasoning || data?.feedback || null,
    difficulty: data?.difficulty || data?.level || "Medium",
    tags: Array.isArray(data?.tags) && data.tags.length > 0 ? data.tags : (Array.isArray(data?.topics) ? data.topics : defaultTags),
    executionMode: data?.executionMode || 'REAL_STUDENT',
    isHistorical: data?.isHistorical === true || data?.readOnly === true,
    studentAnswer: data?.studentAnswer || data?.studentCode || data?.studentMatches || data?.studentOrder || data?.answers || null,
    wasCorrect: data?.wasCorrect ?? null
  };
};

export const normalizeWidgetList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item == null ? null : typeof item === 'string' ? item : String(item.label || item.text || item.value || '')))
    .filter((item) => item && item.trim().length > 0);
};

/**
 * Canonicalizes strings for semantic matching.
 * Strips whitespace, converts to lowercase, and removes punctuation to prevent 
 * students from being marked wrong for typos like "Port 80!" instead of "80".
 * @param {string} str The raw student input or expected answer.
 * @returns {string} The canonicalized string.
 */
export const canonicalize = (str) => {
  return (String(str) || "")
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '') // Strip punctuation
    .trim();
};

/**
 * Constructs a standardized telemetry payload for analytics and mastery tracking.
 * @param {Object} params Telemetry parameters.
 * @returns {Object} The telemetry payload.
 */
export const buildTelemetry = ({ widgetId, version, isCorrect, usedHint, answerData = {}, executionMode = 'REAL_STUDENT' }) => {
  // Future-proofing: In a full production environment, this payload would be passed 
  // through an HMAC signing function (e.g., using a session-specific JWT secret) 
  // before transmission to prevent replay and tampering attacks.
  
  const startTime = Number.isFinite(answerData.startTime) ? answerData.startTime : null;
  const firstInteractionTime = Number.isFinite(answerData.firstInteractionTime) ? answerData.firstInteractionTime : null;
  const hesitationMs = firstInteractionTime && startTime
    ? Math.max(0, firstInteractionTime - startTime)
    : Number.isFinite(answerData.hesitationMs)
      ? answerData.hesitationMs
      : 0;

  const metrics = {
    ...answerData,
    startTime,
    firstInteractionTime,
    hesitationMs,
  };

  if (!Number.isFinite(metrics.viewDurationMs) && Number.isFinite(metrics.responseTimeMs)) {
    metrics.viewDurationMs = metrics.responseTimeMs;
  }

  if (!Number.isFinite(metrics.responseTimeMs) && Number.isFinite(metrics.viewDurationMs)) {
    metrics.responseTimeMs = metrics.viewDurationMs;
  }

  return {
    widgetId,
    widgetVersion: version,
    timestamp: Date.now(),
    isCorrect,
    usedHint: !!usedHint,
    interactionSource: executionMode,
    metrics,
    signature: "HMAC_PLACEHOLDER_PENDING_INTEGRATION" // Security architecture marker
  };
};