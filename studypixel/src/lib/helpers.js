/**
 * @fileoverview Utility helper functions for StudyPixel-GPT
 * 
 * This file contains pure utility functions that are reused throughout
 * the application. These functions have no side effects and are easily
 * testable.
 * 
 * Why: Centralizing utility functions promotes code reuse, reduces
 * duplication, and makes the codebase more maintainable. Helper functions
 * are also easier to unit test in isolation.
 * 
 * Categories:
 * - Math utilities (clamp, calculations)
 * - Data transformation (chart data builders)
 * - Validation helpers
 */

"use strict";

/**
 * Clamps a numerical value within a specified range
 * 
 * This is commonly used to ensure probabilities stay within [0, 1]
 * and prevents numerical overflow/underflow in calculations.
 * 
 * @param {number} value - The value to clamp
 * @param {number} min - Minimum allowed value (inclusive)
 * @param {number} max - Maximum allowed value (inclusive)
 * @returns {number} The clamped value
 * 
 * @example
 * clamp(1.5, 0, 1)  // Returns 1
 * clamp(-0.2, 0, 1) // Returns 0
 * clamp(0.5, 0, 1)  // Returns 0.5
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Transforms a mastery series array into chart-compatible data format
 * 
 * Recharts requires data in the format: [{ step: 1, mastery: 0.5 }, ...]
 * This function converts a simple array of mastery values into the required
 * format with step numbers (1-indexed).
 * 
 * Why 1-indexed: Makes charts more intuitive for users (Step 1, 2, 3... 
 * instead of Step 0, 1, 2...) and matches educational convention.
 * 
 * @param {number[]} series - Array of mastery values (0-1 scale)
 * @returns {Array<{step: number, mastery: number}>} Chart-ready data
 * 
 * @example
 * buildChartData([0.25, 0.35, 0.48])
 * // Returns: [
 * //   { step: 1, mastery: 0.25 },
 * //   { step: 2, mastery: 0.35 },
 * //   { step: 3, mastery: 0.48 }
 * // ]
 */
function buildChartData(series) {
  return series.map((value, index) => ({ 
    step: index + 1,    // 1-indexed for better UX
    mastery: value 
  }));
}

/**
 * Formats a mastery value as a percentage string
 * 
 * @param {number} mastery - Mastery value (0-1 scale)
 * @param {number} [decimals=0] - Number of decimal places
 * @returns {string} Formatted percentage string
 * 
 * @example
 * formatMasteryPercentage(0.725)    // Returns "73%"
 * formatMasteryPercentage(0.725, 1) // Returns "72.5%"
 */
function formatMasteryPercentage(mastery, decimals = 0) {
  return `${(mastery * 100).toFixed(decimals)}%`;
}

/**
 * Generates a color code based on mastery level
 * 
 * Used for visual indicators (progress bars, heatmaps) to quickly
 * communicate performance level. Color scale:
 * - Red (< 40%): Struggling
 * - Orange (40-60%): Developing
 * - Yellow (60-80%): Proficient
 * - Green (>= 80%): Mastery
 * 
 * @param {number} mastery - Mastery value (0-1 scale)
 * @returns {string} CSS color value
 */
function getMasteryColor(mastery) {
  if (mastery < 0.4) return '#ef4444';      // Red - needs help
  if (mastery < 0.6) return '#f59e0b';      // Orange - making progress
  if (mastery < 0.8) return '#eab308';      // Yellow - good
  return '#10b981';                         // Green - excellent
}

/**
 * Validates email format using regex
 * 
 * Simple validation for demo purposes. In production, use a more
 * robust library like validator.js or email-validator.
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email format is valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generates a unique ID string
 * 
 * Simple ID generator for demo purposes. In production, use UUIDs
 * or let the backend database generate IDs.
 * 
 * @returns {string} Unique identifier string
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculates average value from an array of numbers
 * 
 * @param {number[]} values - Array of numbers
 * @returns {number} Average value, or 0 if array is empty
 */
function calculateAverage(values) {
  if (!values || values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Formats a timestamp into a human-readable relative time string
 * 
 * @param {Date|string|number} timestamp - Timestamp to format
 * @returns {string} Relative time string (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Export all helper functions for use throughout the application
export {
  clamp,
  buildChartData,
  formatMasteryPercentage,
  getMasteryColor,
  isValidEmail,
  generateId,
  calculateAverage,
  formatRelativeTime
};