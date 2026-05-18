import React, { useState } from 'react';
import { normalizeBaseData, buildTelemetry } from './widgetNormalizer';

/**
 * SpacedReviewWidget
 * Widget ID: spaced-review-v1
 *
 * Surfaces BKT-based retention data for each topic so the student can decide
 * what to review. This widget does NOT send an answer to the AI council — instead,
 * actions ("Review Now", "Skip", "Mark Mastered") are handled directly by the parent
 * via onSubmit.
 *
 * Data schema:
 *   {
 *     topics: [{
 *       name: string,
 *       masteryScore: number,       // 0–1 from BKT engine
 *       daysSinceReview: number,
 *       retentionPct: number        // 0–100 (pre-calculated by backend)
 *     }]
 *   }
 */

// 0. Single Source of Truth Priority Engine
const calculateReviewPriority = (topic) => {
  if (topic.retentionPct < 40) return { level: 'HIGH', label: 'Review Immediately', action: 'review_now', color: '#F87171', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.5)' };
  if (topic.retentionPct < 75) return { level: 'MEDIUM', label: 'Review Soon', action: 'review_now', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.05)', border: 'rgba(251, 191, 36, 0.3)' };
  return { level: 'LOW', label: 'Mastered', action: 'mark_mastered', color: '#34D399', bg: '#0F0F1A', border: 'rgba(99,102,241,0.2)' };
};

const RetentionBar = ({ pct }) => {
  const priority = calculateReviewPriority({ retentionPct: pct });
  return (
    <div style={{ background: '#2D2D3F', borderRadius: '4px', height: '8px', width: '100%', overflow: 'hidden', margin: '8px 0', border: '1px solid #43435C' }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: priority.color, borderRadius: '4px', transition: 'width 0.4s ease', boxShadow: `0 0 8px ${priority.color}88` }} />
    </div>
  );
};

