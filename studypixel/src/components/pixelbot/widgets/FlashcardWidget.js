import React, { useState } from 'react';
import { normalizeBaseData, buildTelemetry } from './widgetNormalizer';

/**
 * FlashcardWidget
 * Handles 'flashcard-v1' widget type for spaced repetition.
 * Upgraded to v2 architecture with telemetry, normalization, and modern 3D animations.
 */
const FlashcardWidget = ({ data, onSubmit }) => {
  // 1. Normalization Layer (Schema Drift Resistance)
  const baseData = normalizeBaseData(data, ["Memorization", "Spaced Repetition"]);
  const frontText = data?.front || data?.question || data?.term || "No front text provided.";
  const backText = data?.back || data?.answer || data?.definition || "No back text provided.";

  const [isFlipped, setIsFlipped] = useState(false);
  const [submitted, setSubmitted] = useState(baseData.isHistorical);
  const [startTime] = useState(() => (typeof performance !== 'undefined' ? performance.now() : 0)); // Cognitive sensor: Time-to-answer
  const [flipTime, setFlipTime] = useState(null);
  const [firstInteractionTime, setFirstInteractionTime] = useState(null);
  const [flipCount, setFlipCount] = useState(0);
  const [canAssess, setCanAssess] = useState(false); // Prevents accidental double-clicks

  const handleFlip = (event) => {
    if (submitted) return;
    const now = event?.timeStamp ?? 0;
    if (!firstInteractionTime) {
      setFirstInteractionTime(now);
    }
    setFlipCount((count) => count + 1);
    if (!isFlipped) {
      setFlipTime(now);
      setTimeout(() => setCanAssess(true), 600); // Unlock assessment after CSS 3D transition completes
    } else {
      setCanAssess(false);
    }
    setIsFlipped(!isFlipped);
  };

  const handleAssessment = (difficulty, event) => {
    if (submitted) return;
    setSubmitted(true);

    const assessmentTime = event?.timeStamp ?? flipTime ?? startTime;
    const responseTimeMs = assessmentTime - startTime;
    const timeToFlipMs = flipTime ? flipTime - startTime : responseTimeMs;
    const timeOnFrontMs = timeToFlipMs;
    const timeOnBackMs = flipTime ? Math.max(0, assessmentTime - flipTime) : 0;
    
    // For BKT updates, we estimate correctness based on self-assessment
    const isCorrect = difficulty === 'easy' || difficulty === 'medium';
    
    // Compute Epistemic Confidence for BKT Engine
    let epistemicConfidence = 1.0;
    if (difficulty === 'medium') epistemicConfidence = 0.8;
    if (difficulty === 'hard') epistemicConfidence = 0.3;

    // 2. Analytics & Telemetry Payload
    onSubmit({ 
      selfAssessed: difficulty,
      telemetry: buildTelemetry({
        widgetId: 'flashcard-v1',
        version: 'v2',
        isCorrect,
        usedHint: false, // Flashcards generally display the answer directly
        executionMode: baseData.executionMode,
        answerData: {
          selfAssessedDifficulty: difficulty,
          flipCount,
          epistemicConfidence,
          timeToFlipMs,
          timeOnFrontMs,
          timeOnBackMs,
          firstInteractionTime,
          responseTimeMs
        }
      })
    });
  };

  return (
    <div className="flashcard-widget card" style={{ backgroundColor: '#1E1E2E', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* CSS Animations & 3D Flip Mechanics */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .flashcard-container {
          perspective: 1000px;
          width: 100%;
          min-height: 250px;
          margin: 1.5rem 0;
        }
        .flashcard-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
          transform-style: preserve-3d;
          cursor: pointer;
          min-height: 250px;
        }
        .flashcard-inner.flipped {
          transform: rotateY(180deg);
        }
        .flashcard-front, .flashcard-back {
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 2rem;
          border-radius: 1rem;
          background-color: #0F0F1A;
          border: 2px solid #43435C;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          overflow-y: auto;
        }
        .flashcard-front::-webkit-scrollbar, .flashcard-back::-webkit-scrollbar { width: 6px; }
        .flashcard-front::-webkit-scrollbar-track, .flashcard-back::-webkit-scrollbar-track { background: transparent; }
        .flashcard-front::-webkit-scrollbar-thumb, .flashcard-back::-webkit-scrollbar-thumb { background: #43435C; border-radius: 3px; }
        }
        .flashcard-back {
          transform: rotateY(180deg);
          border-color: #6366F1;
          background-color: rgba(99, 102, 241, 0.05);
        }
        .fc-btn {
          flex: 1;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          font-weight: 700;
          font-size: 1rem;
          border: none;
          color: white;
          transition: all 0.2s ease;
        }
        .fc-btn-hard { background: linear-gradient(135deg, #EF4444, #B91C1C); box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3); }
        .fc-btn-medium { background: linear-gradient(135deg, #F59E0B, #D97706); box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3); }
        .fc-btn-easy { background: linear-gradient(135deg, #10B981, #059669); box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); }
        .fc-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
        .fc-btn:disabled { opacity: 0.5; transform: none; cursor: default; }
      `}</style>

      {/* Header with Difficulty and Tags */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(129,140,248,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
          {baseData.tags.join(' • ')}
        </span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: baseData.difficulty === 'Hard' ? '#EF4444' : '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(245,158,11,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
          {baseData.difficulty === 'Easy' ? '🟢' : baseData.difficulty === 'Hard' ? '🔴' : '🟡'} {baseData.difficulty}
        </span>
      </div>

      {baseData.prompt && <h3 className="widget-prompt" style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '0.5rem', textAlign: 'center' }}>{baseData.prompt}</h3>}

      <div className="flashcard-container" onClick={handleFlip}>
        <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
          <div className="flashcard-front">
            <span style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1rem' }}>Front</span>
            <p style={{ color: '#F8FAFC', fontSize: '1.25rem', lineHeight: 1.5, margin: 0 }}>{frontText}</p>
            <p style={{ color: '#64748B', fontSize: '0.85rem', marginTop: '2rem', fontStyle: 'italic' }}>Click to flip</p>
          </div>
          <div className="flashcard-back">
            <span style={{ color: '#818CF8', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1rem' }}>Back</span>
            <p style={{ color: '#FFFFFF', fontSize: '1.25rem', lineHeight: 1.5, margin: 0 }}>{backText}</p>
          </div>
        </div>
      </div>
      
      {isFlipped && (
        <div className="flashcard-actions" style={{ marginTop: '1.5rem', animation: 'fadeIn 0.4s ease-out' }}>
          <p style={{ color: '#94A3B8', fontSize: '0.95rem', textAlign: 'center', marginBottom: '1rem', fontWeight: 600 }}>How well did you know this?</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
            <button disabled={submitted || !canAssess || baseData.isHistorical} className="fc-btn fc-btn-hard" onClick={(e) => { e.stopPropagation(); handleAssessment('hard', e); }}>Hard</button>
            <button disabled={submitted || !canAssess || baseData.isHistorical} className="fc-btn fc-btn-medium" onClick={(e) => { e.stopPropagation(); handleAssessment('medium', e); }}>Medium</button>
            <button disabled={submitted || !canAssess || baseData.isHistorical} className="fc-btn fc-btn-easy" onClick={(e) => { e.stopPropagation(); handleAssessment('easy', e); }}>Easy</button>
          </div>
          {submitted && baseData.explanation && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.5 }}>{baseData.explanation}</p>
            </div>
          )}
        </div>
      )}
      {baseData.isHistorical && <div style={{ marginTop: '1.5rem', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>Historical flashcard</div>}
    </div>
  );
};

export default FlashcardWidget;