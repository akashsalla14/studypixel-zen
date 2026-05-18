/**
 * @fileoverview The main interactive learning environment for a PixelBot.
 *
 * This component implements the dual-pane UI for adaptive tutoring:
 * - Left Pane: A real-time chat interface for conversation with the AI mentor.
 * - Right Pane: A dynamic "Learning Canvas" that renders interactive widgets
 *   based on the AI's pedagogical decisions.
 *
 * It orchestrates the entire learning loop:
 * 1. User sends a message.
 * 2. A request is made to the `evaluateWithCouncil` Cloud Function.
 * 3. The AI's JSON response is parsed.
 * 4. The chat history is updated with the mentor's speech.
 * 5. If the AI chose a widget, it is rendered on the canvas.
 */
'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase'; // Assuming firebase.js is in src/lib
import { saveChatMessage, getChatHistory } from '../../lib/dataService';

// Import widget components
import { MCQWidget } from './widgets/MCQWidget.js';
import { MCQReasoningWidget } from './widgets/MCQReasoningWidget.js';
import { SignalComparisonWidget } from './widgets/SignalComparisonWidget.js';
import { TacticalSandboxWidget } from './widgets/TacticalSandboxWidget.js';
import FlashcardWidget from './widgets/FlashcardWidget.js';
import { DiagramGeneratorWidget } from './widgets/DiagramGeneratorWidget.js';
import FillBlankWidget from './widgets/FillBlankWidget.js';
import MatchingWidget from './widgets/MatchingWidget.js';
import TimelineWidget from './widgets/TimelineWidget.js';
import SpacedReviewWidget from './widgets/SpacedReviewWidget.js';
import AnalogyWidget from './widgets/AnalogyWidget.js';
import ImageAnalysisWidget from './widgets/ImageAnalysisWidget.js';

const evaluateWithCouncil = httpsCallable(functions, 'evaluateWithCouncil');
const updateStudentProfile = httpsCallable(functions, 'updateStudentProfile');

