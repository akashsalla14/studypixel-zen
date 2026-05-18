import React, { useState } from 'react';
import { normalizeBaseData, buildTelemetry } from './widgetNormalizer';

/**
 * MatchingWidget
 * Widget ID: matching-v1
 *
 * Click-to-select matching UI — no drag-and-drop library required.
 * Left column shows terms; right column shows shuffled definitions.
 * Matched pairs are highlighted with a colour from a palette.
 *
 * Data schema:
 *   { prompt: string, pairs: [{ term: string, definition: string }] }
 */

const PAIR_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6'
];

function normalizePairs(data) {
  if (Array.isArray(data?.pairs)) return data.pairs;
  if (Array.isArray(data?.items)) return data.items;

  if (Array.isArray(data?.terms) && Array.isArray(data?.definitions)) {
    const pairCount = Math.min(data.terms.length, data.definitions.length);
    return Array.from({ length: pairCount }, (_, index) => ({
      term: data.terms[index],
      definition: data.definitions[index],
    }));
  }

  return [];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MatchingWidget = ({ data, onSubmit }) => {
  // 1. Normalization Layer (Schema Drift Resistance)
  const baseData = normalizeBaseData(data, ["Terminology", "Association"]);
  const rawPairs = normalizePairs(data);

  // 2. Data Sanitization & Stable Identity Assignment
  const [processedPairs] = useState(() => {
    return rawPairs
      .map((p) => ({
        ...p,
        term: typeof p?.term === 'string' ? p.term : String(p?.term ?? ''),
        definition: typeof p?.definition === 'string' ? p.definition : String(p?.definition ?? ''),
      }))
      .filter(p => p.term.trim().length > 0 && p.definition.trim().length > 0)
      .map((p, i) => ({ ...p, term: p.term.trim(), definition: p.definition.trim(), id: `pair-${i}`, termId: `t-${i}`, defId: `d-${i}` }));
  });

  // 3. Freeze shuffle order on mount to prevent re-render jumps
  const [shuffledDefs] = useState(() => {
    return shuffle(processedPairs.map(p => ({
      defId: p.defId,
      definition: p.definition,
      correctTermId: p.termId
    })));
  });

  const [selectedTermId, setSelectedTermId] = useState(null);
  const [selectedDefId, setSelectedDefId] = useState(null);
  const [matches, setMatches] = useState(baseData.studentAnswer || {}); // termId -> defId
  const [submitted, setSubmitted] = useState(baseData.isHistorical);
  const [usedHint, setUsedHint] = useState(false);
  const [deselectionCount, setDeselectionCount] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [startTime] = useState(() => Date.now()); // Cognitive sensor
  const [firstInteractionTime, setFirstInteractionTime] = useState(null);

  // Early return if the AI hallucinates an empty widget
  if (processedPairs.length === 0) {
    return (
      <div className="matching-widget card" style={{ padding: '1.5rem', color: '#EF4444', backgroundColor: '#1E1E2E', border: '1px solid #EF4444', borderRadius: '1rem', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
        Unable to load exercise. The AI did not provide any valid matching pairs.
      </div>
    );
  }

  const getTermColor = (termId) => {
    if (!matches[termId]) return null;
    const idx = processedPairs.findIndex(p => p.termId === termId);
    return PAIR_COLORS[idx % PAIR_COLORS.length];
  };
  
  const getDefColor = (defId) => {
    const termId = Object.keys(matches).find((k) => matches[k] === defId);
    if (!termId) return null;
    const idx = processedPairs.findIndex(p => p.termId === termId);
    return PAIR_COLORS[idx % PAIR_COLORS.length];
  };

  const handleTermClick = (termId) => {
    if (submitted || isEvaluating) return;
    if (!firstInteractionTime) setFirstInteractionTime(Date.now());
    if (matches[termId]) {
      setMatches((prev) => { const n = { ...prev }; delete n[termId]; return n; });
      setDeselectionCount(c => c + 1);
      return;
    }
    setSelectedTermId(termId === selectedTermId ? null : termId);
    if (selectedDefId !== null && termId !== selectedTermId) {
      formMatch(termId, selectedDefId);
    }
  };

  const handleDefClick = (defId) => {
    if (submitted || isEvaluating) return;
    if (!firstInteractionTime) setFirstInteractionTime(Date.now());
    const existingTermId = Object.keys(matches).find((k) => matches[k] === defId);
    if (existingTermId) {
      setMatches((prev) => { const n = { ...prev }; delete n[existingTermId]; return n; });
      setDeselectionCount(c => c + 1);
      return;
    }
    setSelectedDefId(defId === selectedDefId ? null : defId);
    if (selectedTermId !== null && defId !== selectedDefId) {
      formMatch(selectedTermId, defId);
    }
  };

  const formMatch = (termId, defId) => {
    setMatches((prev) => ({ ...prev, [termId]: defId }));
    setSelectedTermId(null);
    setSelectedDefId(null);
  };

  const allMatched = Object.keys(matches).length === processedPairs.length;

  const handleSubmit = () => {
    if (submitted || isEvaluating) return;
    setIsEvaluating(true);

    setTimeout(() => {
      let correctCount = 0;
      let incorrectCount = 0;

      processedPairs.forEach(p => {
        if (matches[p.termId] === p.defId) correctCount++;
        else if (matches[p.termId]) incorrectCount++;
      });

      const isCorrect = correctCount === processedPairs.length;
      setIsEvaluating(false);
      setSubmitted(true);
      
      const responseTimeMs = Date.now() - startTime;

      // 3. Analytics & Telemetry Payload
      onSubmit({ 
        matches, 
        isCorrect,
        telemetry: buildTelemetry({
          widgetId: 'matching-v1',
          version: 'v2',
          isCorrect,
          usedHint,
          executionMode: baseData.executionMode,
          answerData: { 
            totalPairs: processedPairs.length, 
            matchedCount: Object.keys(matches).length,
            incorrectMatches: incorrectCount,
            deselectionCount,
            startTime,
            firstInteractionTime,
            responseTimeMs
          }
        })
      });
    }, 800); // 800ms reflection delay
  };

  const termBorder = (termId) => {
    if (selectedTermId === termId) return '2px solid #818CF8';
    const col = getTermColor(termId);
    if (submitted) {
      const pair = processedPairs.find(p => p.termId === termId);
      return matches[termId] === pair.defId ? '2px solid #10B981' : '2px solid #EF4444';
    }
    return col ? `2px solid ${col}` : '1px solid #43435C';
  };
  const defBorder = (def) => {
    if (selectedDefId === def.defId) return '2px solid #818CF8';
    const col = getDefColor(def.defId);
    if (submitted) {
      const termId = Object.keys(matches).find((k) => matches[k] === def.defId);
      return termId === def.correctTermId ? '2px solid #10B981' : '2px solid #EF4444';
    }
    return col ? `2px solid ${col}` : '1px solid #43435C';
  };

  const itemStyle = (border, bg, isSelected, isWrong) => ({
    padding: '0.8rem 1.2rem',
    borderRadius: '0.75rem',
    border,
    backgroundColor: bg || (isEvaluating ? '#181825' : '#0F0F1A'),
    cursor: submitted || isEvaluating ? 'default' : 'pointer',
    color: '#F8FAFC',
    transition: 'border 0.15s',
    marginBottom: '0.75rem',
    userSelect: 'none',
    fontSize: '1.05rem',
    fontWeight: 600,
    boxShadow: isSelected ? '0 0 0 4px rgba(99,102,241,0.25)' : '0 4px 6px rgba(0,0,0,0.1)',
    animation: isWrong ? 'shake-red 0.4s ease-in-out' : 'none',
  });

  return (
    <div className="matching-widget card" style={{ backgroundColor: '#1E1E2E', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', width: '100%', maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.4s ease-out' }}>
      
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
        
        .match-submit-btn {
          background: linear-gradient(135deg, #6366F1, #8B5CF6);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          border: none;
        }
        .match-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.45);
        }
        .match-submit-btn:disabled {
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
        Click a term, then click its matching definition.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Terms column */}
        <div>
          <p style={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.85rem', marginBottom: '1rem' }}>Terms</p>
          {processedPairs.map((pair) => {
            const col = getTermColor(pair.termId);
            const isSelected = selectedTermId === pair.termId;
            const isWrong = submitted && matches[pair.termId] !== pair.defId;
            const bg = submitted ? (isWrong ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)') : (col ? `${col}22` : undefined);
            
            return (
              <div
                key={pair.termId}
                role="button"
                tabIndex={submitted || isEvaluating || baseData.isHistorical ? -1 : 0}
                aria-pressed={isSelected || !!matches[pair.termId]}
                style={itemStyle(termBorder(pair.termId), bg, isSelected, isWrong)}
                onClick={() => handleTermClick(pair.termId)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTermClick(pair.termId); } }}
              >
                {pair.term}
              </div>
            );
          })}
        </div>

        {/* Definitions column (shuffled) */}
        <div>
          <p style={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.85rem', marginBottom: '1rem' }}>Definitions</p>
          {shuffledDefs.map((defEntry) => {
            const col = getDefColor(defEntry.defId);
            const isSelected = selectedDefId === defEntry.defId;
            const originalTermId = Object.keys(matches).find((k) => matches[k] === defEntry.defId);
            const isWrong = submitted && originalTermId !== defEntry.correctTermId;
            const bg = submitted ? (isWrong ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)') : (col ? `${col}22` : undefined);

            return (
              <div
                key={defEntry.defId}
                role="button"
                tabIndex={submitted || isEvaluating || baseData.isHistorical ? -1 : 0}
                aria-pressed={isSelected || !!originalTermId}
                style={itemStyle(defBorder(defEntry), bg, isSelected, isWrong)}
                onClick={() => handleDefClick(defEntry.defId)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDefClick(defEntry.defId); } }}
              >
                {defEntry.definition}
              </div>
            );
          })}
        </div>
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
          {processedPairs.every(p => matches[p.termId] === p.defId) ? (
            <p style={{ color: '#34D399', fontWeight: 500, fontSize: '1.05rem' }}>✓ All matches correct!</p>
          ) : (
            <p style={{ color: '#F87171', fontWeight: 500, fontSize: '1.05rem' }}>✗ Some matches are wrong. Review and try again!</p>
          )}
          {baseData.explanation && <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.5 }}>{baseData.explanation}</p>}
        </div>
      )}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {!submitted && !isEvaluating && !baseData.isHistorical && (
          <button
            className="btn match-submit-btn"
            onClick={handleSubmit}
            disabled={!allMatched}
            style={{ marginTop: '1.5rem', width: '100%', padding: '0.75rem', fontWeight: 700, fontSize: '1.05rem', borderRadius: '0.5rem' }}
          >
            Submit Matches
          </button>
        )}
        {baseData.isHistorical && <div style={{ marginTop: '1.5rem', color: '#64748B', fontStyle: 'italic' }}>Historical submission</div>}

        {isEvaluating && (
          <div style={{ marginTop: '1.5rem', padding: '0.75rem', width: '100%', textAlign: 'center', borderRadius: '0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99,102,241,0.4)', animation: 'pulse-border 1.5s infinite' }}>
            <span style={{ color: '#818CF8', fontWeight: 600, letterSpacing: '0.05em' }}>
               <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: '8px' }}>⟳</span>
               Evaluating matches...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchingWidget;
