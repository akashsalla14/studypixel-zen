import React, { useState } from 'react';
import { normalizeBaseData, buildTelemetry } from './widgetNormalizer';

/**
 * ImageAnalysisWidget
 * Handles 'image-analysis-v1' widget type.
 * Upgraded to v2 architecture: Interactive reasoning capture, telemetry, modern UI.
 */
const ImageAnalysisWidget = ({ data, onSubmit }) => {
  // 1. Normalization Layer
  const baseData = normalizeBaseData(data, ["Analysis", "Visual"]);
  const imageUrl = data?.imageUrl || "";

  const [reasoning, setReasoning] = useState(baseData.studentAnswer || '');
  const [submitted, setSubmitted] = useState(baseData.isHistorical);
  const [usedHint, setUsedHint] = useState(false);
  const [startTime] = useState(() => Date.now()); // Cognitive sensor

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    
    const responseTimeMs = Date.now() - startTime;

    if (onSubmit) {
      // 2. Analytics & Telemetry Payload
      onSubmit({
        answer: `Image Analysis:\n${reasoning}`,
        reasoning,
        telemetry: buildTelemetry({
          widgetId: "image-analysis-v1",
          version: "v2",
          usedHint,
          executionMode: baseData.executionMode,
          answerData: {
            viewDurationMs: responseTimeMs,
            reasoningLength: reasoning.length
          }
        })
      });
    }
  };

  return (
    <div className="image-analysis-widget card" style={{ backgroundColor: '#1E1E2E', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      <style>{`
        .img-analysis-btn {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .img-analysis-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.45) !important;
        }
        .img-analysis-btn:disabled {
          background: #475569 !important;
          box-shadow: none !important;
          opacity: 0.5;
        }
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
        {baseData.prompt || "Analyze the following image:"}
      </h3>

      <div className="image-container" style={{ textAlign: 'center', marginBottom: '1.5rem', backgroundColor: '#0F0F1A', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #43435C' }}>
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={baseData.prompt || "Analysis Subject"} 
            style={{ maxWidth: '100%', borderRadius: '0.5rem', maxHeight: '650px', objectFit: 'contain' }} 
            onError={(e) => e.target.src = "https://placehold.co/512x512/1E1E2E/818CF8?text=Image+Failed+to+Load"}
          />
        ) : (
          <div style={{ padding: '3rem', color: '#EF4444', fontWeight: 600 }}>No image URL provided.</div>
        )}
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
      <div className="reasoning-capture" style={{ marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
        <label style={{ display: 'block', color: '#94A3B8', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
          Explain your analysis:
        </label>
        <textarea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          disabled={submitted || baseData.isHistorical}
          placeholder="What do you observe? Provide your detailed analysis..."
          style={{ 
            width: '100%', padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#0F0F1A', border: '1px solid #43435C', color: '#FFF', fontSize: '1rem', minHeight: '100px', resize: 'vertical', outline: 'none', transition: 'all 0.2s ease', lineHeight: 1.5
          }}
        />
      </div>

      {baseData.explanation && submitted && (
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.5 }}>{baseData.explanation}</p>
        </div>
      )}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {!baseData.isHistorical && <button
          className="img-analysis-btn"
          onClick={handleSubmit}
          disabled={submitted || reasoning.trim().length < 5}
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
        
        {!submitted && !baseData.isHistorical && (
          <div style={{ marginTop: '1rem', fontStyle: 'italic', color: '#64748B', fontSize: '0.85rem', textAlign: 'center' }}>
            Analyze the image and explain your reasoning above.
          </div>
        )}
        {baseData.isHistorical && <div style={{ marginTop: '1rem', color: '#64748B', fontStyle: 'italic' }}>Historical submission</div>}
      </div>
    </div>
  );
};

export default ImageAnalysisWidget;