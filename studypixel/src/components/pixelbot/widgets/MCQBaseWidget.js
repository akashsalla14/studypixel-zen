import React, { useState } from 'react';
import { normalizeBaseData, buildTelemetry } from './widgetNormalizer';

const coerceOption = (opt) => {
  if (opt == null) return '';
  if (typeof opt === 'string') return opt;
  if (typeof opt === 'object') {
    return opt.label ?? opt.value ?? opt.text ?? JSON.stringify(opt);
  }
  return String(opt);
};

const normalizeOptions = (rawOptions) => {
  const normalizedOptions = {};

  if (Array.isArray(rawOptions)) {
    rawOptions.forEach((opt, idx) => {
      normalizedOptions[String.fromCharCode(65 + idx)] = coerceOption(opt);
    });
  } else if (rawOptions && typeof rawOptions === 'object') {
    Object.entries(rawOptions).forEach(([key, value]) => {
      normalizedOptions[key] = coerceOption(value);
    });
  }

  return normalizedOptions;
};

export const MCQBaseWidget = ({
  data,
  onSubmit,
  requiresReasoning = false,
  widgetId = 'mcq-v1',
  defaultTags = ['Assessment', 'Multiple Choice'],
}) => {
  const baseData = normalizeBaseData(data, defaultTags);
  const normalizedOptions = normalizeOptions(data?.options);
  const correctAnswer = data?.correctAnswer || '';

  const [selected, setSelected] = useState(baseData.studentAnswer || data?.studentSelected || null);
  const [reasoning, setReasoning] = useState(data?.studentReasoning || '');
  const [submitted, setSubmitted] = useState(baseData.isHistorical || false);
  const [usedHint, setUsedHint] = useState(false);
  const [selectionChanges, setSelectionChanges] = useState(0);
  const [startTime] = useState(() => Date.now());
  const [firstInteractionTime, setFirstInteractionTime] = useState(null);

  if (Object.keys(normalizedOptions).length === 0) {
    return (
      <div className="mcq-widget card" style={{ padding: '1.5rem', color: '#EF4444', backgroundColor: '#1E1E2E', border: '1px solid #EF4444', borderRadius: '1rem', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
        Unable to load exercise. The AI did not provide any options.
      </div>
    );
  }

  const recordInteraction = () => {
    if (!firstInteractionTime) {
      setFirstInteractionTime(Date.now());
    }
  };

  const handleSelect = (key) => {
    if (submitted) return;
    recordInteraction();
    if (selected !== key) {
      setSelected(key);
      setSelectionChanges((count) => count + 1);
    }
  };

  const handleSubmit = () => {
    const isCorrect = selected === correctAnswer;
    setSubmitted(true);

    const responseTimeMs = Date.now() - startTime;
    let epistemicConfidence = isCorrect ? 1.0 : 0.0;

    if (isCorrect) {
      if (usedHint) epistemicConfidence -= 0.2;
      if (selectionChanges > 0) epistemicConfidence -= (Math.min(selectionChanges, 3) * 0.1);

      if (requiresReasoning) {
        if (reasoning.length < 20) epistemicConfidence -= 0.2;
        if (reasoning.length > 100) epistemicConfidence += 0.1;
      } else if (responseTimeMs < 2000) {
        epistemicConfidence -= 0.2;
      }
    } else {
      if (selectionChanges > 2) epistemicConfidence = 0.1;
      else if (responseTimeMs > 5000) epistemicConfidence = 0.3;
    }

    epistemicConfidence = Math.round(Math.max(0.0, Math.min(1.0, epistemicConfidence)) * 100) / 100;

    onSubmit({
      selected,
      isCorrect,
      reasoning: requiresReasoning ? reasoning : undefined,
      telemetry: buildTelemetry({
        widgetId,
        version: 'v2',
        isCorrect,
        usedHint,
        executionMode: baseData.executionMode,
        answerData: {
          selectedOption: selected,
          selectionChanges,
          requiresReasoning,
          reasoningLength: reasoning.length,
          startTime,
          firstInteractionTime,
          responseTimeMs,
          epistemicConfidence,
        },
      }),
    });
  };

  return (
    <div className="mcq-widget card" style={{ backgroundColor: '#1E1E2E', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      <style>{`@keyframes shake-red {0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 50% { transform: translateX(4px); } 75% { transform: translateX(-4px); }} @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } } .mcq-submit-btn { background: linear-gradient(135deg, #6366F1, #8B5CF6); box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35); transition: transform 0.2s ease, box-shadow 0.2s ease; border: none; } .mcq-submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(99, 102, 241, 0.45); } .mcq-submit-btn:disabled { background: #475569; box-shadow: none; opacity: 0.5; }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(129,140,248,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>{baseData.tags.join(' • ')}</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: baseData.difficulty === 'Hard' ? '#EF4444' : '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(245,158,11,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>{baseData.difficulty === 'Easy' ? '🟢' : baseData.difficulty === 'Hard' ? '🔴' : '🟡'} {baseData.difficulty}</span>
      </div>

      <h3 className="mcq-question" style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', lineHeight: 1.4 }}>{baseData.prompt}</h3>

      <div className="mcq-options" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {Object.entries(normalizedOptions).map(([key, text]) => {
          const isSelected = selected === key;
          const isCorrectAnswer = key === correctAnswer;
          const isWrongSelection = submitted && isSelected && !isCorrectAnswer;
          const showAsCorrect = submitted && isCorrectAnswer;

          let border = '1px solid #43435C';
          let bg = '#0F0F1A';
          let textColor = '#F8FAFC';

          if (submitted) {
            if (showAsCorrect) { border = '2px solid #10B981'; bg = 'rgba(16, 185, 129, 0.1)'; }
            else if (isWrongSelection) { border = '2px solid #EF4444'; bg = 'rgba(239, 68, 68, 0.1)'; }
          } else if (isSelected) {
            border = '2px solid #818CF8'; bg = 'rgba(99, 102, 241, 0.15)'; textColor = '#FFFFFF';
          }

          return (
            <div key={key} role="button" tabIndex={submitted || baseData.isHistorical ? -1 : 0} aria-pressed={isSelected} onClick={() => handleSelect(key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(key); } }} style={{ border, backgroundColor: bg, padding: '1rem 1.25rem', borderRadius: '0.75rem', cursor: submitted || baseData.isHistorical ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.15s ease', animation: isWrongSelection ? 'shake-red 0.4s ease-in-out' : 'none', boxShadow: isSelected && !submitted ? '0 0 0 4px rgba(99,102,241,0.15)' : 'none' }}>
              <span className="option-key" style={{ fontWeight: 800, color: submitted ? (showAsCorrect ? '#34D399' : isWrongSelection ? '#F87171' : '#64748B') : (isSelected ? '#A5B4FC' : '#818CF8'), minWidth: '1.5rem' }}>{key}.</span>
              <span className="option-text" style={{ color: textColor, fontWeight: isSelected ? 600 : 500, lineHeight: 1.4, transition: 'all 0.15s ease' }}>{text}</span>
              {submitted && showAsCorrect && <span style={{ marginLeft: 'auto', color: '#34D399', fontWeight: 800 }}>✓</span>}
              {submitted && isWrongSelection && <span style={{ marginLeft: 'auto', color: '#F87171', fontWeight: 800 }}>✗</span>}
            </div>
          );
        })}
      </div>

      {baseData.hint && !submitted && !baseData.isHistorical && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          {!usedHint ? <button onClick={() => { recordInteraction(); setUsedHint(true); }} style={{ background: 'none', border: 'none', color: '#818CF8', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}>Need a hint?</button> : <p style={{ color: '#94A3B8', fontSize: '0.875rem', fontStyle: 'italic' }}>💡 Hint: {baseData.hint}</p>}
        </div>
      )}

      {requiresReasoning && selected && (
        <div className="mcq-reasoning" style={{ marginTop: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
          <label style={{ display: 'block', color: '#94A3B8', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>Explain your reasoning:</label>
          <textarea value={reasoning} onChange={(e) => { recordInteraction(); setReasoning(e.target.value); }} disabled={submitted || baseData.isHistorical} maxLength={1000} placeholder="Why did you choose this answer? Explain your thought process..." onFocus={(e) => { e.target.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.25)'; e.target.style.borderColor = '#818CF8'; }} onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#43435C'; }} style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#0F0F1A', border: '1px solid #43435C', color: '#FFF', fontSize: '1rem', minHeight: '100px', resize: 'vertical', outline: 'none', transition: 'all 0.2s ease', lineHeight: 1.5 }} />
        </div>
      )}

      {submitted && baseData.explanation && <div style={{ marginTop: '1.5rem', textAlign: 'center' }}><p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.5 }}>{baseData.explanation}</p></div>}

      {!submitted && !baseData.isHistorical && <button className="btn mcq-submit-btn" disabled={!selected || (requiresReasoning && !reasoning.trim())} onClick={handleSubmit} style={{ marginTop: '1.5rem', width: '100%', padding: '0.75rem', fontWeight: 700, fontSize: '1.05rem', borderRadius: '0.5rem' }}>Submit Answer</button>}
      {baseData.isHistorical && <div style={{ marginTop: '1.5rem', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>Historical submission</div>}
    </div>
  );
};

export default MCQBaseWidget;