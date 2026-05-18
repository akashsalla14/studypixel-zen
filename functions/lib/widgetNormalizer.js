"use strict";
/**
 * @fileoverview Utility functions for standardizing LLM widget payloads.
 * Provides schema drift resistance, semantic canonicalization, and telemetry structures.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTelemetry = exports.canonicalize = exports.normalizeBaseData = void 0;
/**
 * Normalizes standard metadata fields across all widgets to handle AI schema hallucinations.
 * @param {Object} data The raw widgetData from the LLM.
 * @param {Array<string>} defaultTags Fallback tags if none are provided.
 * @returns {Object} A guaranteed safe metadata object.
 */
const normalizeBaseData = (data, defaultTags = ["Practice"]) => {
    return {
        prompt: data?.prompt || data?.title || data?.question || "Please complete the exercise below.",
        hint: data?.hint || null,
        explanation: data?.explanation || null,
        difficulty: data?.difficulty || "Medium",
        tags: Array.isArray(data?.tags) && data.tags.length > 0 ? data.tags : defaultTags,
    };
};
exports.normalizeBaseData = normalizeBaseData;
/**
 * Canonicalizes strings for semantic matching.
 * Strips whitespace, converts to lowercase, and removes punctuation to prevent
 * students from being marked wrong for typos like "Port 80!" instead of "80".
 * @param {string} str The raw student input or expected answer.
 * @returns {string} The canonicalized string.
 */
const canonicalize = (str) => {
    return (String(str) || "")
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '') // Strip punctuation
        .trim();
};
exports.canonicalize = canonicalize;
/**
 * Constructs a standardized telemetry payload for analytics and mastery tracking.
 * @param {Object} params Telemetry parameters.
 * @returns {Object} The telemetry payload.
 */
const buildTelemetry = ({ widgetId, version, isCorrect, usedHint, answerData = {} }) => {
    return {
        widgetId,
        widgetVersion: version,
        timestamp: Date.now(),
        isCorrect,
        usedHint: !!usedHint,
        metrics: {
            ...answerData
        }
    };
};
exports.buildTelemetry = buildTelemetry;