function PixelBotWorkspace({ pixelBot, user, onBack }) {
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentWidget, setCurrentWidget] = useState(null);
  const [widgetState, setWidgetState] = useState({}); // To store transient widget data like selected option
  const [systemLogs, setSystemLogs] = useState([]);
  const [activeLeftTab, setActiveLeftTab] = useState('chat'); // 'chat' or 'logs'
  
  // Resize Splitter State
  const [leftWidth, setLeftWidth] = useState(50); // % width of the left pane
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const isDraggingRef = useRef(false);

  const widgetWrapRef = useRef(null);
  const inputAreaRef = useRef(null);

  const chatContainerRef = useRef(null);

  // Effect to load chat history on mount
  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      try {
        const history = await getChatHistory(user.uid, pixelBot.id);
        if (isMounted) {
          if (history && history.length > 0) {
            const parsedHistory = history.map(msg => {
              if (typeof msg.widgetData === 'string') {
                try {
                  msg.widgetData = JSON.parse(msg.widgetData);
                } catch {
                }
              }
              return msg;
            });
            setChatHistory(parsedHistory);
          } else {
            // Default welcome if no history exists
            const welcomeMessage = {
              role: 'assistant',
              content: `Hello! I am the ${pixelBot.name}. What would you like to learn about ${pixelBot.topic} today?`,
              timestamp: new Date().toISOString(),
            };
            setChatHistory([welcomeMessage]);
          }
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    };

    if (user && pixelBot) loadHistory();
    return () => { isMounted = false; };
  }, [pixelBot, user]);

  // Effect to scroll to the bottom of the chat on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Horizontal Pane Resizer Logic
  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    const newWidth = (e.clientX / window.innerWidth) * 100;
    if (newWidth > 20 && newWidth < 80) { // Constrain to prevent hiding panes
      setLeftWidth(newWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto'; // Re-enable text selection
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsChatCollapsed(false); // Cancel collapse mode if they decide to drag
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // Double-click to snap back to center
  const handleDoubleClick = useCallback(() => {
    setIsAnimating(true);
    setIsChatCollapsed(false);
    setLeftWidth(50);
    setTimeout(() => setIsAnimating(false), 300); // Allow time for CSS transition
  }, []);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Function to handle sending a message
  const handleSendMessage = async (content, role = 'user') => {
    if (!content.trim() || isLoading) return;

    const userMessage = { role, content, timestamp: new Date().toISOString() };

    // Update UI immediately for responsiveness
    setChatHistory(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);
    setCurrentWidget(null); // Clear canvas when user sends a new message
    setWidgetState({}); // Clear widget state

    // Persist user message
    await saveChatMessage(user.uid, pixelBot.id, userMessage);

    try {
      // Call the backend LLM council
      const result = await evaluateWithCouncil({
        prompt: content,
        chatHistory: chatHistory.slice(-10), // Send last 10 messages for context
        pixelBotId: pixelBot.id,
        context: {
          topic: pixelBot.topic,
          instructions: pixelBot.instructions,
          config: pixelBot.config // Pass config (strictness/frequency) to backend
        },
        // In a real app, you'd send more BKT data here
        correct: true, // Placeholder
      });

      const { individualResponses, synthesis: aiResponse, executionLogs } = result.data;

      // Add a system log entry to show the AI's "thought process"
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'LLM_EVAL',
        message: `Council evaluated user input. Consensus action: ${aiResponse.action}`,
        metadata: {
          councilResponses: individualResponses,
          synthesis: aiResponse,
        },
      };
      
      let newLogs = [logEntry];

      if (executionLogs && Array.isArray(executionLogs)) {
        const formattedBackendLogs = executionLogs.map(log => ({
          timestamp: log.timestamp,
          type: log.severity,
          message: log.jsonPayload?.message || "System Log",
          details: log.jsonPayload
        })).reverse();
        newLogs = [...newLogs, ...formattedBackendLogs];
      }

      setSystemLogs(prev => [...newLogs, ...prev]); // Prepend to show latest first

      // The AI response is a structured JSON object.
      // Build the message object defensively to avoid 'undefined' fields, which
      // are invalid in Firestore and cause the `saveChatMessage` function to fail.
      const mentorMessage = {
        role: 'assistant',
        content: aiResponse.mentor_speech, // Use the synthesized speech
        timestamp: new Date().toISOString(),
      };

      // Conditionally add optional fields only if they exist in the AI response.
      // This approach is flexible and future-proof. Any new data fields the AI
      // sends for future widgets (e.g., image URLs, flashcard data) will be
      // handled correctly as long as they are not undefined.
      if (aiResponse.action) mentorMessage.action = aiResponse.action;
      if (aiResponse.widgetId) mentorMessage.widgetId = aiResponse.widgetId;
      if (aiResponse.widgetData) mentorMessage.widgetData = aiResponse.widgetData;

      setChatHistory(prev => [...prev, mentorMessage]);
      
      const firestoreMessage = { ...mentorMessage };
      if (firestoreMessage.widgetData) {
        firestoreMessage.widgetData = JSON.stringify(firestoreMessage.widgetData);
      }
      await saveChatMessage(user.uid, pixelBot.id, firestoreMessage);

      // If the AI wants to use a widget, set it for the canvas
      if (aiResponse.action === 'USE_WIDGET') {
        setCurrentWidget({
          id: aiResponse.widgetId,
          data: aiResponse.widgetData,
        });
      }

      // Automatic Profile Update Trigger (Every 20 messages)
      // We check the total count including the message just sent.
      const currentCount = chatHistory.length + 1; 
      if (currentCount > 0 && currentCount % 20 === 0) {
        // Fire and forget - don't await to avoid blocking UI
        updateStudentProfile({ pixelBotId: pixelBot.id }).then(res => {
            // Optionally add a system log
            setSystemLogs(prev => [{
                timestamp: new Date().toISOString(),
                type: 'INFO',
                message: 'Automatic Profile Analysis completed.',
                details: res.data
            }, ...prev]);
        }).catch(err => console.error("Auto-profile update failed:", err));
      }
    } catch (error) {
      console.error("Error calling LLM council:", error);
      const errorMessage = {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Special handler for the chat input when specific widgets are active
  const handleChatSubmit = () => {
    // Check if we are in MCQ Reasoning mode
    if (currentWidget?.id === 'mcq-reasoning-v1') {
      if (!widgetState.selectedOption) {
        alert("Please select an option from the widget first.");
        return;
      }
      
      // Construct a special payload that includes the selection and the reasoning (userInput)
      const submissionContent = `Widget Response: ${JSON.stringify({
        selected: widgetState.selectedOption,
        reasoning: userInput
      })}`;
      
      handleSendMessage(submissionContent, 'user');
    } else {
      handleSendMessage(userInput);
    }
  };

  // This function is passed to widget2s so they can submit their results
  const handleWidgetSubmit = (submission) => {
    // Intercept direct conversational actions (like asking about a specific diagram node or signal)
    if (submission.action === "ask_about_node" || submission.action === "ask_about_signal") {
      handleSendMessage(submission.message, 'user');
      return;
    }

    // If the widget submission was already server-validated, persist locally
    // and avoid calling the LLM council again (prevents double-evaluation).
    if (submission.serverValidated) {
      const submissionContent = `Widget Response: ${JSON.stringify(submission)}`;
      const userMessage = { role: 'user', content: submissionContent, timestamp: new Date().toISOString() };
      // Update UI immediately and persist, but do NOT call evaluateWithCouncil
      setChatHistory(prev => [...prev, userMessage]);
      saveChatMessage(user.uid, pixelBot.id, userMessage).catch(err => console.error('Failed to save validated widget submission:', err));
      return;
    }

    // Default behavior: route through the normal send -> evaluateWithCouncil flow
    const submissionContent = `Widget Response: ${JSON.stringify(submission)}`;
    handleSendMessage(submissionContent, 'user');
  };

  // Spaced-review submit: "Mark Mastered" triggers updateStudentProfile directly
  // instead of routing to the AI council (no answer to evaluate).
  const handleSpacedReviewSubmit = async (submission) => {
    if (submission.action === 'mark_mastered' && pixelBot?.id) {
      try {
        await updateStudentProfile({ pixelBotId: pixelBot.id });
      } catch (e) {
        console.error('updateStudentProfile failed:', e);
      }
    }
    // Still log the action to chat so the instructor can respond.
    const submissionContent = `Widget Response: ${JSON.stringify(submission)}`;
    handleSendMessage(submissionContent, 'user');
  };

  // Render function for the widget to prevent unmounting on every keystroke
  const renderWidget = () => {
    if (isLoading) {
      return (
        <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '2rem', backgroundColor: '#1E1E2E', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.1)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="shimmer-anim" style={{ height: '24px', width: '20%', borderRadius: '4px' }} />
            <div className="shimmer-anim" style={{ height: '24px', width: '15%', borderRadius: '4px' }} />
          </div>
          <div className="shimmer-anim" style={{ height: '32px', width: '50%', margin: '0 auto', borderRadius: '6px' }} />
          <div className="shimmer-anim" style={{ height: '150px', width: '100%', borderRadius: '8px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="shimmer-anim" style={{ height: '48px', width: '100%', borderRadius: '8px' }} />
            <div className="shimmer-anim" style={{ height: '48px', width: '100%', borderRadius: '8px' }} />
          </div>
          <div className="shimmer-anim" style={{ height: '48px', width: '100%', borderRadius: '8px', marginTop: '1rem' }} />
        </div>
      );
    }

    if (!currentWidget) {
      return <div style={styles.emptyCanvas}><div style={styles.canvasIcon}>🎨</div>The Learning Canvas is ready.</div>;
    }

    switch (currentWidget.id) {
      case 'mcq-v1':
        return <MCQWidget data={currentWidget.data} onSubmit={handleWidgetSubmit} />;
      case 'mcq-reasoning-v1':
        return <MCQReasoningWidget data={currentWidget.data} onSubmit={handleWidgetSubmit} />;
      case 'signal-comparison-v1':
        return <SignalComparisonWidget data={currentWidget.data} onSubmit={handleWidgetSubmit} />;
      case 'tactical-sandbox-v1':
        return <TacticalSandboxWidget data={currentWidget.data} onSubmit={handleWidgetSubmit} pixelBotId={pixelBot?.id} topic={pixelBot?.topic} />;
      case 'flashcard-v1':
        return <FlashcardWidget data={currentWidget.data} onSubmit={handleWidgetSubmit} />;
      case 'diagram-generator-v1':
        return <DiagramGeneratorWidget data={currentWidget.data} onSubmit={handleWidgetSubmit} />;
      case 'fill-blank-v1':
        return <FillBlankWidget data={currentWidget.data} onSubmit={handleWidgetSubmit} />;
      case 'matching-v1':
        return <MatchingWidget data={currentWidget.data} onSubmit={handleWidgetSubmit} />;
      case 'timeline-v1':
        return <TimelineWidget data={currentWidget.data} onSubmit={handleWidgetSubmit} />;
      case 'spaced-review-v1':
        return <SpacedReviewWidget data={currentWidget.data} onSubmit={handleSpacedReviewSubmit} />;
      case 'analogy-v1':
        return <AnalogyWidget data={currentWidget.data} onSubmit={handleWidgetSubmit} />;
      case 'image-analysis-v1':
        return <ImageAnalysisWidget data={currentWidget.data} onSubmit={handleWidgetSubmit} />;
      default:
        return <div className="canvas-placeholder">Unknown widget: {currentWidget.id}</div>;
    }
  };

  // Renders a special card in the chat history for past widget interactions
  const renderChatMessage = (msg, index) => {
    const isUser = msg.role === 'user';

    // Refine how widget responses are displayed in chat history
    if (isUser && msg.content.startsWith('Widget Response:')) {
      try {
        const submission = JSON.parse(msg.content.substring('Widget Response: '.length));
        let selectionText = "Widget interaction";
        
        if (submission.selected !== undefined) selectionText = submission.selected;
        else if (submission.answer !== undefined) selectionText = submission.answer;
        else if (submission.code !== undefined) selectionText = "Submitted code solution";
        else if (submission.studentOrder !== undefined) selectionText = `Ordered items: [${submission.studentOrder.join(', ')}]`;
        else if (submission.matches !== undefined) selectionText = `Matched ${Object.keys(submission.matches).length} pairs`;
        else if (submission.answers !== undefined) selectionText = `Filled blanks: [${submission.answers.join(', ')}]`;
        else if (submission.action !== undefined) selectionText = `Action: ${submission.action}`;

        if (typeof selectionText === 'object') {
          selectionText = JSON.stringify(selectionText);
        }

        return (
          <div key={index} className="message-wrapper user">
            <div className="avatar user-avatar">
              <span>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
            </div>
            <div className="chat-bubble">
              {submission.reasoning ? (
                <p><strong>Selected: {selectionText}</strong><br/><br/>Reasoning: {submission.reasoning}</p>
              ) : (
                <p><em>You answered the widget. (Selected: {selectionText})</em></p>
              )}
            </div>
          </div>
        );
      } catch {
        return (
          <div key={index} className="message-wrapper user">
            <div className="avatar user-avatar">
              <span>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
            </div>
            <div className="chat-bubble">
              <p><em>Submitted widget response.</em></p>
            </div>
          </div>
        );
      }
    }

    // If the message was an AI call to use a widget, render a summary card
    if (msg.action === 'USE_WIDGET') {
      // Attempt to find the student's answer in the subsequent message
      let studentAnswerPayload = null;
      const nextMsg = chatHistory[index + 1];
      if (nextMsg && nextMsg.role === 'user' && nextMsg.content.startsWith('Widget Response:')) {
        try {
          studentAnswerPayload = JSON.parse(nextMsg.content.substring('Widget Response: '.length));
        } catch(e) {}
      }

      return (
        <div key={index} className="message-wrapper assistant">
          <div className="avatar assistant-avatar">AI</div>
          <div className="chat-bubble">
            <p>{msg.content}</p>
            <div className="widget-history-card">
              <p><strong>Widget Used:</strong> {msg.widgetId}</p>
              <p><strong>Prompt:</strong> {msg.widgetData?.prompt || 'Click below to review this exercise.'}</p>
              <button 
                style={{ marginTop: '10px', backgroundColor: '#007AFF', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                onClick={() => {
                  const historicData = { ...msg.widgetData, isHistorical: true };
                  
                  // Inject user's past answer to show what they selected
                  if (studentAnswerPayload) {
                    if (studentAnswerPayload.selected !== undefined) historicData.studentSelected = studentAnswerPayload.selected;
                    if (studentAnswerPayload.reasoning !== undefined) historicData.studentReasoning = studentAnswerPayload.reasoning;
                    if (studentAnswerPayload.code !== undefined) historicData.studentAnswer = studentAnswerPayload.code;
                    if (studentAnswerPayload.answers) historicData.studentAnswer = studentAnswerPayload.answers;
                    if (studentAnswerPayload.studentOrder) historicData.studentAnswer = studentAnswerPayload.studentOrder;
                    if (studentAnswerPayload.matches) historicData.studentAnswer = studentAnswerPayload.matches;
                    if (studentAnswerPayload.isCorrect !== undefined) historicData.wasCorrect = studentAnswerPayload.isCorrect;
                    if (studentAnswerPayload.answer !== undefined && !historicData.studentAnswer) historicData.studentAnswer = studentAnswerPayload.answer;
                  }

                  setCurrentWidget({ id: msg.widgetId, data: historicData });
                  
                  // Automatically expand the canvas if it's collapsed
                  if (isChatCollapsed) {
                    setIsAnimating(true);
                    setIsChatCollapsed(false);
                    setTimeout(() => setIsAnimating(false), 300);
                  }
                }}
              >
                View in Canvas
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Standard text message
    return (
      <div key={index} className={`message-wrapper ${isUser ? 'user' : 'assistant'}`}>
        <div className={`avatar ${isUser ? 'user-avatar' : 'assistant-avatar'}`}>
          <span>{isUser ? (user?.name ? user.name.charAt(0).toUpperCase() : 'U') : 'AI'}</span>
        </div>
        <div className="chat-bubble">
          <p>{msg.content}</p>
        </div>
      </div>
    );
  };

  // Determine input placeholder based on widget
  const inputPlaceholder = currentWidget ? "Respond or ask for help..." : "Type your message...";

  return (
    <div style={styles.app}>
      {/* Apple-Style Glass Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              style={styles.iconBtn} 
              onClick={() => {
                setIsAnimating(true);
                setIsChatCollapsed(prev => !prev);
                setTimeout(() => setIsAnimating(false), 300);
              }}
              title={isChatCollapsed ? "Show Chat Pane" : "Hide Chat Pane"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
            <span style={styles.logo}>StudyPixel <span style={styles.logoWeight}>{pixelBot.name}</span></span>
          </div>
          <button style={styles.appleBtn} onClick={onBack}>Back to Dashboard</button>
        </div>
      </header>

      {/* 50/50 Workspace */}
      <main style={styles.workspace}>
        {/* Left: Chatbot */}
        <section style={{ 
          ...styles.pane, 
          width: isChatCollapsed ? '0%' : `${leftWidth}%`, 
          flex: 'none',
          overflow: 'hidden',
          opacity: isChatCollapsed ? 0 : 1,
          transition: isAnimating ? 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease' : 'none'
        }}>
          <div style={{ ...styles.paneHeader, display: 'flex', gap: '20px', paddingBottom: '0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <button 
              style={{ ...styles.tabBtn, ...(activeLeftTab === 'chat' ? styles.activeTab : {}) }} 
              onClick={() => setActiveLeftTab('chat')}
            >
              AI INSTRUCTOR
            </button>
            <button 
              style={{ ...styles.tabBtn, ...(activeLeftTab === 'logs' ? styles.activeTab : {}) }} 
              onClick={() => setActiveLeftTab('logs')}
            >
              SYSTEM LOGS {systemLogs.length > 0 && <span style={styles.logBadge}>{systemLogs.length}</span>}
            </button>
          </div>
          
          {activeLeftTab === 'chat' ? (
            <>
              <div className="custom-scrollbar" style={styles.chatScroll} ref={chatContainerRef}>
                {chatHistory.map(renderChatMessage)}
                {isLoading && (
                  <div className="message-wrapper assistant">
                    <div className="avatar assistant-avatar">
                      <span>AI</span>
                    </div>
                    <div className="chat-bubble">
                      <div style={styles.typingContainer}>
                        <div style={styles.dot} className="dot-animate-1" />
                        <div style={styles.dot} className="dot-animate-2" />
                        <div style={styles.dot} className="dot-animate-3" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.inputArea} ref={inputAreaRef}>
                <div style={styles.inputWrapper}>
                  <input 
                    style={styles.input} 
                    placeholder={inputPlaceholder}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                    disabled={isLoading}
                  />
                  <button 
                    style={{...styles.sendBtn, opacity: (!userInput.trim() || isLoading) ? 0.5 : 1}} 
                    onClick={() => handleChatSubmit()}
                    disabled={!userInput.trim() || isLoading}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="custom-scrollbar" style={styles.logContentFull}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '16px' }}>
                {systemLogs.length > 0 && (
                  <button 
                    style={styles.terminalBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(JSON.stringify(systemLogs, null, 2));
                      alert("Full session logs copied!");
                    }}
                  >
                    Copy All Logs
                  </button>
                )}
              </div>
              {systemLogs.length === 0 ? (
                <div style={styles.logLine}>&gt; [SYSTEM] Ready. No events yet.</div>
              ) : (
                systemLogs.map((log, index) => (
                  <div key={index} style={styles.logLine}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ color: log.type === 'ERROR' ? '#F87171' : log.type === 'WARN' ? '#FBBF24' : '#A1A1A6' }}>
                        &gt; [{log.type || 'INFO'}] {log.message}
                      </span>
                    </div>
                    {(log.details || log.metadata) && (
                      <pre className="custom-scrollbar" style={styles.logJsonBlock}>
                        {JSON.stringify(log.details || log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* Resize Splitter */}
        <div 
          style={styles.splitter} 
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize, double-click to center"
        >
          <div style={styles.splitterGrip} />
        </div>

        {/* Right: Learning Canvas */}
        <section style={{ ...styles.canvasPane, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...styles.paneHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>LEARNING CANVAS</span>
            <button 
              onClick={() => {
                setIsAnimating(true);
                setIsChatCollapsed(prev => !prev);
                setTimeout(() => setIsAnimating(false), 300);
              }}
              style={styles.expandBtn}
              title={isChatCollapsed ? "Restore split view" : "Maximize canvas"}
            >
              {isChatCollapsed ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              )}
            </button>
          </div>
          <div style={styles.canvasBody}>
            <div ref={widgetWrapRef} style={{ width: '100%' }}>
              {renderWidget()}
            </div>
          </div>
        </section>
      </main>

      {/* Global Supremacy CSS */}
      <style>{`
        /* Dark Grey/Black Minimalist Scrollbar */
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2C2C2E; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #000000; }
        
        /* Thinking Dots Animation */
        @keyframes appleBlink { 0% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.3; transform: scale(1); } }
        .dot-animate-1 { animation: appleBlink 1.4s infinite 0s; }
        .dot-animate-2 { animation: appleBlink 1.4s infinite 0.2s; }
        .dot-animate-3 { animation: appleBlink 1.4s infinite 0.4s; }
        
        /* Shimmer Loading Skeleton */
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .shimmer-anim {
          animation: shimmer 2.5s infinite linear;
          background: linear-gradient(to right, #2A2A3A 4%, #3A3A4A 25%, #2A2A3A 36%);
          background-size: 1000px 100%;
        }
      `}</style>
    </div>
  );
}

const styles = {
  app: {
    height: "100vh",
    backgroundColor: "#FFFFFF",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  header: {
    height: "52px",
    padding: "0 24px",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
    display: "flex",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    backdropFilter: "blur(20px)",
    zIndex: 100
  },
  headerContent: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" },
  logo: { fontSize: "16px", fontWeight: "700", letterSpacing: "-0.02em", color: "#1D1D1F" },
  logoWeight: { fontWeight: "400", color: "#86868B" },
  iconBtn: { background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#1D1D1F", padding: "4px", borderRadius: "6px" },
  appleBtn: { backgroundColor: "#F2F2F7", border: "none", padding: "6px 14px", borderRadius: "12px", fontSize: "12px", fontWeight: "600", cursor: "pointer", color: "#1D1D1F" },
  expandBtn: { background: "transparent", border: "none", cursor: "pointer", color: "#86868B", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px", borderRadius: "4px", transition: "color 0.2s" },

  workspace: { flex: 1, display: "flex", overflow: "hidden" },
  pane: { flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#FFFFFF" },
  canvasPane: { flex: 1, display: "flex", flexDirection: "column", borderLeft: "1px solid #F2F2F7", backgroundColor: "#FBFBFD" },
  paneHeader: { padding: "16px 24px 0", fontSize: "11px", fontWeight: "700", color: "#86868B", letterSpacing: "0.08em" },
  tabBtn: { background: "transparent", border: "none", borderBottom: "2px solid transparent", cursor: "pointer", fontSize: "11px", fontWeight: "700", color: "#86868B", letterSpacing: "0.08em", padding: "0 4px 16px", transition: "all 0.2s" },
  activeTab: { color: "#1D1D1F", borderBottom: "2px solid #1D1D1F" },
  logBadge: { backgroundColor: "#007AFF", color: "#FFF", borderRadius: "10px", padding: "2px 6px", fontSize: "9px", marginLeft: "6px" },

  splitter: {
    width: "8px",
    backgroundColor: "#F2F2F7",
    cursor: "col-resize",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    borderLeft: "1px solid rgba(0,0,0,0.05)",
    borderRight: "1px solid rgba(0,0,0,0.05)",
  },
  splitterGrip: { width: "4px", height: "24px", backgroundColor: "#D2D2D7", borderRadius: "4px" },

  chatScroll: { flex: 1, padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" },
  msgRow: { display: "flex", width: "100%" },
  
  aiBubble: {
    maxWidth: "80%",
    padding: "14px 18px",
    backgroundColor: "#F2F2F7",
    color: "#1D1D1F",
    borderRadius: "20px",
    fontSize: "15px",
    lineHeight: "1.45",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)" // Subtle depth shadow
  },
  userBubble: {
    maxWidth: "80%",
    padding: "14px 18px",
    backgroundColor: "#007AFF", // Apple Primary Blue
    color: "#FFFFFF",
    borderRadius: "20px",
    fontSize: "15px",
    lineHeight: "1.45",
    /* The "Supremacy" Shadow: Soft blue diffusion */
    boxShadow: "0 10px 25px rgba(0, 122, 255, 0.3), 0 4px 10px rgba(0, 122, 255, 0.1)"
  },
  chatText: {
    /* Subtle text shadow for high-end legibility */
    textShadow: "0px 0.5px 1px rgba(0,0,0,0.1)"
  },

  typingContainer: { display: "flex", gap: "5px", padding: "5px 0" },
  dot: { width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#8E8E93" },

  inputArea: { padding: "24px" },
  inputWrapper: { display: "flex", alignItems: "center", backgroundColor: "#F2F2F7", borderRadius: "24px", padding: "4px 4px 4px 18px" },
  input: { flex: 1, border: "none", background: "transparent", height: "40px", fontSize: "15px", outline: "none", color: "#1D1D1F" },
  sendBtn: { backgroundColor: "#1D1D1F", border: "none", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },

  canvasBody: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: "24px" },
  emptyCanvas: { textAlign: "center", color: "#D2D2D7" },
  canvasIcon: { fontSize: "32px", marginBottom: "8px" },

  logContentFull: { flex: 1, padding: "20px 24px", fontFamily: "'SF Mono', Menlo, monospace", color: "#A1A1A6", fontSize: "12px", overflowY: "auto", backgroundColor: "#1C1C1E" },
  logLine: { padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  terminalBtn: { backgroundColor: '#2C2C2E', color: '#E2E8F0', border: '1px solid #43435C', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'SF Mono', Menlo, monospace" },
  logJsonBlock: { backgroundColor: '#000000', border: '1px solid #333', borderRadius: '6px', padding: '12px', marginTop: '10px', overflow: 'auto', color: '#A5B4FC', fontSize: '11px', maxHeight: '400px' }
};

export default PixelBotWorkspace;
