'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { exportZenBackup, hydrateZenState, importZenBackup, loadZenState, resetZenState, saveZenState } from '../lib/localStore';
import { buildTelemetry } from '../lib/tutor';
import { compactHistory, inferMemoryPressure, summarizeMessages, trimMessagesWithSummary } from '../session/sessionManager';
import { deriveRuntimeState } from '../ui/runtimeState';
import { getEnabledWidgets } from '../widgets/widgetPolicy';
import { getEnabledWidgetIds, widgetCatalog } from './externalWidgets';

const screens = {
  setup: 'setup',
  hub: 'hub',
  workspace: 'workspace',
  settings: 'settings',
  review: 'review',
};

const preferredModelOrder = ['qwen2.5:0.5b', 'llama3.2:1b', 'phi3:mini', 'phi3.5:mini'];

const setupSeedPacks = {
  beginner: {
    label: 'Beginner Starter',
    topic: 'study skills and foundational learning',
    review: [
      { prompt: 'Recall one thing you learned yesterday in your own words.', topic: 'memory' },
      { prompt: 'Explain a concept using a real-life analogy.', topic: 'understanding' },
    ],
  },
  researcher: {
    label: 'AI Research Starter',
    topic: 'ai research methods and reproducibility',
    review: [
      { prompt: 'Summarize one paper objective in two lines.', topic: 'paper reading' },
      { prompt: 'List one threat to validity and one mitigation.', topic: 'critical analysis' },
      { prompt: 'Draft one experiment hypothesis with measurable metric.', topic: 'experiment design' },
    ],
  },
  security: {
    label: 'Security Practice Starter',
    topic: 'secure coding and threat modeling',
    review: [
      { prompt: 'Identify one trust boundary in your system.', topic: 'threat modeling' },
      { prompt: 'Name one likely misuse case and mitigation.', topic: 'secure design' },
    ],
  },
};

const defaultSession = {
  id: 'session-1',
  title: 'New Study Session',
  topic: 'general study',
  messages: [],
  summary: '',
  widgetId: null,
};

function detectHeapPressure() {
  const perf = globalThis?.performance;
  const heap = perf?.memory;
  if (!heap || !heap.jsHeapSizeLimit) return null;

  const ratio = heap.usedJSHeapSize / heap.jsHeapSizeLimit;
  if (ratio > 0.82) return 'High';
  if (ratio > 0.62) return 'Medium';
  return 'Low';
}

function mergePressure(messagePressure, heapPressure) {
  const rank = { Low: 1, Medium: 2, High: 3 };
  return rank[heapPressure || 'Low'] > rank[messagePressure || 'Low'] ? heapPressure : messagePressure;
}

