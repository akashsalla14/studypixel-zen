import React, { useState } from 'react';
import { normalizeBaseData, buildTelemetry } from './widgetNormalizer';

/**
 * SignalComparisonWidget
 * Handles 'signal-comparison-v1' widget type.
 * Upgraded to v2 architecture with telemetry, normalization, and modern UI.
 */
export const SignalComparisonWidget = ({ data, onSubmit }) => {
  // 1. Normalization Layer (Schema Drift Resistance)
  const baseData = normalizeBaseData(data, ["Analysis", "Comparison"]);
  const signalA = data?.signalA || data?.a || "No signal A provided.";
  const signalB = data?.signalB || data?.b || "No signal B provided.";

  const [selected, setSelected] = useState(data?.studentSelected || baseData.studentAnswer?.selected || null);
  const [reasoning, setReasoning] = useState(data?.studentReasoning || baseData.studentAnswer?.reasoning || '');
  const [selectionChanges, setSelectionChanges] = useState(0);
  const [submitted, setSubmitted] = useState(baseData.isHistorical);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [startTime] = useState(() => Date.now()); // Cognitive sensor
  const [firstInteractionTime, setFirstInteractionTime] = useState(null);

  const handleSelect = (sig) => {
    if (submitted || isEvaluating) return;
    if (!firstInteractionTime) setFirstInteractionTime(Date.now());
    if (selected !== sig) {
      setSelected(sig);
      setSelectionChanges(c => c + 1);
    }
  };

  const handleReasoningChange = (e) => {
    if (!firstInteractionTime) setFirstInteractionTime(Date.now());
    setReasoning(e.target.value);
  };

  const handleSubmit = () => {
    if (submitted || isEvaluating) return;
    setIsEvaluating(true);
    
    setTimeout(() => {
      setSubmitted(true);
      setIsEvaluating(false);
      const responseTimeMs = Date.now() - startTime;

      if (onSubmit) {
        // 2. Analytics & Telemetry Payload
        onSubmit({
          answer: `Selected: Signal ${selected}\nReasoning: ${reasoning}`,
          selected,
          reasoning,
          telemetry: buildTelemetry({
            widgetId: "signal-comparison-v1",
            version: "v2",
            usedHint,
            executionMode: baseData.executionMode,
            answerData: {
              viewDurationMs: responseTimeMs,
              startTime,
              firstInteractionTime,
              signalALength: signalA.length,
              signalBLength: signalB.length,
              selectedSignal: selected,
              reasoningLength: reasoning.length,
              selectionChanges
            }
          })
        });
      }
    }, 800); // Cognitive reflection delay
  };

  return (
    <div className="signal-comparison-widget card" style={{ backgroundColor: '#1E1E2E', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', width: '100%', maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.5s ease-out' }}>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-border {
          0% { border-color: rgba(99, 102, 241, 0.2); }
          50% { border-color: rgba(99, 102, 241, 0.8); box-shadow: 0 0 15px rgba(99,102,241,0.2); }
          100% { border-color: rgba(99, 102, 241, 0.2); }
        }
        .sig-comp-btn {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .sig-comp-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.45) !important;
        }
        .sig-comp-btn:disabled {
          background: #475569 !important;
          box-shadow: none !important;
          opacity: 0.5;
        }
        /* Improvement 6: Differential Highlighting (Soft State Feedback) */
        .signal-box:hover:not(.disabled) {
          border-color: rgba(99, 102, 241, 0.6) !important;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15) !important;
          transform: translateY(-2px);
        }
        .signal-pre:hover {
          color: #E2E8F0 !important;
        }
        .signal-pre::-webkit-scrollbar { height: 8px; }
        .signal-pre::-webkit-scrollbar-track { background: #0F0F1A; border-radius: 4px; }
        .signal-pre::-webkit-scrollbar-thumb { background: #43435C; border-radius: 4px; }
      `}</style>

      {/* Header with Difficulty and Tags */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(129,140,248,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
          {baseData.tags.join(' • ')}
        </span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: baseData.difficulty === 'Hard' ? '#EF4444' : '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(245,158,11,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
          {baseData.difficulty === 'Easy' ? '🟢' : baseData.difficulty === 'Hard' ? '🔴' : '🟡'} {baseData.difficulty}
        </span>
      </div>

      <h3 style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', textAlign: 'center' }}>
        {baseData.prompt || "Compare the following signals:"}
      </h3>

      <div className="signals-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        {/* Signal A */}
        <div 
          className={`signal-box ${submitted || isEvaluating || baseData.isHistorical ? 'disabled' : ''}`}
          onClick={() => handleSelect('A')}
          style={{ 
            flex: '1 1 45%', 
            backgroundColor: selected === 'A' ? 'rgba(99, 102, 241, 0.15)' : '#0F0F1A', 
            border: selected === 'A' ? '2px solid #818CF8' : '1px solid #43435C', 
            borderRadius: '0.75rem', 
            overflow: 'hidden',
            cursor: submitted || isEvaluating || baseData.isHistorical ? 'default' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: selected === 'A' && !submitted ? '0 0 0 4px rgba(99,102,241,0.15)' : 'none'
          }}
        >
          <div style={{ backgroundColor: selected === 'A' ? '#2e3052' : '#181825', padding: '0.75rem 1rem', borderBottom: selected === 'A' ? '1px solid #818CF8' : '1px solid #43435C', color: selected === 'A' ? '#FFFFFF' : '#94A3B8', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
            Signal A
            {selected === 'A' && <span style={{ color: '#818CF8' }}>✓ Selected</span>}
          </div>
          <pre className="signal-pre" style={{ margin: 0, padding: '1rem', color: '#A5B4FC', whiteSpace: 'pre-wrap', overflowX: 'auto', fontSize: '0.95rem', fontFamily: 'monospace', transition: 'color 0.2s ease' }}>
            {signalA}
          </pre>
        </div>

        {/* Signal B */}
        <div 
          className={`signal-box ${submitted || isEvaluating || baseData.isHistorical ? 'disabled' : ''}`}
          onClick={() => handleSelect('B')}
          style={{ 
            flex: '1 1 45%', 
            backgroundColor: selected === 'B' ? 'rgba(99, 102, 241, 0.15)' : '#0F0F1A', 
            border: selected === 'B' ? '2px solid #818CF8' : '1px solid #43435C', 
            borderRadius: '0.75rem', 
            overflow: 'hidden',
            cursor: submitted || isEvaluating || baseData.isHistorical ? 'default' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: selected === 'B' && !submitted ? '0 0 0 4px rgba(99,102,241,0.15)' : 'none'
          }}
        >
          <div style={{ backgroundColor: selected === 'B' ? '#2e3052' : '#181825', padding: '0.75rem 1rem', borderBottom: selected === 'B' ? '1px solid #818CF8' : '1px solid #43435C', color: selected === 'B' ? '#FFFFFF' : '#94A3B8', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
            Signal B
            {selected === 'B' && <span style={{ color: '#818CF8' }}>✓ Selected</span>}
          </div>
          <pre className="signal-pre" style={{ margin: 0, padding: '1rem', color: '#A5B4FC', whiteSpace: 'pre-wrap', overflowX: 'auto', fontSize: '0.95rem', fontFamily: 'monospace', transition: 'color 0.2s ease' }}>
            {signalB}
          </pre>
        </div>
      </div>

      {/* Telemetry-tracked Hint */}
      {baseData.hint && !submitted && !baseData.isHistorical && (
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          {!usedHint ? (
            <button onClick={() => setUsedHint(true)} style={{ background: 'none', border: 'none', color: '#818CF8', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}>
              Need a hint?
            </button>
          ) : (
            <p style={{ color: '#94A3B8', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>💡 Hint: {baseData.hint}</p>
          )}
        </div>
      )}

      {/* Reasoning Capture Layer */}
      {selected && (
        <div className="reasoning-capture" style={{ marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
          <label style={{ display: 'block', color: '#94A3B8', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
            Explain your analysis:
          </label>
          <textarea
            value={reasoning}
            onChange={handleReasoningChange}
            disabled={submitted || isEvaluating || baseData.isHistorical}
            placeholder="What is the key difference? Why did you select this signal?"
            style={{ 
              width: '100%', padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#0F0F1A', border: '1px solid #43435C', color: '#FFF', fontSize: '1rem', minHeight: '100px', resize: 'vertical', outline: 'none', transition: 'all 0.2s ease', lineHeight: 1.5
            }}
          />
        </div>
      )}

      {baseData.explanation && submitted && (
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.5 }}>{baseData.explanation}</p>
        </div>
      )}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {!isEvaluating && !baseData.isHistorical && <button
          className="sig-comp-btn"
          onClick={handleSubmit}
          disabled={submitted || !selected || reasoning.trim().length < 5}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: 700,
            fontSize: '1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: submitted ? '#475569' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: submitted ? '#94A3B8' : 'white',
            cursor: submitted ? 'default' : 'pointer',
            boxShadow: submitted ? 'none' : '0 4px 15px rgba(99, 102, 241, 0.3)',
            width: '100%'
          }}
        >
          {submitted ? '✓ Submitted' : 'Submit Analysis'}
        </button>}
        {baseData.isHistorical && <div style={{ color: '#64748B', fontStyle: 'italic' }}>Historical submission</div>}

        {isEvaluating && (
          <div style={{ padding: '0.75rem', width: '100%', textAlign: 'center', borderRadius: '0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99,102,241,0.4)', animation: 'pulse-border 1.5s infinite' }}>
            <span style={{ color: '#818CF8', fontWeight: 600, letterSpacing: '0.05em' }}>
               <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: '8px' }}>⟳</span>
               Evaluating forensic trace...
            </span>
          </div>
        )}
        
        {!submitted && (
          <div style={{ marginTop: '1rem', fontStyle: 'italic', color: '#64748B', fontSize: '0.85rem', textAlign: 'center' }}>
            Select a signal and explain your reasoning above.
          </div>
        )}
      </div>
    </div>
  );
};