import React, { useState, useCallback, useEffect } from 'react';
import { normalizeBaseData, buildTelemetry } from './widgetNormalizer';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase';

// Create stable callable references at module scope to avoid changing identity each render
const runSandboxCodeCallable = httpsCallable(functions, 'runSandboxCode');
const submitSandboxSolutionCallable = httpsCallable(functions, 'submitSandboxSolution');
const getSandboxAttemptsCallable = httpsCallable(functions, 'getSandboxAttempts');

/**
 * TacticalSandboxWidget
 * Handles 'tactical-sandbox-v1' widget type.
 * Upgraded to v2 architecture with telemetry, normalization, and modern UI.
 */
export const TacticalSandboxWidget = ({ data, onSubmit, pixelBotId: pixelBotIdProp, topic: topicProp }) => {
  const baseData = normalizeBaseData(data, ['Coding', 'Sandbox']);
  const taskPrompt = data?.taskPrompt || data?.task || data?.scenario || baseData.prompt || 'Write your code below.';
  const language = data?.language || data?.environment || 'plaintext';
  const initialCode = data?.initialCode || data?.code || '';

  const [code, setCode] = useState(baseData.studentAnswer || initialCode);
  const [output, setOutput] = useState('');
  const [runStatus, setRunStatus] = useState(baseData.isHistorical ? (baseData.wasCorrect ? 'passed' : 'failed') : 'idle');
  const [passed, setPassed] = useState(baseData.wasCorrect || false);
  const [submitted, setSubmitted] = useState(baseData.isHistorical);
  const [usedHint, setUsedHint] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const [compileErrorCount, setCompileErrorCount] = useState(0);
  const [firstRunTime, setFirstRunTime] = useState(null);
  const [firstInteractionTime, setFirstInteractionTime] = useState(null);
  const [startTime] = useState(() => (typeof performance !== 'undefined' ? performance.now() : 0));

  // Use stable callables created at module scope
  const runSandboxCode = runSandboxCodeCallable;
  const submitSandboxSolution = submitSandboxSolutionCallable;
  const getSandboxAttempts = getSandboxAttemptsCallable;

  const [attempts, setAttempts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const effectivePixelBotId = pixelBotIdProp || baseData.pixelBotId || '';
        const resp = await getSandboxAttempts({ widgetId: 'tactical-sandbox-v1', pixelBotId: effectivePixelBotId });
        if (mounted) setAttempts(resp?.data?.attempts || []);
      } catch {
        // ignore
      }
    };
    load();
    return () => { mounted = false; };
  }, [baseData.pixelBotId, pixelBotIdProp, getSandboxAttempts]);

  const generateAttemptId = useCallback(() => `${Date.now()}-${Math.random().toString(36).slice(2,9)}`, []);

  const handleReset = useCallback(() => {
    setCode(initialCode);
    setOutput('');
    setRunStatus('idle');
    setPassed(false);
    setRunCount(0);
    setCompileErrorCount(0);
    setFirstRunTime(null);
    setFirstInteractionTime(null);
    setSubmitted(false);
  }, [initialCode]);

  const handleRun = useCallback(async () => {
    if (submitted) return;
    const now = Date.now();
    if (!firstInteractionTime) setFirstInteractionTime(now);
    if (!firstRunTime) setFirstRunTime(now);
    setRunCount((count) => count + 1);
    setRunStatus('running');

    const trimmedCode = String(code || "");
    const validationTest = data?.validationTest || '';
    const attemptId = generateAttemptId();

    // Quick client-side guard
    if (trimmedCode.trim().length < 3) {
      setCompileErrorCount((prev) => prev + 1);
      setPassed(false);
      setRunStatus('compile_error');
      setOutput(`> Running ${language} code...\n> Executing validation: ${validationTest || 'none'}\n\n(Skipped) Code too short to run.`);
      return;
    }

    try {
      const resp = await runSandboxCode({ language, code: trimmedCode, validationTest, widgetId: 'tactical-sandbox-v1', attemptId });
      const result = resp?.data || {};
      const { status = 'Unknown', stdout = '', stderr = '', passed: serverPassed = false, executionMs = null } = result;

      setOutput([
        `> Server execution status: ${status}`,
        executionMs ? `> executionMs: ${executionMs}` : null,
        stdout ? `STDOUT:\n${stdout}` : null,
        stderr ? `STDERR:\n${stderr}` : null
      ].filter(Boolean).join('\n\n'));

      setPassed(Boolean(serverPassed));
      setRunStatus(serverPassed ? 'passed' : 'failed');
    } catch (err) {
      setRunStatus('error');
      setOutput(`Server error executing code: ${err?.message || String(err)}`);
    }
  }, [submitted, firstInteractionTime, firstRunTime, code, data, language, runSandboxCode, generateAttemptId, setFirstInteractionTime, setFirstRunTime, setRunCount, setRunStatus, setCompileErrorCount, setPassed, setOutput]);

  const handleKeyDown = useCallback((e) => {
    // Tab inserts a tab character
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newValue = code.substring(0, start) + '\t' + code.substring(end);
      setCode(newValue);
      // move cursor
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 1;
      });
    }
    // Ctrl+Enter to run
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleRun();
    }
    // Ctrl+Shift+Enter to submit
    if (e.key === 'Enter' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [code, handleRun, handleSubmit]);

  const handleSubmit = useCallback(async () => {
    if (submitted || isSubmitting) return;
    setIsSubmitting(true);

    const responseTimeMs = firstRunTime ? Math.max(0, firstRunTime - startTime) : runCount * 1000;
    const attemptId = generateAttemptId();
    const validationTest = data?.validationTest || '';

    try {
      const resp = await submitSandboxSolution({ language, code, validationTest, widgetId: 'tactical-sandbox-v1', attemptId, pixelBotId: pixelBotIdProp || baseData.pixelBotId || '', topic: topicProp || baseData.topic || '' });
      const result = resp?.data || {};
      setOutput([`> Server submission result: ${result.passed ? 'passed' : 'failed'}`, result.executionMs ? `> executionMs: ${result.executionMs}` : null, result.stdout ? `STDOUT:\n${result.stdout}` : null, result.stderr ? `STDERR:\n${result.stderr}` : null].filter(Boolean).join('\n\n'));
      setPassed(Boolean(result.passed));
      setRunStatus(result.passed ? 'passed' : 'failed');

      // refresh attempts list
      try {
        const effectivePixelBotId = pixelBotIdProp || baseData.pixelBotId || '';
        const listResp = await getSandboxAttempts({ widgetId: 'tactical-sandbox-v1', pixelBotId: effectivePixelBotId });
        setAttempts(listResp?.data?.attempts || []);
      } catch {
        // ignore
      }

      // Mark submitted only after successful authoritative run
      setSubmitted(true);

      // Call parent onSubmit with server-validated telemetry marker
      onSubmit({
        code,
        isCorrect: Boolean(result.passed),
        telemetry: buildTelemetry({
          widgetId: 'tactical-sandbox-v1',
          version: 'v2',
          isCorrect: Boolean(result.passed),
          usedHint,
          executionMode: baseData.executionMode,
          answerData: {
            language,
            runCount,
            runStatus: result.passed ? 'passed' : 'failed',
            compileErrorCount,
            firstRunTime,
            firstInteractionTime,
            codeLength: code.length,
            responseTimeMs,
            validationTest: validationTest,
            validationLabel: data?.validationLabel || (data?.validationTest ? data.validationTest : 'Default Checks'),
            attemptId: result.attemptId || attemptId,
            serverValidated: true
          }
        })
      });
    } catch (err) {
      setRunStatus('error');
      setOutput(`Server error submitting solution: ${err?.message || String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [submitted, isSubmitting, usedHint, baseData, runCount, compileErrorCount, firstRunTime, firstInteractionTime, code, onSubmit, generateAttemptId, data, language, startTime, submitSandboxSolution, getSandboxAttempts, pixelBotIdProp, topicProp]);

  return (
    <div className="tactical-sandbox-widget card" style={{ backgroundColor: '#1E1E2E', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        .sandbox-btn {
          transition: all 0.2s ease;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
        }
        .sandbox-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .run-btn { background-color: rgba(99, 102, 241, 0.15); color: #818CF8; border: 1px solid #6366F1; padding: 0.4rem 1rem; }
        .run-btn:hover:not(:disabled) { background-color: rgba(99, 102, 241, 0.25); }
        .submit-btn { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 0.75rem; width: 100%; font-size: 1.05rem; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); }
        .submit-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
        .code-textarea::-webkit-scrollbar { width: 8px; }
        .code-textarea::-webkit-scrollbar-track { background: #0F0F1A; border-radius: 4px; }
        .code-textarea::-webkit-scrollbar-thumb { background: #43435C; border-radius: 4px; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(129,140,248,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>{baseData.tags.join(' • ')}</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: baseData.difficulty === 'Hard' ? '#EF4444' : '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(245,158,11,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>{baseData.difficulty === 'Easy' ? '🟢' : baseData.difficulty === 'Hard' ? '🔴' : '🟡'} {baseData.difficulty}</span>
      </div>

      <h3 className="widget-prompt" style={{ color: '#FFFFFF', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem' }}>{taskPrompt}</h3>

      <div className="editor-container" style={{ backgroundColor: '#0F0F1A', border: '1px solid #43435C', borderRadius: '0.75rem', overflow: 'hidden' }}>
        <div className="editor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #43435C', backgroundColor: '#181825' }}>
          <span style={{ color: '#94A3B8', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Language: {language}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button disabled={submitted || baseData.isHistorical} className="sandbox-btn run-btn" onClick={handleReset} style={{ borderColor: '#475569', color: '#94A3B8', padding: '0.4rem 0.75rem' }}>⟲ Reset</button>
            <button disabled={submitted || baseData.isHistorical} className="sandbox-btn run-btn" onClick={handleRun}>▶ Dry Run</button>
          </div>
        </div>
        <textarea
          value={code}
          onChange={(e) => {
            if (!firstInteractionTime) setFirstInteractionTime(Date.now());
            setCode(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          disabled={submitted || baseData.isHistorical}
          className="code-textarea"
          style={{ width: '100%', minHeight: '300px', backgroundColor: '#0F0F1A', color: '#A5B4FC', padding: '1rem', border: 'none', fontFamily: 'monospace', fontSize: '0.95rem', resize: 'vertical', outline: 'none' }}
          spellCheck={false}
        />
      </div>

      {baseData.hint && !submitted && !baseData.isHistorical && (
        <div style={{ margin: '1rem 0', textAlign: 'center' }}>
          {!usedHint ? (
            <button onClick={() => setUsedHint(true)} style={{ background: 'none', border: 'none', color: '#818CF8', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}>Need a hint?</button>
          ) : (
            <p style={{ color: '#94A3B8', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>💡 Hint: {baseData.hint}</p>
          )}
        </div>
      )}

      <div className="output-console" style={{ marginTop: '1.5rem', backgroundColor: '#000000', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #333', fontFamily: 'monospace', color: '#4ADE80', fontSize: '0.9rem', minHeight: '80px', whiteSpace: 'pre-wrap' }}>
        <div style={{ marginBottom: '0.5rem', color: '#94A3B8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Status: {runStatus}
        </div>
        {output || '// Terminal Output will appear here...'}
      </div>

      {attempts && attempts.length > 0 && (
        <div style={{ marginTop: '1rem', backgroundColor: '#0B1220', borderRadius: '0.5rem', padding: '0.75rem', color: '#94A3B8' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: '#C7D2FE' }}>Attempt History</div>
          {attempts.map((a) => (
            <div key={a.attemptId || a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: '0.85rem' }}>{new Date(a.savedAt).toLocaleString()}</div>
              <div style={{ fontSize: '0.85rem' }}>{a.serverPassed ? '✓ Passed' : '✗ Failed'}</div>
              <div style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>{a.executionMs ? `${a.executionMs}ms` : ''}</div>
            </div>
          ))}
        </div>
      )}

      {submitted && baseData.explanation && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: passed ? '#34D399' : '#F87171', fontWeight: 600 }}>{passed ? '✓ Validated' : '✗ Failed'}</p>
          <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.5 }}>{baseData.explanation}</p>
        </div>
      )}

      {!submitted && !baseData.isHistorical && (
        <button
          className="sandbox-btn submit-btn"
          onClick={handleSubmit}
          disabled={isSubmitting || runStatus === 'idle' || (runCount === 0 && !passed)}
          style={{ marginTop: '1.5rem' }}
        >
          {isSubmitting ? 'Submitting…' : 'Submit Solution'}
        </button>
      )}
      {baseData.isHistorical && <div style={{ marginTop: '1.5rem', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>Historical submission</div>}
    </div>
  );
};

export default TacticalSandboxWidget;
