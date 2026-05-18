/**
 * @fileoverview Recharts Panel Component for mastery progression visualization
 * 
 * This component displays a line chart showing student mastery progression
 * over time. It uses Recharts library for rendering (with graceful fallback
 * if library is unavailable).
 * 
 * Features:
 * - Real-time mastery tracking visualization
 * - Responsive design (adapts to container size)
 * - Glassmorphism styling consistent with app theme
 * - Fallback UI when Recharts is not available
 * 
 * Why a separate component:
 * - Reusable across dashboards (student, teacher, admin)
 * - Isolates chart library dependency
 * - Easy to swap chart library if needed
 * - Testable independently
 * 
 * Dependencies:
 * - Recharts (optional, via CDN) - window.Recharts
 * - buildChartData helper for data transformation
 * 
 * How to use:
 * ```javascript
 * <RechartsPanel 
 *   masterySeries={[0.25, 0.35, 0.48, 0.62, 0.75]}
 *   title="Python Programming Mastery"
 * />
 * ```
 */

"use strict";

// React hooks available globally

'use client' // Add this at the top of files using hooks
import { useMemo } from 'react';
import { buildChartData } from '@/lib/helpers';

/**
 * Recharts Panel Component
 * 
 * Displays a line chart showing mastery progression over learning steps.
 * Chart displays mastery probability (0-1 scale) on Y-axis and step number
 * on X-axis.
 * 
 * Visual Design:
 * - Dark theme with glassmorphism card
 * - Electric blue line (#6366f1) with purple dots (#8b5cf6)
 * - Semi-transparent grid for depth
 * - Smooth monotone line interpolation
 * 
 * @param {Object} props - Component props
 * @param {Array<number>} props.masterySeries - Array of mastery values (0-1 scale)
 * @param {string} [props.title="Mastery Progression"] - Chart title
 * @returns {JSX.Element} Recharts visualization or fallback UI
 * 
 * @example
 * // Display student's learning progression
 * <RechartsPanel 
 *   masterySeries={[0.25, 0.35, 0.48, 0.62, 0.75, 0.85]}
 *   title="Networking Basics - Progress"
 * />
 * 
 * @example
 * // Display with minimal data points
 * <RechartsPanel 
 *   masterySeries={[0.25, 0.30]}
 *   title="Just Started"
 * />
 */
function RechartsPanel({ masterySeries, title = "Mastery Progression" }) {
  /**
   * Transform mastery series into Recharts-compatible format
   * 
   * Memoized to avoid recalculation on every render.
   * Only recalculates when masterySeries changes.
   * 
   * Input:  [0.25, 0.35, 0.48]
   * Output: [{ step: 1, mastery: 0.25 }, { step: 2, mastery: 0.35 }, ...]
   */
  const chartData = useMemo(() => buildChartData(masterySeries), [masterySeries]);
  
  /**
   * Access Recharts library from global scope
   * 
   * Recharts is loaded via CDN in index.html as window.Recharts.
   * If library fails to load, we show a fallback UI.
   */
  const RechartsLib = typeof window !== 'undefined' ? window.Recharts || {} : {};
  const { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    Tooltip, 
    ResponsiveContainer, 
    CartesianGrid 
  } = RechartsLib;

  /**
   * Fallback UI when Recharts is unavailable
   * 
   * Shows data point count as basic progress indicator.
   * Prevents app from breaking if CDN fails or library doesn't load.
   */
  if (!LineChart || !Line || !XAxis || !YAxis || !Tooltip || !ResponsiveContainer) {
    return (
      <div className="chart__fallback">
        <p>📊 Chart visualization unavailable</p>
        <p className="fallback-data">Data points: {masterySeries.length}</p>
        <p className="fallback-data">
          Current mastery: {(masterySeries[masterySeries.length - 1] * 100).toFixed(0)}%
        </p>
      </div>
    );
  }

  /**
   * Main chart rendering
   * 
   * Chart Configuration:
   * - LineChart: Main container
   * - ResponsiveContainer: Makes chart responsive (100% width, 200px height)
   * - CartesianGrid: Background grid with dashed lines
   * - XAxis: Shows step numbers (1, 2, 3, ...)
   * - YAxis: Shows mastery (0 to 1 scale)
   * - Tooltip: Hover popup with exact values
   * - Line: Mastery progression line with dots at data points
   * 
   * Color Scheme:
   * - Grid: rgba(255,255,255,0.1) - subtle white
   * - Axes: #94a3b8 - muted slate
   * - Line: #6366f1 - electric blue (accent color)
   * - Dots: #8b5cf6 - purple (accent-strong color)
   * - Tooltip: rgba(15, 23, 42, 0.9) - dark with transparency
   */
  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          {/* Background grid for better readability */}
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="rgba(255,255,255,0.1)" 
          />
          
          {/* X-axis: Step numbers (1, 2, 3, ...) */}
          <XAxis 
            dataKey="step" 
            stroke="#94a3b8"
            label={{ value: 'Learning Steps', position: 'insideBottom', offset: -5 }}
          />
          
          {/* Y-axis: Mastery probability (0 to 1) */}
          <YAxis 
            domain={[0, 1]} 
            stroke="#94a3b8"
            label={{ value: 'Mastery', angle: -90, position: 'insideLeft' }}
          />
          
          {/* Hover tooltip with custom styling */}
          <Tooltip 
            contentStyle={{ 
              background: 'rgba(15, 23, 42, 0.9)', 
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '8px 12px'
            }}
            formatter={(value) => [(value * 100).toFixed(1) + '%', 'Mastery']}
          />
          
          {/* Main progression line */}
          <Line 
            type="monotone"           // Smooth curve interpolation
            dataKey="mastery" 
            stroke="#6366f1"          // Electric blue accent
            strokeWidth={2}           // Slightly thick for visibility
            dot={{ 
              fill: '#8b5cf6',        // Purple dots at data points
              r: 4                    // 4px radius
            }}
            activeDot={{ r: 6 }}      // Larger dot on hover
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RechartsPanel;