const SpacedReviewWidget = ({ data, onSubmit }) => {
  // 1. Normalization Layer (Schema Drift Resistance)
  const baseData = normalizeBaseData(data, ["Meta-Cognition", "Spaced Repetition"]);
  const rawTopics = Array.isArray(data?.topics) ? data.topics : [];
  
  // Schema Drift & Math Safety: Handle missing fields, aliases, and out-of-bounds percentages
  const validTopics = rawTopics
    .filter(t => t && (typeof t.name === 'string' || typeof t.topic === 'string'))
    .map(t => {
      const rawRetention = Number.isFinite(t.retentionPct) ? t.retentionPct : (Number.isFinite(t.retention) ? t.retention : 0);
      return {
        ...t,
        name: t.name || t.topic || "Unknown Topic",
        masteryScore: Number.isFinite(t.masteryScore) ? t.masteryScore : (Number.isFinite(t.mastery) ? t.mastery : 0),
        retentionPct: Math.max(0, Math.min(100, rawRetention)), // Prevent CSS layout overflow
        daysSinceReview: Number.isFinite(t.daysSinceReview) ? Math.max(0, t.daysSinceReview) : 0
      };
    });

  // Defensive Sorting & Pagination: Prevent DOM bloat from months of learning history
  const sortedTopics = [...validTopics].sort((a, b) => (a.retentionPct || 0) - (b.retentionPct || 0));
  const [visibleCount, setVisibleCount] = useState(5);
  const [processingTopic, setProcessingTopic] = useState(null); // Concurrency Lock

  const handleAction = (topic, action) => {
    if (baseData.isHistorical) return;
    if (processingTopic) return; // Prevent "Click Spam" trap
    setProcessingTopic(topic.name);
    const priority = calculateReviewPriority(topic);
    const recommendationAccepted = action === priority.action || (priority.level === 'LOW' && action === 'skip');

    // 2. Analytics & Telemetry Payload
    onSubmit({ 
      topicName: topic.name, 
      action,
      telemetry: buildTelemetry({
        widgetId: 'spaced-review-v1',
        version: 'v2',
        isCorrect: true, // Non-evaluative widget
        usedHint: false,
        executionMode: baseData.executionMode,
        answerData: {
          selectedAction: action,
          topicName: topic.name,
          masteryScore: topic.masteryScore,
          retentionPct: topic.retentionPct,
          daysSinceReview: topic.daysSinceReview,
          priorityLevel: priority.level,
          recommendationAccepted,
          recommendationConfidence: 100 - topic.retentionPct
        }
      })
    });
  };

  if (validTopics.length === 0) {
    return (
      <div className="spaced-review-widget card" style={{ padding: '2rem', backgroundColor: '#1E1E2E', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '1rem', width: '100%', maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <h3 style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '0.5rem' }}>📅 Spaced Review Queue</h3>
        <p style={{ color: '#94A3B8', fontSize: '0.95rem' }}>No topics to review right now. Keep studying!</p>
      </div>
    );
  }

  // Dynamic subtitle based on Single Source of Truth
  const urgentCount = validTopics.filter(t => calculateReviewPriority(t).level === 'HIGH').length;
  const dynamicSubtitle = urgentCount > 0 
    ? `You have ${urgentCount} topic(s) actively decaying. I recommend reviewing them immediately.`
    : `Your memory retention looks stable. Review or skip as needed.`;

  return (
    <div className="spaced-review-widget card" style={{ backgroundColor: '#1E1E2E', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* Header with Difficulty and Tags */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(129,140,248,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
          {baseData.tags.join(' • ')}
        </span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(16,185,129,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
          🟢 PERSONALIZED
        </span>
      </div>

      <h3 style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '0.25rem' }}>📅 {baseData.prompt || "Spaced Review Queue"}</h3>
      <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        {baseData.explanation || dynamicSubtitle}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sortedTopics.slice(0, visibleCount).map((topic, i) => {
          const priority = calculateReviewPriority(topic);
          const isProcessingThis = processingTopic === topic.name;
          const isProcessingAny = processingTopic !== null || baseData.isHistorical;
          
          return (
            <div
              key={i}
              style={{
                padding: '1.25rem',
                borderRadius: '0.75rem',
                border: `1px solid ${priority.border}`,
                backgroundColor: priority.bg,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                opacity: isProcessingAny && !isProcessingThis ? 0.5 : 1,
                transition: 'opacity 0.3s ease'
              }}
            >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>{topic.name}</p>
                <div style={{ marginTop: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94A3B8', fontSize: '0.85rem', fontWeight: 500 }}>
                      Retention: {Math.round(topic.retentionPct)}%
                    </span>
                    <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>
                      Last reviewed: {topic.daysSinceReview === 0 ? 'Today' : `${topic.daysSinceReview}d ago`}
                    </span>
                  </div>
                  <RetentionBar pct={topic.retentionPct} />
                  <span style={{ color: '#64748B', fontSize: '0.8rem', fontStyle: 'italic' }}>
                    Mastery: {Math.round(topic.masteryScore * 100)}%
                  </span>
                  <span style={{ color: priority.color, fontSize: '0.8rem', fontWeight: 600, marginLeft: '1rem' }}>
                    ↳ {priority.label}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.5rem', minWidth: '120px' }}>
                <button
                  disabled={isProcessingAny}
                  onClick={() => handleAction(topic, 'review_now')}
                  style={{ 
                    padding: '0.5rem 0.75rem', 
                    fontSize: '0.85rem', 
                    fontWeight: 600, 
                    background: isProcessingAny ? '#475569' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', 
                    color: '#FFF', 
                    border: 'none', 
                    borderRadius: '0.5rem', 
                    cursor: isProcessingAny ? 'default' : 'pointer',
                    boxShadow: isProcessingAny ? 'none' : '0 2px 8px rgba(99, 102, 241, 0.25)',
                  }}
                >
                  {isProcessingThis && calculateReviewPriority(topic).action === 'review_now' ? 'Loading...' : 'Review Now'}
                </button>
                <button
                  disabled={isProcessingAny}
                  onClick={() => handleAction(topic, 'mark_mastered')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    backgroundColor: 'rgba(16,185,129,0.1)',
                    border: isProcessingAny ? '1px solid #475569' : '1px solid rgba(16,185,129,0.4)',
                    color: isProcessingAny ? '#94A3B8' : '#34D399',
                    borderRadius: '0.5rem',
                    cursor: isProcessingAny ? 'default' : 'pointer',
                  }}
                >
                  {isProcessingThis && calculateReviewPriority(topic).action !== 'review_now' ? '...' : '✓ Mastered'}
                </button>
                <button
                  disabled={isProcessingAny}
                  onClick={() => handleAction(topic, 'skip')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    backgroundColor: 'transparent',
                    border: '1px solid #43435C',
                    color: '#94A3B8',
                    borderRadius: '0.5rem',
                    cursor: isProcessingAny ? 'default' : 'pointer',
                  }}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {visibleCount < sortedTopics.length && (
        <button
          onClick={() => setVisibleCount(c => c + 5)}
          style={{
            marginTop: '1rem',
            width: '100%',
            padding: '0.75rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            border: '1px dashed rgba(99,102,241,0.4)',
            color: '#818CF8',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Show More Topics ({sortedTopics.length - visibleCount} remaining) ↓
        </button>
      )}
      {baseData.isHistorical && <div style={{ marginTop: '1.5rem', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>Historical widget data</div>}
    </div>
  );
};

export default SpacedReviewWidget;
