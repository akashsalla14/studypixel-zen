import React, { useState } from 'react';
import { normalizeBaseData, canonicalize, buildTelemetry } from './widgetNormalizer';

/**
 * AnalogyWidget
 * Widget ID: analogy-v1
 *
 * Presents "A is to B as C is to ?" with a free-text answer.
 * Correctness is checked case-insensitively; the answer is also forwarded to the
 * AI council via onSubmit so the instructor can provide deeper feedback.
 *
 * Data schema:
 *   {
 *     prompt: string,
 *     termA: string,
 *     termB: string,
 *     termC: string,
 *     correctAnswer: string,
 *     acceptableAnswers?: string[],
 *     hint?: string
 *   }
 */
const AnalogyWidget = ({ data, onSubmit }) => {
  const baseData = normalizeBaseData(data, ["Pattern Recognition"]);
  const [answer, setAnswer] = useState(typeof baseData.studentAnswer === 'string' ? baseData.studentAnswer : '');
  const [submitted, setSubmitted] = useState(baseData.isHistorical);
  const [isCorrect, setIsCorrect] = useState(baseData.wasCorrect || false);
  const [usedHint, setUsedHint] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [startTime] = useState(() => Date.now()); // Cognitive sensor: Time-to-answer
  const [firstInteractionTime, setFirstInteractionTime] = useState(null); // Cognitive sensor: Hesitation

  
  // Schema Drift Protection 1: AI might put alternatives in an object or array called 'options'
  let extractedAcceptable = Array.isArray(data?.acceptableAnswers) ? data.acceptableAnswers : [];
  if (extractedAcceptable.length === 0 && data?.options) {
    if (Array.isArray(data.options)) extractedAcceptable = data.options;
    else if (typeof data.options === 'object') extractedAcceptable = Object.values(data.options);
  }

  // Schema Drift Protection 2: AI might provide a comma-separated list in correctAnswer
  let mainAnswer = data?.correctAnswer || data?.answer || extractedAcceptable?.[0] || "";
  if (typeof mainAnswer === 'string' && mainAnswer.includes(',')) {
    const parts = mainAnswer.split(',').map(s => s.trim()).filter(Boolean);
    mainAnswer = parts[0];
    extractedAcceptable = [...extractedAcceptable, ...parts.slice(1)];
  }

  const normalizedData = {
    ...baseData,
    prompt: data?.prompt || data?.title || "Complete the relationship pattern below.",
    termA: data?.termA || data?.A || "?",
    termB: data?.termB || data?.B || "?",
    termC: data?.termC || data?.C || "?",
    correctAnswer: mainAnswer,
    acceptableAnswers: extractedAcceptable,
  };

  // Semantic Clean-up: Strip natural grammatical articles before canonicalization
  const cleanAnswer = (str) => {
    const stripped = String(str || "").replace(/^(a|an|the)\s+/i, '');
    return canonicalize(stripped);
  };

  const handleAnswerChange = (e) => {
    if (!firstInteractionTime) setFirstInteractionTime(Date.now());
    setAnswer(e.target.value);
  };

  const handleSubmit = () => {
    if (submitted || isEvaluating) return;
    setIsEvaluating(true); // Improvement 14: Delayed Validation

    setTimeout(() => {
      const normalizedAnswer = cleanAnswer(answer);
      const acceptable = [
        normalizedData.correctAnswer,
        ...normalizedData.acceptableAnswers
      ]
        .filter(Boolean)
        .map(cleanAnswer);

      const uniqueAcceptable = [...new Set(acceptable)];

      const correct = uniqueAcceptable.includes(normalizedAnswer);
      setIsEvaluating(false);
      setIsCorrect(correct);
      setSubmitted(true);
      
      const responseTimeMs = Date.now() - startTime;

      // Compute Epistemic Confidence for the BKT Engine
      let epistemicConfidence = correct ? 1.0 : 0.0;
      if (correct) {
        if (usedHint) epistemicConfidence -= 0.3;
        if (responseTimeMs > 20000) epistemicConfidence -= 0.2; // High hesitation penalty
      } else if (responseTimeMs > 30000) {
        epistemicConfidence = 0.2; // Tried hard, but failed
      }
      epistemicConfidence = Math.round(Math.max(0.0, Math.min(1.0, epistemicConfidence)) * 100) / 100;

      // 3. Analytics & Telemetry Payload
      onSubmit({
        answer: answer.trim(),
        normalizedAnswer,
        expectedAnswer: normalizedData.correctAnswer,
        acceptableAnswers: normalizedData.acceptableAnswers,
        isCorrect: correct,
        telemetry: buildTelemetry({
          widgetId: 'analogy-v1',
          version: 'v2',
          isCorrect: correct,
          usedHint,
          executionMode: baseData.executionMode,
          answerData: { 
            responseLength: answer.length,
            startTime,
            firstInteractionTime,
            responseTimeMs,
            epistemicConfidence
          }
        })
      });
    }, 800); // 800ms reflection delay
  };

  return (
    <div className="analogy-widget card" style={{ backgroundColor: '#1E1E2E', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', width: '100%', maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* CSS Animations for Feedback */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-border {
          0% { border-color: rgba(99, 102, 241, 0.2); }
          50% { border-color: rgba(99, 102, 241, 0.8); box-shadow: 0 0 15px rgba(99,102,241,0.2); }
          100% { border-color: rgba(99, 102, 241, 0.2); }
        }
        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(52, 211, 153, 0); }
          100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
        }
        @keyframes shake-red {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
        .feedback-correct { animation: pulse-green 2s infinite; }
        .feedback-wrong { animation: shake-red 0.4s ease-in-out; }
        
        .analogy-submit-btn {
          background: linear-gradient(135deg, #6366F1, #8B5CF6);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          border: none;
        }
        .analogy-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.45);
        }
        .analogy-submit-btn:disabled {
          background: #475569;
          box-shadow: none;
          opacity: 0.5;
        }
      `}</style>

      {/* Header with Difficulty and Tags */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(129,140,248,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
          {normalizedData.tags.join(' • ')}
        </span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: normalizedData.difficulty === 'Hard' ? '#EF4444' : '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(245,158,11,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
          {normalizedData.difficulty === 'Easy' ? '🟢' : normalizedData.difficulty === 'Hard' ? '🔴' : '🟡'} {normalizedData.difficulty}
        </span>
      </div>

      {normalizedData.prompt && <h3 className="widget-prompt" style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '0.5rem' }}>{normalizedData.prompt}</h3>}
      
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          margin: '2rem 0',
          gap: '0.5rem'
        }}
      >
        {/* Top Pair */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={termBoxStyle}>{normalizedData.termA}</div>
          <span style={arrowStyle}>→</span>
          <div style={termBoxStyle}>{normalizedData.termB}</div>
        </div>

        {/* Cognitive Mapping Divider */}
        <div style={{ display: 'flex', alignItems: 'center', height: '2.5rem', margin: '0.5rem 0' }}>
          <div style={{ borderLeft: '2px dashed #475569', height: '100%', marginRight: '1rem' }}></div>
          <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>same relationship</span>
        </div>

        {/* Bottom Pair */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={termBoxStyle}>{normalizedData.termC}</div>
          <span style={arrowStyle}>→</span>
          
          {submitted ? (
            <div
              className={isCorrect ? 'feedback-correct' : 'feedback-wrong'}
              style={{
                ...termBoxStyle,
                borderColor: isCorrect ? '#10B981' : '#EF4444',
                backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: isCorrect ? '#34D399' : '#F87171',
              }}
            >
              {answer || "No Answer"}
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input
                type="text"
                value={answer}
                onChange={handleAnswerChange}
                onKeyDown={(e) => e.key === 'Enter' && answer.trim() && handleSubmit()}
                disabled={isEvaluating || submitted}
                onFocus={(e) => {
                  if (!isEvaluating && !submitted) {
                    e.target.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.25)';
                    e.target.style.borderColor = '#818CF8';
                  }
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                  e.target.style.borderColor = '#6366F1';
                }}
                placeholder="Your answer"
                autoFocus
                style={{
                  padding: '0.7rem 1rem',
                  borderRadius: '0.5rem',
                  border: '2px solid #6366F1',
                  backgroundColor: '#0F0F1A',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '1.2rem',
                  minWidth: '140px',
                  maxWidth: '100%',
                  textAlign: 'center',
                  outline: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s ease',
                }}
              />
              {!submitted && !isEvaluating && answer.trim() && (
                <span style={{ position: 'absolute', bottom: '-22px', fontSize: '0.75rem', color: '#818CF8', animation: 'fadeIn 0.2s ease-out', fontWeight: 600 }}>
                  Press Enter ↵
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Telemetry-tracked Hint */}
      {normalizedData.hint && !submitted && !baseData.isHistorical && (
        <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
          {!usedHint ? (
            <button 
              onClick={() => setUsedHint(true)} 
              style={{ background: 'none', border: 'none', color: '#818CF8', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Need a hint?
            </button>
          ) : (
            <p style={{ color: '#94A3B8', fontSize: '0.875rem', fontStyle: 'italic' }}>
              💡 Hint: {normalizedData.hint}
            </p>
          )}
        </div>
      )}

      {/* Feedback (shown after submit) */}
      {submitted && (
        <div style={{ marginBottom: '0.75rem' }}>
          {isCorrect ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#34D399', fontWeight: 500, fontSize: '1.05rem' }}>✓ Exactly right — <strong style={{ color: '#FFFFFF' }}>{normalizedData.correctAnswer}</strong> completes the pattern.</p>
              {normalizedData.explanation && <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.5 }}>{normalizedData.explanation}</p>}
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#F87171', fontWeight: 500, fontSize: '1.05rem' }}>
                ✗ Not quite. The correct answer is <strong style={{ color: '#FFFFFF' }}>{normalizedData.correctAnswer}</strong>.
              </p>
              {normalizedData.explanation && <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.5 }}>{normalizedData.explanation}</p>}
            </div>
          )}
        </div>
      )}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {!submitted && !isEvaluating && !baseData.isHistorical && (
          <button
            className="btn analogy-submit-btn"
            onClick={handleSubmit}
            disabled={!answer.trim()}
            style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', fontWeight: 700, fontSize: '1.05rem', borderRadius: '0.5rem' }}
          >
            Submit Answer
          </button>
        )}
        {baseData.isHistorical && <div style={{ marginTop: '1rem', color: '#64748B', fontStyle: 'italic' }}>Historical submission</div>}

        {isEvaluating && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', width: '100%', textAlign: 'center', borderRadius: '0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99,102,241,0.4)', animation: 'pulse-border 1.5s infinite' }}>
            <span style={{ color: '#818CF8', fontWeight: 600, letterSpacing: '0.05em' }}>
               <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: '8px' }}>⟳</span>
               Evaluating analogy...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const termBoxStyle = {
  padding: '0.6rem 1.25rem',
  borderRadius: '0.5rem',
  border: '1px solid rgba(99, 102, 241, 0.4)',
  backgroundColor: 'rgba(99, 102, 241, 0.1)',
  color: '#FFFFFF',
  fontWeight: 700,
  fontSize: '1.2rem',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
  minWidth: '120px',
  maxWidth: '250px',
  textAlign: 'center'
};

const arrowStyle = {
  color: '#64748b',
  fontWeight: 800,
  fontSize: '1.5rem',
  margin: '0 0.5rem',
};

export default AnalogyWidget;
