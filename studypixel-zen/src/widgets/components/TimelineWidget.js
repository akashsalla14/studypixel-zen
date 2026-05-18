import React, { useState } from 'react';
import { normalizeBaseData, buildTelemetry } from './widgetNormalizer';

/**
 * TimelineWidget
 * Widget ID: timeline-v1
 *
 * Drag-and-drop ordering widget using native HTML5 drag events (no library).
 * Students reorder a list of events to match the correct chronological order.
 * Perfect for attack phases, protocol sequences, or incident response chains.
 *
 * Data schema:
 *   {
 *     prompt: string,
 *     events: string[],             // display text of each event (randomly shuffled on mount)
 *     correctOrder: number[]        // 0-based original indices in the correct order
 *                                   // e.g. [2, 0, 1] means event[2] first, event[0] second, etc.
 *   }
 */
const TimelineWidget = ({ data, onSubmit }) => {
  // 1. Normalization Layer (Schema Drift Resistance)
  const baseData = normalizeBaseData(data, ["Sequencing", "Chronology"]);
  const rawEvents = Array.isArray(data?.events) ? data.events : (Array.isArray(data?.steps) ? data.steps : []);
  
  // 2. Data Sanitization & Stable Identity Assignment
  const [processedEvents] = useState(() => {
    const validEvents = rawEvents.filter(e => e && (typeof e === 'string' || typeof e?.label === 'string'));
    const orderRef = Array.isArray(data?.correctOrder) && data.correctOrder.length === validEvents.length 
      ? data.correctOrder 
      : validEvents.map((_, i) => i);

    return validEvents.map((e, i) => ({
      id: `evt-${i}-${Date.now()}`,
      text: typeof e === 'string' ? e : e.label,
      originalIndex: i,
      correctSequenceIndex: orderRef.indexOf(i)
    }));
  });

  // 3. Freeze shuffle order on mount to prevent re-render layout shifts
  const [order, setOrder] = useState(() => {
    if (baseData.isHistorical && Array.isArray(baseData.studentAnswer)) {
      return baseData.studentAnswer
        .map(origIdx => processedEvents.find(e => e.originalIndex === origIdx))
        .filter(Boolean);
    }
    const shuffled = [...processedEvents];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const [submitted, setSubmitted] = useState(baseData.isHistorical);
  const [dragSrcIdx, setDragSrcIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [kbdSelectedIdx, setKbdSelectedIdx] = useState(null);
  const [usedHint, setUsedHint] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [interactionTrace, setInteractionTrace] = useState([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [startTime] = useState(() => Date.now());
  const [firstInteractionTime, setFirstInteractionTime] = useState(null);

  // Early return if data is malformed to avoid rendering empty/broken lists
  // Must be after hooks to obey React Rules of Hooks
  if (processedEvents.length === 0) {
    return (
      <div className="timeline-widget card" style={{ padding: '1.5rem', color: '#EF4444', backgroundColor: '#1E1E2E', border: '1px solid #EF4444', borderRadius: '1rem', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
        Unable to load exercise. The AI did not provide valid sequence data.
      </div>
    );
  }

  // ── Native HTML5 drag handlers ────────────────────────────────────────────
  const handleDragStart = (e, idx) => {
    if (submitted || isEvaluating) return;
    if (!firstInteractionTime) setFirstInteractionTime(Date.now());
    setDragSrcIdx(idx);
    setKbdSelectedIdx(null); // Clear keyboard selection if mouse is used
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSrcIdx === null) return;
    if (dragOverIdx !== idx) {
      setDragOverIdx(idx);
    }
  };

  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    if (dragSrcIdx !== null && dragSrcIdx !== dropIdx) {
      setOrder((prev) => {
        const next = [...prev];
        const [removed] = next.splice(dragSrcIdx, 1);
        next.splice(dropIdx, 0, removed);
        return next;
      });
      setInteractionTrace(prev => [...prev, { from: dragSrcIdx, to: dropIdx, timestamp: Date.now() }]);
      setMoveCount(c => c + 1);
    }
    setDragSrcIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragSrcIdx(null);
    setDragOverIdx(null);
  };

  // ── Keyboard Accessibility Handlers ───────────────────────────────────────
  const handleKeyDown = (e, idx) => {
    if (submitted || isEvaluating) return;
    if (!firstInteractionTime) setFirstInteractionTime(Date.now());
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setKbdSelectedIdx(kbdSelectedIdx === idx ? null : idx);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (kbdSelectedIdx === null || kbdSelectedIdx !== idx) return;
      e.preventDefault();
      const direction = e.key === 'ArrowUp' ? -1 : 1;
      const newIdx = kbdSelectedIdx + direction;
      
      if (newIdx >= 0 && newIdx < order.length) {
        setOrder((prev) => {
          const next = [...prev];
          [next[kbdSelectedIdx], next[newIdx]] = [next[newIdx], next[kbdSelectedIdx]];
          return next;
        });
        setInteractionTrace(prev => [...prev, { from: kbdSelectedIdx, to: newIdx, timestamp: Date.now() }]);
        setKbdSelectedIdx(newIdx);
        setMoveCount(c => c + 1);
      }
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (submitted || isEvaluating) return;
    setIsEvaluating(true);

    setTimeout(() => {
      let incorrectCount = 0;
      order.forEach((evt, pos) => {
        if (evt.correctSequenceIndex !== pos) incorrectCount++;
      });

      const isCorrect = incorrectCount === 0;
      setIsEvaluating(false);
      setSubmitted(true);
      setKbdSelectedIdx(null);
      
      const responseTimeMs = Date.now() - startTime;

      // 3. Analytics & Telemetry Payload
      onSubmit({ 
        studentOrder: order.map(e => e.originalIndex), 
        isCorrect,
        telemetry: buildTelemetry({
          widgetId: 'timeline-v1',
          version: 'v2',
          isCorrect,
          usedHint,
          executionMode: baseData.executionMode,
          answerData: {
            totalItems: processedEvents.length,
            incorrectPositions: incorrectCount,
            moveCount,
            interactionTrace,
            startTime,
            firstInteractionTime,
            responseTimeMs
          }
        })
      });
    }, 800);
  };

  return (
    <div className="timeline-widget card" style={{ backgroundColor: '#1E1E2E', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', width: '100%', maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.4s ease-out' }}>
      
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
        @keyframes shake-red {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
          75% { transform: translateX(-4px); }
        }
        .timeline-submit-btn {
          background: linear-gradient(135deg, #6366F1, #8B5CF6);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          border: none;
        }
        .timeline-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.45);
        }
        .timeline-submit-btn:disabled {
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

      {baseData.prompt && <h3 className="widget-prompt" style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '0.5rem' }}>{baseData.prompt}</h3>}

      <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Drag the events into the correct order (top = first).
      </p>

      <div>
        {order.map((evt, pos) => {
          const isWrong = submitted && evt.correctSequenceIndex !== pos;
          const isDragged = dragSrcIdx === pos;
          const isDragOver = dragOverIdx === pos && dragSrcIdx !== pos && dragSrcIdx !== null;
          
          let boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          if (kbdSelectedIdx === pos) {
            boxShadow = '0 0 0 4px rgba(99,102,241,0.25)';
          } else if (isDragOver) {
            boxShadow = dragSrcIdx > pos ? '0 -4px 0 0 #818CF8' : '0 4px 0 0 #818CF8';
          }
          
          return (
          <div
            key={evt.id}
            draggable={!submitted && !isEvaluating && !baseData.isHistorical}
            role="button"
            tabIndex={submitted || isEvaluating || baseData.isHistorical ? -1 : 0}
            aria-grabbed={kbdSelectedIdx === pos}
            onDragStart={(e) => handleDragStart(e, pos)}
            onDragOver={(e) => handleDragOver(e, pos)}
            onDrop={(e) => handleDrop(e, pos)}
            onDragEnd={handleDragEnd}
            onKeyDown={(e) => handleKeyDown(e, pos)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.8rem 1rem',
              marginBottom: '0.5rem',
              borderRadius: '0.75rem',
              border: submitted
                ? (isWrong ? '2px solid #EF4444' : '2px solid #10B981')
                : (isDragged ? '2px dashed #6366F1' : '1px solid #43435C'),
              backgroundColor: submitted ? (isWrong ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)') : (isEvaluating ? '#181825' : '#0F0F1A'),
              cursor: submitted || isEvaluating || baseData.isHistorical ? 'default' : 'grab',
              color: '#F8FAFC',
              fontWeight: 600,
              fontSize: '1.05rem',
              transition: 'border 0.15s',
              userSelect: 'none',
              boxShadow: boxShadow,
              opacity: isDragged ? 0.5 : 1,
              animation: isWrong ? 'shake-red 0.4s ease-in-out' : 'none',
            }}
          >
            <span style={{
              minWidth: '1.75rem',
              height: '1.75rem',
              borderRadius: '50%',
              backgroundColor: 'rgba(99,102,241,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#A5B4FC',
            }}>
              {pos + 1}
            </span>
            {!submitted && !isEvaluating && !baseData.isHistorical && (
              <span style={{ color: '#475569', fontSize: '1rem', cursor: 'grab' }}>⠿</span>
            )}
            <span style={{ flex: 1 }}>{evt.text}</span>
            {submitted && (
              <span style={{ color: isWrong ? '#F87171' : '#34D399', fontWeight: 800 }}>{isWrong ? '✗' : '✓'}</span>
            )}
          </div>
          );
        })}
      </div>

      {/* Telemetry-tracked Hint */}
      {baseData.hint && !submitted && !baseData.isHistorical && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
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
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          {order.every((evt, pos) => evt.correctSequenceIndex === pos) ? (
            <p style={{ color: '#34D399', fontWeight: 500, fontSize: '1.05rem' }}>✓ Perfect order!</p>
          ) : (
            <div>
              <p style={{ color: '#F87171', fontWeight: 500, fontSize: '1.05rem', marginBottom: '0.5rem' }}>✗ Not quite. Correct order:</p>
              {processedEvents
                .slice()
                .sort((a, b) => a.correctSequenceIndex - b.correctSequenceIndex)
                .map((evt, pos) => (
                  <p key={evt.id} style={{ color: '#94A3B8', margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    {pos + 1}. <strong style={{ color: '#FFFFFF' }}>{evt.text}</strong>
                  </p>
                ))}
            </div>
          )}
          {baseData.explanation && <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.5 }}>{baseData.explanation}</p>}
        </div>
      )}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {!submitted && !isEvaluating && !baseData.isHistorical && (
          <button
            className="btn timeline-submit-btn"
            onClick={handleSubmit}
            style={{ marginTop: '1.5rem', width: '100%', padding: '0.75rem', fontWeight: 700, fontSize: '1.05rem', borderRadius: '0.5rem' }}
          >
            Submit Order
          </button>
        )}
        {baseData.isHistorical && <div style={{ marginTop: '1.5rem', color: '#64748B', fontStyle: 'italic' }}>Historical submission</div>}

        {isEvaluating && (
          <div style={{ marginTop: '1.5rem', padding: '0.75rem', width: '100%', textAlign: 'center', borderRadius: '0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99,102,241,0.4)', animation: 'pulse-border 1.5s infinite' }}>
            <span style={{ color: '#818CF8', fontWeight: 600, letterSpacing: '0.05em' }}>
               <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: '8px' }}>⟳</span>
               Evaluating sequence...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineWidget;
