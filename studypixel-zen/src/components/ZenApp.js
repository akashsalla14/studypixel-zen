'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { exportZenBackup, importZenBackup, loadZenState, resetZenState, saveZenState } from '../lib/localStore';
import { normalizeTutorResponse } from '../lib/tutor';
import { widgetCatalog, widgetPolicy } from './externalWidgets';

const screens = {
  setup: 'setup',
  hub: 'hub',
  workspace: 'workspace',
  settings: 'settings',
  review: 'review',
};

const defaultSession = {
  id: 'session-1',
  title: 'New Study Session',
  topic: 'general study',
  messages: [],
  summary: '',
  widgetId: null,
};

function compactHistory(messages) {
  return messages.slice(-8);
}

function summarizeMessages(messages) {
  const recentUser = messages.filter((message) => message.role === 'user').slice(-3).map((item) => item.content).join(' | ');
  return recentUser || 'Session summarized for compact memory usage.';
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
  const [modeMessage, setModeMessage] = useState('Checking local model...');
  const [importText, setImportText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    saveZenState(state);
  }, [state]);

  useEffect(() => {
    const session = state.sessions[0] || defaultSession;
    setActiveSession(session);
  }, [state.sessions]);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const response = await fetch('/api/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'health' }),
        });
        const payload = await response.json();
        if (!cancelled) {
          setStatus(payload);
          setModeMessage(payload.running ? 'Local Ollama detected.' : 'Ollama not running.');
          setReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({ running: false, models: [], error: error?.message || 'Local model unavailable' });
          setModeMessage('Ollama not running.');
          setReady(true);
        }
      }
    };

    probe();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentModel = state.settings.model;
  const memoryPressure = activeSession.messages.length > 24 ? 'High' : activeSession.messages.length > 12 ? 'Medium' : 'Low';

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
    if (messages.length <= 12) return messages;
    const summary = summarizeMessages(messages.slice(0, -8));
    setState((previous) => ({
      ...previous,
      summaries: [summary, ...previous.summaries].slice(0, 10),
    }));
    setActiveSession((previous) => ({
      ...previous,
      summary,
    }));
    return [{ role: 'assistant', content: `Older turns summarized: ${summary}`, timestamp: new Date().toISOString() }, ...messages.slice(-8)];
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
          sessionSummary: activeSession.summary,
        }),
      });

      const payload = await response.json();
      const normalized = normalizeTutorResponse(payload.output, '');
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
      setScreen(screens.hub);
      setImportText('');
    } catch {
      setModeMessage('Backup import failed.');
    }
  };

  const resetProfile = () => {
    const next = resetZenState();
    setState(next);
    setActiveSession(defaultSession);
    setScreen(screens.setup);
  };

  const widgetNode = activeWidget ? (() => {
    const Widget = widgetCatalog[activeWidget.id];
    if (!Widget) {
      return <div className="zen-card">Unknown widget: {activeWidget.id}</div>;
    }
    if (!widgetPolicy.enabled.includes(activeWidget.id)) {
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
          grid-template-columns: repeat(4, 1fr);
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
            <div className="zen-card">
              <h2 style={{ marginTop: 0 }}>Launch check</h2>
              <p>Local model: {status.running ? 'Running' : 'Offline'}</p>
              <p>Detected models: {status.models?.length || 0}</p>
              <p>Profile: {state.profile.name}</p>
              <div className="zen-row">
                <button className="zen-btn active" onClick={() => setScreen(screens.hub)}>Open Study Hub</button>
                <button className="zen-btn" onClick={() => openSession(state.profile.topic || 'general study')}>Create Study Session</button>
              </div>
            </div>
          </div>
        )}

        {screen === screens.hub && (
          <div className="zen-pane">
            <div className="zen-row" style={{ marginBottom: 16 }}>
              <button className="zen-btn active" onClick={() => openSession(state.profile.topic || 'general study')}>Resume Study</button>
              <button className="zen-btn" onClick={() => openSession('flashcard review')}>Flashcards</button>
              <button className="zen-btn" onClick={() => openSession('mcq practice')}>MCQ Practice</button>
              <button className="zen-btn" onClick={() => openSession('spaced review')}>Spaced Review</button>
            </div>

            <div className="zen-card">
              <h3 style={{ marginTop: 0 }}>Current focus</h3>
              <p>{state.profile.topic}</p>
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
          <div className="zen-stat">Offline state: local-first</div>
          <div className="zen-stat">Memory pressure: {memoryPressure}</div>
          <div className="zen-stat">Mastery state: {Object.keys(state.mastery).length || 0} tracked topics</div>
        </div>
      </div>
    </div>
  );
}
