/**
 * @fileoverview Custom React hook for BKT (Bayesian Knowledge Tracing) state management
 * 
 * This hook encapsulates all BKT-related state and operations for the
 * PixelBot workspace, including:
 * - Mastery tracking and history
 * - Knowledge updates based on student responses
 * - Chart data generation
 * - Progress persistence
 * 
 * Why use a custom hook:
 * - Separates BKT logic from UI rendering
 * - Makes BKT state reusable across multiple components
 * - Easier to test BKT algorithm independently
 * - Clean component code (no complex state calculations in render)
 * - Easy to extend (add features like decay modeling, predictions, etc.)
 * 
 * How to use:
 * ```javascript
 * function PixelBotWorkspace({ pixelBot, user }) {
 *   const { 
 *     mastery, 
 *     masterySeries, 
 *     updateMastery, 
 *     chartData 
 *   } = useBKT(user.id, pixelBot.id);
 *   
 *   const handleAnswer = (correct) => {
 *     updateMastery(correct);
 *   };
 *   
 *   return <Chart data={chartData} />;
 * }
 * ```
 */

"use strict";

// React hooks available globally from React CDN
import { useState, useCallback, useEffect, useMemo } from 'react';
import { config } from '@/lib/constants';
import { updateKnowledge } from '@/lib/bktEngine';
import { buildChartData } from '@/lib/helpers';

/**
 * Custom hook for BKT state management
 * 
 * Manages mastery probability tracking using Bayesian Knowledge Tracing.
 * Provides functions to update mastery based on student performance and
 * generates chart-ready data for visualization.
 * 
 * Features:
 * - Automatic mastery progression tracking
 * - Historical mastery series for charts
 * - Local storage persistence (optional)
 * - Chart data transformation
 * - Mastery threshold checking
 * 
 * @param {number} userId - Current user ID (for persistence key)
 * @param {number} pixelbotId - Current PixelBot ID (for persistence key)
 * @param {Object} [options] - Optional configuration
 * @param {boolean} [options.persist=false] - Whether to persist to localStorage
 * @param {number} [options.initialMastery] - Override initial mastery (default from config)
 * 
 * @returns {Object} BKT state and methods
 * @property {number} mastery - Current mastery probability (0-1)
 * @property {Array<number>} masterySeries - Historical mastery values
 * @property {Function} updateMastery - Updates mastery based on correctness
 * @property {Function} resetMastery - Resets to initial state
 * @property {Array<Object>} chartData - Recharts-compatible data
 * @property {boolean} hasMastery - Whether mastery threshold reached
 * @property {number} progressPercentage - Mastery as percentage (0-100)
 * 
 * @example
 * const bkt = useBKT(3, 2, { persist: true });
 * 
 * // Student answers correctly
 * bkt.updateMastery(true);
 * console.log(bkt.mastery); // e.g., 0.45 (increased)
 * 
 * // Student answers incorrectly
 * bkt.updateMastery(false);
 * console.log(bkt.mastery); // e.g., 0.42 (slightly decreased)
 */
function useBKT(userId, pixelbotId, options = {}) {
  const { persist = false, initialMastery } = options;
  
  // Determine initial mastery value
  const startingMastery = initialMastery !== undefined 
    ? initialMastery 
    : config.bkt.initialKnowledge;
  
  // BKT State
  const [mastery, setMastery] = useState(startingMastery);
  const [masterySeries, setMasterySeries] = useState([startingMastery]);
  
  /**
   * Load saved progress from localStorage on mount (if persist enabled)
   * 
   * Allows students to resume where they left off. In production,
   * this would call dataService.loadStudentProgress() to fetch from backend.
   */
  useEffect(() => {
    if (!persist || !userId || !pixelbotId) return;
    
    const storageKey = `bkt_${userId}_${pixelbotId}`;
    const savedData = localStorage.getItem(storageKey);
    
    if (savedData) {
      try {
        const { mastery: savedMastery, series: savedSeries } = JSON.parse(savedData);
        setMastery(savedMastery);
        setMasterySeries(savedSeries);
      } catch (err) {
        console.error('Failed to load BKT progress:', err);
      }
    }
  }, [userId, pixelbotId, persist]);
  
  /**
   * Save progress to localStorage whenever mastery updates (if persist enabled)
   * 
   * Auto-saves after each interaction. In production, this could be
   * debounced or triggered manually to reduce API calls.
   */
  useEffect(() => {
    if (!persist || !userId || !pixelbotId) return;
    
    const storageKey = `bkt_${userId}_${pixelbotId}`;
    const dataToSave = {
      mastery,
      series: masterySeries,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
  }, [mastery, masterySeries, userId, pixelbotId, persist]);
  
  /**
   * Updates mastery probability based on student's answer correctness
   * 
   * Uses the BKT update algorithm from bktEngine service.
   * Automatically appends new mastery value to historical series.
   * 
   * Process:
   * 1. Run BKT update algorithm with current mastery and correctness
   * 2. Update mastery state with new probability
   * 3. Append to mastery series for historical tracking
   * 
   * @param {boolean} correct - Whether student answered correctly
   * @returns {number} New mastery value (for convenience)
   */
  const updateMastery = useCallback((correct) => {
    const nextMastery = updateKnowledge({ prior: mastery, correct });
    setMastery(nextMastery);
    setMasterySeries(prev => [...prev, nextMastery]);
    return nextMastery;
  }, [mastery]);
  
  /**
   * Resets mastery to initial state
   * 
   * Useful for:
   * - Starting a new learning session
   * - Re-taking assessments
   * - Testing different learning paths
   */
  const resetMastery = useCallback(() => {
    setMastery(startingMastery);
    setMasterySeries([startingMastery]);
    
    // Clear saved progress if persisting
    if (persist && userId && pixelbotId) {
      const storageKey = `bkt_${userId}_${pixelbotId}`;
      localStorage.removeItem(storageKey);
    }
  }, [startingMastery, persist, userId, pixelbotId]);
  
  /**
   * Transform mastery series into Recharts-compatible format
   * 
   * Memoized to avoid recalculating on every render.
   * Only recalculates when masterySeries changes.
   */
  const chartData = useMemo(() => {
    return buildChartData(masterySeries);
  }, [masterySeries]);
  
  /**
   * Check if student has reached mastery threshold
   * 
   * Useful for triggering:
   * - Completion badges
   * - Progression to next topic
   * - Mastery celebration animations
   */
  const hasMastery = mastery >= config.masteryThreshold;
  
  /**
   * Mastery as a percentage (0-100) for display purposes
   */
  const progressPercentage = Math.round(mastery * 100);
  
  /**
   * Calculate learning velocity (rate of mastery change)
   * 
   * Useful for:
   * - Identifying struggling students (negative or low velocity)
   * - Adaptive difficulty adjustment
   * - Engagement metrics
   * 
   * @returns {number} Recent mastery change rate
   */
  const learningVelocity = useMemo(() => {
    if (masterySeries.length < 2) return 0;
    
    // Calculate average change over last 3 interactions
    const recentCount = Math.min(3, masterySeries.length - 1);
    const recent = masterySeries.slice(-recentCount - 1);
    
    let totalChange = 0;
    for (let i = 1; i < recent.length; i++) {
      totalChange += recent[i] - recent[i - 1];
    }
    
    return totalChange / recentCount;
  }, [masterySeries]);
  
  return {
    mastery,
    masterySeries,
    updateMastery,
    resetMastery,
    chartData,
    hasMastery,
    progressPercentage,
    learningVelocity
  };
}

