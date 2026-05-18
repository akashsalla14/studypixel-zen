import React, { useMemo, useState } from 'react';
import { buildTelemetry, normalizeBaseData } from './widgetNormalizer';

function evaluateLocally(language, code, validationTest) {
  const text = String(code || '').trim();
  if (text.length < 3) {
    return {
      passed: false,
      status: 'too-short',
      output: 'Code is too short for evaluation.',
    };
  }

  const checks = [];
  if (language === 'python') checks.push(text.includes('def ') || text.includes('print('));
  if (language === 'javascript') checks.push(text.includes('function ') || text.includes('=>') || text.includes('console.log('));
  if (language === 'bash') checks.push(text.includes('echo ') || text.includes('#!/bin/bash'));
  if (language === 'java') checks.push(text.includes('class ') || text.includes('public static void main'));

  const hasValidationHint = validationTest ? text.toLowerCase().includes(String(validationTest).toLowerCase().slice(0, 24)) : true;
  const hasStructure = checks.length === 0 ? true : checks.some(Boolean);
  const passed = hasStructure && hasValidationHint;

  return {
    passed,
    status: passed ? 'passed' : 'retry',
    output: passed
      ? 'Local static evaluation passed. You can submit this solution.'
      : 'Local static evaluation suggests improvements are needed. Review the task prompt and try again.',
  };
}

export const TacticalSandboxWidget = ({ data, onSubmit }) => {
  const baseData = normalizeBaseData(data, ['Coding', 'Sandbox']);
  const taskPrompt = data?.taskPrompt || data?.task || data?.scenario || baseData.prompt || 'Write your code below.';
  const language = String(data?.language || data?.environment || 'plaintext').toLowerCase();
  const initialCode = data?.initialCode || data?.code || '';
  const validationTest = data?.validationTest || '';

  const [code, setCode] = useState(baseData.studentAnswer || initialCode);
  const [output, setOutput] = useState('');
  const [runCount, setRunCount] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [status, setStatus] = useState('idle');

  const languageLabel = useMemo(() => language || 'plaintext', [language]);

  const runLocalEvaluation = () => {
    setRunCount((count) => count + 1);
    const result = evaluateLocally(languageLabel, code, validationTest);
    setStatus(result.status);
    setOutput(result.output);
  };

  const submit = () => {
    const result = evaluateLocally(languageLabel, code, validationTest);
    setStatus(result.status);
    setOutput(result.output);

    onSubmit({
      code,
      isCorrect: result.passed,
      prompt: taskPrompt,
      telemetry: buildTelemetry({
        widgetId: 'tactical-sandbox-v1',
        version: 'local-v1',
        isCorrect: result.passed,
        usedHint,
        executionMode: baseData.executionMode,
        answerData: {
          language: languageLabel,
          runCount,
          status: result.status,
          codeLength: code.length,
          mode: 'local-static-eval',
        },
      }),
    });
  };

  return (
    <div className="zen-card" style={{ width: '100%' }}>
      <h4 style={{ marginTop: 0 }}>Tactical Sandbox (Local)</h4>
      <p>{taskPrompt}</p>
      <p style={{ color: '#9AA9BE' }}>Language: {languageLabel}</p>

      <textarea
        value={code}
        onChange={(event) => setCode(event.target.value)}
        style={{
          width: '100%',
          minHeight: 220,
          borderRadius: 10,
          padding: 12,
          background: '#0e1520',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#E5EEF8',
          fontFamily: 'Consolas, Menlo, monospace',
        }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="zen-btn" onClick={runLocalEvaluation}>Run Local Check</button>
        <button className="zen-btn active" onClick={submit}>Submit</button>
        <button className="zen-btn" onClick={() => setUsedHint((value) => !value)}>{usedHint ? 'Hint Used' : 'Mark Hint Used'}</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Status:</strong> {status}
        {output ? <p style={{ marginBottom: 0 }}>{output}</p> : null}
      </div>
    </div>
  );
};