export default function ZenApp() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState(screens.setup);
  const [state, setState] = useState(() => loadZenState());
  const [activeSession, setActiveSession] = useState(defaultSession);
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState({ running: false, models: [], error: '' });
  const [busy, setBusy] = useState(false);
  const [activeWidget, setActiveWidget] = useState(null);
  const [modeMessage, setModeMessage] = useState('Starting local runtime checks...');
  const [importText, setImportText] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [setupTestMessage, setSetupTestMessage] = useState('');
  const [seedPack, setSeedPack] = useState('beginner');
  const [seedTopic, setSeedTopic] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    saveZenState(state).catch(() => {
      setModeMessage('Storage degraded to in-memory mode. Export backup soon.');
    });
  }, [state]);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const hydrated = await hydrateZenState().catch(() => null);
      if (!mounted || !hydrated) return;
      setState(hydrated);
      setReady(true);
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const session = state.sessions[0] || defaultSession;
    setActiveSession(session);
  }, [state.sessions]);

  const probeRuntime = async () => {
    setRecovering(true);
    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'health' }),
      });
      const payload = await response.json();
      setStatus(payload);

      const names = (payload.models || []).map((item) => item.name || item.model || '').filter(Boolean);
      if (!payload.running) {
        setModeMessage('Ollama offline. Falling back to plain tutoring mode.');
      } else if (!names.includes(state.settings.model)) {
        setModeMessage(`Selected model missing. Available: ${names.join(', ') || 'none'}`);
      } else {
        setModeMessage('Local tutor ready.');
      }
    } catch (error) {
      setStatus({ running: false, models: [], error: error?.message || 'Local model unavailable' });
      setModeMessage('Runtime probe failed. Offline fallback active.');
    } finally {
      setRecovering(false);
      setReady(true);
    }
  };

  useEffect(() => {
    probeRuntime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentModel = state.settings.model;
  const memoryPressure = mergePressure(inferMemoryPressure(activeSession.messages), detectHeapPressure());
  const enabledWidgets = getEnabledWidgets({
    heavyWidgetsEnabled: state.settings.heavyWidgetsEnabled,
    memoryPressure,
  });
  const runtimeState = deriveRuntimeState({
    running: status.running,
    models: status.models,
    selectedModel: currentModel,
    error: status.error,
    recovering,
  });

  const orderedModels = useMemo(() => {
    const discovered = (status.models || [])
      .map((item) => item.name || item.model || '')
      .filter(Boolean);

    const merged = [...new Set([...preferredModelOrder, ...discovered])];
    const discoveredSet = new Set(discovered);

    return merged.map((name) => ({
      name,
      available: discoveredSet.has(name),
      preferred: preferredModelOrder.includes(name),
    }));
  }, [status.models]);

  const visibleMessages = useMemo(() => compactHistory(activeSession.messages), [activeSession.messages]);

  const openSession = (topic) => {
    const nextSession = {
      ...defaultSession,
      id: `session-${Date.now()}`,
      title: topic || 'New Study Session',
      topic: topic || state.profile.topic || 'general study',
    };

    setState((previous) => ({
      ...previous,
      sessions: [nextSession, ...previous.sessions.slice(0, 19)],
    }));
    setActiveSession(nextSession);
    setScreen(screens.workspace);
  };

  const updateSession = (patch) => {
    setState((previous) => {
      const sessions = previous.sessions.length > 0 ? previous.sessions : [defaultSession];
      const updated = sessions.map((session) => (session.id === activeSession.id ? { ...session, ...patch } : session));
      const normalized = updated.length > 0 ? updated : [{ ...activeSession, ...patch }];
      return { ...previous, sessions: normalized };
    });
    setActiveSession((previous) => ({ ...previous, ...patch }));
  };

  const trimIfNeeded = (messages) => {
    const trimmed = trimMessagesWithSummary(messages, memoryPressure === 'High' ? 6 : 8);
    if (!trimmed.trimmed) return trimmed.messages;

    setState((previous) => ({
      ...previous,
      summaries: [trimmed.summary, ...previous.summaries].slice(0, 20),
    }));
    setActiveSession((previous) => ({
      ...previous,
      summary: trimmed.summary,
    }));
    return trimmed.messages;
  };

  const sendTurn = async (messageText) => {
    if (!messageText.trim() || busy) return;

    const userMessage = { role: 'user', content: messageText.trim(), timestamp: new Date().toISOString() };
    const nextMessages = [...activeSession.messages, userMessage];
    updateSession({ messages: nextMessages });
    setUserInput('');
    setBusy(true);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'turn',
          message: userMessage.content,
          history: compactHistory(nextMessages),
          profile: state.profile,
          topic: activeSession.topic,
          model: currentModel,
          settings: state.settings,
          memoryPressure,
          sessionSummary: activeSession.summary,
        }),
      });

      const payload = await response.json();
      if (payload.failureState) {
        setModeMessage(`Tutor degraded: ${payload.failureState}`);
      }
      const normalized = payload.output;
      const assistantMessage = {
        role: 'assistant',
        content: normalized.mentor_speech,
        action: normalized.action,
        widgetId: normalized.widgetId,
        widgetData: normalized.widgetData,
        timestamp: new Date().toISOString(),
      };

      const withAssistant = trimIfNeeded([...nextMessages, assistantMessage]);
      updateSession({ messages: withAssistant, widgetId: normalized.widgetId || null });
      setActiveWidget(normalized.action === 'USE_WIDGET' ? { id: normalized.widgetId, data: normalized.widgetData } : null);
    } catch (error) {
      const fallback = {
        role: 'assistant',
        content: 'The local tutor is unavailable right now. Ollama may not be running, the model may be missing, or the system may be under memory pressure.',
        timestamp: new Date().toISOString(),
      };
      updateSession({ messages: [...nextMessages, fallback] });
    } finally {
      setBusy(false);
    }
  };

  const handleWidgetSubmit = (submission) => {
    const topic = activeSession.topic || state.profile.topic || 'general study';
    const isCorrect = submission?.isCorrect === true;

    setState((previous) => {
      const mastery = previous.mastery?.[topic] || { attempts: 0, correct: 0, streak: 0, updatedAt: null };
      const nextMastery = {
        attempts: mastery.attempts + 1,
        correct: mastery.correct + (isCorrect ? 1 : 0),
        streak: isCorrect ? mastery.streak + 1 : 0,
        updatedAt: new Date().toISOString(),
      };

      const telemetry = buildTelemetry({
        widgetId: activeWidget?.id || 'unknown-widget',
        isCorrect,
        usedHint: submission?.usedHint === true,
        answerData: { keys: Object.keys(submission || {}).slice(0, 10) },
      });

      const reviewQueue = isCorrect
        ? previous.reviewQueue
        : [{ prompt: submission?.prompt || 'Review this concept', topic, timestamp: Date.now() }, ...previous.reviewQueue].slice(0, 80);

      return {
        ...previous,
        mastery: {
          ...previous.mastery,
          [topic]: nextMastery,
        },
        widgetSubmissions: [{ submission, telemetry, timestamp: Date.now() }, ...(previous.widgetSubmissions || [])].slice(0, 200),
        reviewQueue,
      };
    });

    const wrapped = `Widget Response: ${JSON.stringify(submission)}`;
    sendTurn(wrapped);
  };

  const summarizeSession = () => {
    const summary = summarizeMessages(activeSession.messages);
    updateSession({
      summary,
      messages: trimIfNeeded(activeSession.messages),
    });
  };

  const exportBackup = () => {
    const blob = new Blob([exportZenBackup(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'studypixel-zen-backup.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = () => {
    try {
      const imported = importZenBackup(importText);
      setState(imported);
      saveZenState(imported).catch(() => null);
      setScreen(screens.hub);
      setImportText('');
    } catch {
      setModeMessage('Backup import failed.');
    }
  };

  const resetProfile = async () => {
    const next = await resetZenState();
    setState(next);
    setActiveSession(defaultSession);
    setScreen(screens.setup);
  };

  const runSetupTest = async () => {
    setSetupTestMessage('Testing selected model...');
    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'turn',
          message: 'Give me one short study tip.',
          history: [],
          profile: state.profile,
          topic: state.profile.topic,
          model: state.settings.model,
          settings: state.settings,
        }),
      });
      const payload = await response.json();
      setSetupTestMessage(payload.ok ? 'Model test succeeded.' : `Model test degraded: ${payload.failureState || 'fallback mode'}`);
    } catch {
      setSetupTestMessage('Model test failed. Offline fallback remains active.');
    }
  };

  const applySeedPack = () => {
    const pack = setupSeedPacks[seedPack] || setupSeedPacks.beginner;
    const nextTopic = seedTopic.trim() || pack.topic;

    setState((previous) => ({
      ...previous,
      profile: {
        ...previous.profile,
        topic: nextTopic,
      },
      reviewQueue: [
        ...pack.review.map((item) => ({ ...item, timestamp: Date.now() })),
        ...previous.reviewQueue,
      ].slice(0, 80),
    }));

    setSetupTestMessage(`Seed applied: ${pack.label}. Topic set to "${nextTopic}".`);
  };

  const widgetNode = activeWidget ? (() => {
    const Widget = widgetCatalog[activeWidget.id];
    if (!Widget) {
      return <div className="zen-card">Unknown widget: {activeWidget.id}</div>;
    }
    const activeEnabledWidgets = getEnabledWidgetIds({
      heavyWidgetsEnabled: state.settings.heavyWidgetsEnabled,
      memoryPressure,
    });

    if (!activeEnabledWidgets.includes(activeWidget.id)) {
      return <div className="zen-card">This widget is disabled in the offline starter profile.</div>;
    }
    return <Widget data={activeWidget.data} onSubmit={handleWidgetSubmit} />;
  })() : (
    <div className="zen-card zen-empty">The canvas is ready for the next exercise.</div>
  );

  if (!ready) {
    return <div className="zen-shell zen-loading">Loading StudyPixel Zen...</div>;
  }

  return (
    <div className="zen-shell">
      <style>{`
        :root {
          color-scheme: dark;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          background:
            radial-gradient(circle at top left, rgba(99,102,241,0.28), transparent 28%),
            radial-gradient(circle at top right, rgba(16,185,129,0.18), transparent 24%),
            linear-gradient(180deg, #081018 0%, #050816 100%);
          color: #E5EEF8;
        }
        .zen-shell {
          min-height: 100vh;
          padding: 20px;
        }
        .zen-loading {
          display: grid;
          place-items: center;
          font-size: 1.1rem;
          color: #B9C6D8;
        }
        .zen-frame {
          max-width: 1440px;
          margin: 0 auto;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          background: rgba(10, 14, 24, 0.82);
          backdrop-filter: blur(22px);
          box-shadow: 0 24px 70px rgba(0,0,0,0.35);
          overflow: hidden;
        }
        .zen-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .zen-brand {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .zen-brand strong {
          font-size: 1.1rem;
          letter-spacing: 0.02em;
        }
        .zen-brand span {
          font-size: 0.85rem;
          color: #9AA9BE;
        }
        .zen-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .zen-btn {
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: #E5EEF8;
          border-radius: 999px;
          padding: 10px 14px;
          cursor: pointer;
        }
        .zen-btn.active {
          background: linear-gradient(135deg, rgba(99,102,241,0.95), rgba(16,185,129,0.85));
          border-color: transparent;
        }
        .zen-grid {
          display: grid;
          grid-template-columns: minmax(320px, 1fr) minmax(420px, 1.35fr);
          gap: 1px;
          background: rgba(255,255,255,0.06);
        }
        .zen-pane {
          min-height: 68vh;
          background: rgba(10, 14, 24, 0.92);
          padding: 20px;
        }
        .zen-scroll {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 54vh;
          overflow: auto;
          padding-right: 6px;
        }
        .zen-card {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          border-radius: 18px;
          padding: 16px;
        }
        .zen-empty {
          min-height: 420px;
          display: grid;
          place-items: center;
          color: #9AA9BE;
        }
        .zen-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .zen-input, .zen-textarea {
          width: 100%;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(8,12,18,0.9);
          color: #E5EEF8;
          padding: 12px 14px;
        }
        .zen-textarea {
          min-height: 88px;
          resize: vertical;
        }
        .zen-footer {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.06);
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .zen-stat {
          background: rgba(10, 14, 24, 0.94);
          padding: 14px 16px;
          color: #B9C6D8;
          font-size: 0.92rem;
        }
        .zen-message {
          border-radius: 16px;
          padding: 12px 14px;
          line-height: 1.55;
        }
        .zen-message.user {
          background: rgba(99,102,241,0.18);
          border: 1px solid rgba(99,102,241,0.28);
        }
        .zen-message.assistant {
          background: rgba(16,185,129,0.10);
          border: 1px solid rgba(16,185,129,0.20);
        }
        .zen-kbd {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.82rem;
          color: #9AA9BE;
        }
        .zen-kbd b {
          color: #E5EEF8;
        }
      `}</style>

      <div className="zen-frame">
        <div className="zen-topbar">
          <div className="zen-brand">
            <strong>StudyPixel Zen</strong>
            <span>{modeMessage}</span>
          </div>

          <div className="zen-nav">
            <button className={`zen-btn ${screen === screens.setup ? 'active' : ''}`} onClick={() => setScreen(screens.setup)}>Setup</button>
            <button className={`zen-btn ${screen === screens.hub ? 'active' : ''}`} onClick={() => setScreen(screens.hub)}>Study Hub</button>
            <button className={`zen-btn ${screen === screens.workspace ? 'active' : ''}`} onClick={() => setScreen(screens.workspace)}>Workspace</button>
            <button className={`zen-btn ${screen === screens.review ? 'active' : ''}`} onClick={() => setScreen(screens.review)}>Review Queue</button>
            <button className={`zen-btn ${screen === screens.settings ? 'active' : ''}`} onClick={() => setScreen(screens.settings)}>Settings</button>
          </div>
        </div>

        {screen === screens.setup && (
          <div className="zen-pane">
            <div className="zen-card" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>Launch check</h2>
              <p>Runtime state: {runtimeState}</p>
              <p>Local model: {status.running ? 'Running' : 'Offline'}</p>
              <p>Detected models: {status.models?.length || 0}</p>
              <p>Selected model: {state.settings.model}</p>
              <p>Profile: {state.profile.name}</p>
              <div className="zen-row">
                <button className="zen-btn" onClick={probeRuntime}>Recheck runtime</button>
                <button className="zen-btn" onClick={runSetupTest}>Test model</button>
                <button className="zen-btn active" onClick={() => setScreen(screens.hub)}>Open Study Hub</button>
                <button className="zen-btn" onClick={() => openSession(state.profile.topic || 'general study')}>Create Study Session</button>
              </div>
              {setupTestMessage ? <p>{setupTestMessage}</p> : null}
            </div>

            <div className="zen-card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Model selection (recommended order)</h3>
              <select
                className="zen-input"
                value={state.settings.model}
                onChange={(event) => setState((previous) => ({ ...previous, settings: { ...previous.settings, model: event.target.value } }))}
              >
                {orderedModels.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}{item.preferred ? ' (recommended)' : ''}{item.available ? '' : ' (not installed)'}
                  </option>
                ))}
              </select>
              <p style={{ color: '#9AA9BE' }}>Recommended: qwen2.5:0.5b for weakest hardware, phi3.5:mini for higher quality.</p>
            </div>

            <div className="zen-card">
              <h3 style={{ marginTop: 0 }}>Profile and topic seeding wizard</h3>
              <div className="zen-row" style={{ marginBottom: 10 }}>
                <input
                  className="zen-input"
                  value={state.profile.name}
                  onChange={(event) => setState((previous) => ({ ...previous, profile: { ...previous.profile, name: event.target.value } }))}
                  placeholder="Learner name"
                />
                <select className="zen-input" value={seedPack} onChange={(event) => setSeedPack(event.target.value)}>
                  {Object.entries(setupSeedPacks).map(([key, pack]) => <option key={key} value={key}>{pack.label}</option>)}
                </select>
                <input
                  className="zen-input"
                  value={seedTopic}
                  onChange={(event) => setSeedTopic(event.target.value)}
                  placeholder="Optional custom topic override"
                />
              </div>
              <div className="zen-row">
                <button className="zen-btn" onClick={applySeedPack}>Apply Seed</button>
                <button className="zen-btn active" onClick={() => openSession((seedTopic || state.profile.topic || '').trim() || 'general study')}>Start Seeded Session</button>
              </div>
            </div>
          </div>
        )}

        {screen === screens.hub && (
          <div className="zen-pane">
            <div className="zen-row" style={{ marginBottom: 16 }}>
              <button className="zen-btn active" onClick={() => openSession(state.profile.topic || 'general study')}>Continue Learning</button>
              <button className="zen-btn" onClick={() => setScreen(screens.workspace)}>Resume Session</button>
              <button className="zen-btn" onClick={() => openSession('review due')}>Review Due</button>
              <button className="zen-btn" onClick={() => openSession('new topic practice')}>Start New Topic</button>
              <button className="zen-btn" onClick={() => openSession('flashcard review')}>Flashcards</button>
            </div>

            <div className="zen-card">
              <h3 style={{ marginTop: 0 }}>Current focus</h3>
              <p>{state.profile.topic}</p>
              <p>Session health: {activeSession.messages.length > 0 ? 'active' : 'idle'}</p>
              <p>Model health: {status.running ? 'online' : 'offline fallback'}</p>
              <p>Model tier: {state.settings.modelTier}</p>
              <p>Memory pressure: {memoryPressure}</p>
              <p>Review items: {state.reviewQueue.length}</p>
            </div>
          </div>
        )}

        {screen === screens.workspace && (
          <div className="zen-grid">
            <div className="zen-pane" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="zen-card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginTop: 0 }}>Mentor conversation</h3>
                <div className="zen-scroll" style={{ marginBottom: 16 }}>
                  {visibleMessages.length === 0 ? (
                    <div className="zen-message assistant">Ask a question to begin. The tutor will keep outputs compact and fall back safely when JSON is malformed.</div>
                  ) : visibleMessages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`zen-message ${message.role === 'user' ? 'user' : 'assistant'}`}>
                      {message.content}
                    </div>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  className="zen-textarea"
                  placeholder="Type a question, answer, or widget response..."
                  value={userInput}
                  onChange={(event) => setUserInput(event.target.value)}
                />

                <div className="zen-row" style={{ marginTop: 12 }}>
                  <button className="zen-btn active" onClick={() => sendTurn(userInput)} disabled={busy}>Send</button>
                  <button className="zen-btn" onClick={summarizeSession}>Summarize</button>
                  <button className="zen-btn" onClick={() => updateSession({ messages: trimIfNeeded(activeSession.messages) })}>Trim Memory</button>
                </div>
              </div>

              <div className="zen-card">
                <h3 style={{ marginTop: 0 }}>Session state</h3>
                <p>{activeSession.summary || 'No summary yet.'}</p>
                <p className="zen-kbd"><b>Widgets</b> {enabledWidgets.length} enabled</p>
                <p className="zen-kbd"><b>Model</b> {currentModel}</p>
                <p className="zen-kbd"><b>Offline</b> {status.running ? 'Connected to local Ollama' : 'Using fallback mode'}</p>
              </div>
            </div>

            <div className="zen-pane">
              <div className="zen-card">
                <h3 style={{ marginTop: 0 }}>Widget / Canvas</h3>
                {widgetNode}
              </div>
            </div>
          </div>
        )}

        {screen === screens.review && (
          <div className="zen-pane">
            <div className="zen-card">
              <h3 style={{ marginTop: 0 }}>Review queue</h3>
              {state.reviewQueue.length === 0 ? <p>No queued review items yet.</p> : state.reviewQueue.map((item, index) => <div key={index} className="zen-message assistant">{typeof item === 'string' ? item : item.prompt || 'Review item'}</div>)}
            </div>
          </div>
        )}

        {screen === screens.settings && (
          <div className="zen-pane">
            <div className="zen-card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Profile</h3>
              <input
                className="zen-input"
                value={state.profile.name}
                onChange={(event) => setState((previous) => ({ ...previous, profile: { ...previous.profile, name: event.target.value } }))}
                placeholder="Your name"
              />
              <div style={{ height: 12 }} />
              <input
                className="zen-input"
                value={state.profile.topic}
                onChange={(event) => setState((previous) => ({ ...previous, profile: { ...previous.profile, topic: event.target.value } }))}
                placeholder="Study topic"
              />
            </div>

            <div className="zen-card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Local model</h3>
              <input
                className="zen-input"
                value={state.settings.model}
                onChange={(event) => setState((previous) => ({ ...previous, settings: { ...previous.settings, model: event.target.value } }))}
                placeholder="qwen2.5:0.5b"
              />
              <div style={{ height: 12 }} />
              <input
                className="zen-input"
                value={state.settings.modelTier}
                onChange={(event) => setState((previous) => ({ ...previous, settings: { ...previous.settings, modelTier: event.target.value } }))}
                placeholder="ultra-low"
              />
              <div style={{ height: 12 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={state.settings.heavyWidgetsEnabled}
                  onChange={(event) => setState((previous) => ({ ...previous, settings: { ...previous.settings, heavyWidgetsEnabled: event.target.checked } }))}
                />
                Enable optional heavy widgets when memory allows
              </label>
            </div>

            <div className="zen-card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Backup</h3>
              <div className="zen-row" style={{ marginBottom: 12 }}>
                <button className="zen-btn active" onClick={exportBackup}>Export backup</button>
                <button className="zen-btn" onClick={resetProfile}>Reset profile</button>
              </div>
              <textarea className="zen-textarea" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Paste a backup JSON file here" />
              <div style={{ height: 12 }} />
              <button className="zen-btn active" onClick={importBackup}>Import backup</button>
            </div>
          </div>
        )}

        <div className="zen-footer">
          <div className="zen-stat">Model health: {status.running ? 'online' : 'offline'}</div>
          <div className="zen-stat">Runtime state: {runtimeState}</div>
          <div className="zen-stat">Offline state: local-first</div>
          <div className="zen-stat">Memory pressure: {memoryPressure}</div>
          <div className="zen-stat">Session state: {busy ? 'processing' : 'idle'}</div>
          <div className="zen-stat">Mastery state: {Object.keys(state.mastery).length || 0} tracked topics</div>
        </div>
      </div>
    </div>
  );
}
