import React, { useState } from 'react';
import { normalizeBaseData, canonicalize, buildTelemetry } from './widgetNormalizer';

/**
 * FillBlankWidget
 * Widget ID: fill-blank-v1
 *
 * Renders a sentence with [BLANK] markers replaced by inline <input> fields.
 * The student types answers and submits; correctness is checked case-insensitively.
 *
 * Data schema:
 *   { prompt: string, sentence: string, correctAnswers: string[], hint?: string }
 */
const FillBlankWidget = ({ data, onSubmit }) => {
  const baseData = normalizeBaseData(data, ["Vocabulary", "Syntax"]);
  const sentence = data?.sentence || data?.text || "";
  
  // Enhanced regex: LLMs frequently hallucinate underscores (e.g., "_____") instead of "[BLANK]"
  const parts = sentence.split(/\[BLANK\]|_{3,}/i);
  const blankCount = Math.max(0, parts.length - 1);

  // Schema Drift Protection: Handle AI sending ["ans1"] or comma-separated strings ["ans1, alt1"]
  const normalizedAnswers = Array.isArray(data?.correctAnswers)
    ? data.correctAnswers.map(ans => {
        if (Array.isArray(ans)) return ans;
        if (typeof ans === 'string' && ans.includes(',')) {
          return ans.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [String(ans)];
      })
    : Array(blankCount).fill([]);

  // Semantic Clean-up: Strip natural grammatical articles before canonicalization
  const cleanAnswer = (str) => {
    const stripped = String(str || "").replace(/^(a|an|the)\s+/i, '');
    return canonicalize(stripped);
  };

  const [answers, setAnswers] = useState(() => {
    if (Array.isArray(baseData.studentAnswer)) return baseData.studentAnswer;
    return Array(blankCount).fill('');
  });
  const [submitted, setSubmitted] = useState(baseData.isHistorical);
  const [results, setResults] = useState(() => {
    if (baseData.isHistorical && Array.isArray(baseData.studentAnswer)) {
      return baseData.studentAnswer.map((ans, i) => {
        const normalizedInput = cleanAnswer(ans);
        const acceptable = (normalizedAnswers[i] || []).map(cleanAnswer);
        return { answer: ans, normalizedInput, expected: normalizedAnswers[i]?.[0] || "", correct: acceptable.includes(normalizedInput) };
      });
    }
    return [];
  });
  const [usedHint, setUsedHint] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [startTime] = useState(() => Date.now()); // Cognitive sensor
  const [firstInteractionTime, setFirstInteractionTime] = useState(null);


  // Early return if the AI hallucinates a sentence with no blanks
  if (blankCount === 0) {
    return (
      <div className="fill-blank-widget card" style={{ padding: '1.5rem', color: '#EF4444', backgroundColor: '#1E1E2E', border: '1px solid #EF4444', borderRadius: '1rem', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
        Unable to load exercise. The AI did not provide any [BLANK] markers.
      </div>
    );
  }

  const handleChange = (index, value) => {
    if (!firstInteractionTime) setFirstInteractionTime(Date.now());
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = () => {
    if (submitted || isEvaluating) return;
    setIsEvaluating(true);

    setTimeout(() => {
      const evaluation = answers.map((ans, i) => {
        const normalizedInput = cleanAnswer(ans);
        const acceptable = (normalizedAnswers[i] || []).map(cleanAnswer);
        return {
          answer: ans,
          normalizedInput,
          expected: normalizedAnswers[i]?.[0] || "",
          correct: acceptable.includes(normalizedInput),
        };
      });

      const isCorrect = evaluation.every((e) => e.correct);
      setIsEvaluating(false);
      setResults(evaluation);
      setSubmitted(true);
      
      const responseTimeMs = Date.now() - startTime;
      onSubmit({ 
        answers, 
        isCorrect, 
        evaluation,
        telemetry: buildTelemetry({
          widgetId: 'fill-blank-v1',
          version: 'v2',
          isCorrect,
          usedHint,
          executionMode: baseData.executionMode,
          answerData: { 
            blankCount, 
            correctCount: evaluation.filter(e => e.correct).length,
            startTime,
            firstInteractionTime,
            responseTimeMs
          }
        })
      });
    }, 800); // 800ms reflection delay
  };

  const allFilled = answers.length > 0 && answers.every((a) => a.trim() !== '');

  return (
    <div className="fill-blank-widget card" style={{ backgroundColor: '#1E1E2E', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', width: '100%', maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* CSS Animations */}
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
          70% { box-shadow: 0 0 0 8px rgba(52, 211, 153, 0); }
          100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
        }
        @keyframes shake-red {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
          75% { transform: translateX(-4px); }
        }
        .feedback-correct { animation: pulse-green 2s infinite; }
        .feedback-wrong { animation: shake-red 0.4s ease-in-out; }
        
        .fill-submit-btn {
          background: linear-gradient(135deg, #6366F1, #8B5CF6);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          border: none;
        }
        .fill-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.45);
        }
        .fill-submit-btn:disabled {
          background: #475569;
          box-shadow: none;
          opacity: 0.5;
        }
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

      {baseData.prompt && <h3 className="widget-prompt" style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem' }}>{baseData.prompt}</h3>}

      <div className="fill-blank-sentence" style={{ lineHeight: 2.6, fontSize: '1.2rem', color: '#E2E8F0', margin: '2rem 0', textAlign: 'center' }}>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <span>{part}</span>
            {i < blankCount && (
              <input
                type="text"
                value={answers[i]}
                onChange={(e) => handleChange(i, e.target.value)}
                disabled={submitted || isEvaluating || baseData.isHistorical}
                placeholder="..."
                className={submitted ? (results[i]?.correct ? 'feedback-correct' : 'feedback-wrong') : ''}
                onFocus={(e) => {
                  if (!submitted && !isEvaluating) {
                    e.target.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.25)';
                    e.target.style.borderColor = '#818CF8';
                  }
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                  e.target.style.borderColor = submitted ? (results[i]?.correct ? '#10B981' : '#EF4444') : '#6366F1';
                }}
                style={{
                  display: 'inline-block',
                  width: `${Math.max(60, (answers[i].length + 2) * 12)}px`, // Auto-expanding width
                  minWidth: '80px',
                  maxWidth: '220px',
                  margin: '0 8px',
                  padding: '4px 12px',
                  borderRadius: '0.5rem',
                  border: submitted
                    ? results[i]?.correct
                      ? '2px solid #10B981'
                      : '2px solid #EF4444'
                    : '2px solid #6366F1',
                  backgroundColor: submitted
                    ? results[i]?.correct ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                    : '#0F0F1A',
                  color: submitted
                    ? results[i]?.correct ? '#34D399' : '#F87171'
                    : '#FFFFFF',
                  textAlign: 'center',
                  outline: 'none',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s ease',
                  verticalAlign: 'baseline',
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Telemetry-tracked Hint */}
      {baseData.hint && !submitted && !baseData.isHistorical && (
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
              💡 Hint: {baseData.hint}
            </p>
          )}
        </div>
      )}

      {submitted && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          {results.every(r => r.correct) ? (
            <div>
              <p style={{ color: '#34D399', fontWeight: 500, fontSize: '1.05rem' }}>✓ Perfect!</p>
              {baseData.explanation && <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.5 }}>{baseData.explanation}</p>}
            </div>
          ) : (
            <div>
              <p style={{ color: '#F87171', fontWeight: 500, fontSize: '1.05rem', marginBottom: '0.5rem' }}>✗ Some blanks are incorrect. Review the expected answers:</p>
              {results.map((r, i) => (
                !r.correct && (
                  <p key={i} style={{ color: '#94A3B8', margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    Blank {i + 1}: Expected <strong style={{ color: '#FFFFFF' }}>{r.expected}</strong>
                  </p>
                )
              ))}
              {baseData.explanation && <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.5 }}>{baseData.explanation}</p>}
            </div>
          )}
        </div>
      )}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {!submitted && !isEvaluating && !baseData.isHistorical && (
          <button
            className="btn fill-submit-btn"
            onClick={handleSubmit}
            disabled={!allFilled}
            style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', fontWeight: 700, fontSize: '1.05rem', borderRadius: '0.5rem' }}
          >
            Submit Answers
          </button>
        )}
        {baseData.isHistorical && <div style={{ marginTop: '1rem', color: '#64748B', fontStyle: 'italic' }}>Historical submission</div>}

        {isEvaluating && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', width: '100%', textAlign: 'center', borderRadius: '0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99,102,241,0.4)', animation: 'pulse-border 1.5s infinite' }}>
            <span style={{ color: '#818CF8', fontWeight: 600, letterSpacing: '0.05em' }}>
               <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: '8px' }}>⟳</span>
               Evaluating answers...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FillBlankWidget;
