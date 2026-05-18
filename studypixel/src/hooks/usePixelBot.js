/**
 * @fileoverview Custom React hook for PixelBot Workspace state management
 * 
 * This hook encapsulates all state and logic for the PixelBot learning workspace,
 * including:
 * - Chat conversation management
 * - Learning canvas mode switching
 * - MCQ assessment state
 * - System logs tracking
 * - LLM Council integration
 * - Command processing pipeline
 * 
 * Why use a custom hook:
 * - Separates complex workspace logic from UI rendering
 * - Makes workspace state reusable (could power mobile app, etc.)
 * - Easier to test workspace functionality independently
 * - Clean component code (just UI, no business logic)
 * - Easy to extend with new features (voice input, collaborative mode, etc.)
 * 
 * Dependencies:
 * - useBKT hook for mastery tracking
 * - LLM Council service for evaluation
 * - Data service for persistence
 * 
 * How to use:
 * ```javascript
 * function PixelBotWorkspace({ pixelBot, user }) {
 *   const workspace = usePixelBot(pixelBot, user);
 *   
 *   return (
 *     <div>
 *       <ChatPane 
 *         history={workspace.chatHistory}
 *         onSend={workspace.sendMessage}
 *       />
 *       <LearningCanvas 
 *         mode={workspace.canvasMode}
 *         onModeChange={workspace.setCanvasMode}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

"use strict";

// React hooks available globally from React CDN
import { useState, useCallback, useMemo } from 'react';
import { config } from '@/lib/constants';
import { updateKnowledge } from '@/lib/bktEngine';
import { mockMCQQuestions } from '@/lib/mockData';
import { sendToGemini, sendToChatGPT, sendToClaude, synthesizeCouncilResponse } from '@/lib/llmCouncil';
import { saveStudentProgress as saveToFirebase } from '@/lib/dataService';


/**
 * Custom hook for PixelBot Workspace management
 * 
 * Manages all aspects of the PixelBot learning experience including chat,
 * assessment, and mastery tracking. Integrates with BKT engine and LLM Council.
 * 
 * @param {Object} pixelBot - PixelBot configuration
 * @param {number} pixelBot.id - PixelBot ID
 * @param {string} pixelBot.name - PixelBot display name
 * @param {string} pixelBot.topic - Subject area
 * @param {Object} user - Current user
 * @param {number} user.id - User ID
 * @param {string} user.email - User email
 * 
 * @returns {Object} Workspace state and methods
 * @property {Array<Object>} chatHistory - Conversation messages
 * @property {Array<Object>} systemLogs - System event logs
 * @property {string} command - Current input text
 * @property {Function} setCommand - Update input text
 * @property {Function} sendMessage - Process and send message
 * @property {boolean} isLoading - Whether processing is in progress
 * @property {string} canvasMode - Current canvas mode (assessment/practice/drill/revision)
 * @property {Function} setCanvasMode - Change canvas mode
 * @property {Object} mcqState - MCQ assessment state
 * @property {Function} submitMCQAnswer - Submit MCQ answer
 * @property {Function} nextQuestion - Navigate to next MCQ
 * @property {Function} previousQuestion - Navigate to previous MCQ
 * @property {number} mastery - Current mastery level (from useBKT)
 * @property {Array<number>} masterySeries - Mastery history (from useBKT)
 * 
 * @example
 * const workspace = usePixelBot(
 *   { id: 2, name: "Networking Basics", topic: "Computer Science" },
 *   { id: 3, email: "student@studypixel.com" }
 * );
 * 
 * // Send a message
 * workspace.setCommand("TCP uses three-way handshake");
 * await workspace.sendMessage();
 * 
 * // Check mastery progress
 * console.log(workspace.mastery); // 0.72
 */
function usePixelBot(pixelBot, user) {
  // BKT state management (delegated to useBKT hook)
  // Note: This would use the useBKT hook in the actual implementation
  const [mastery, setMastery] = useState(config.bkt.initialKnowledge);
  const [masterySeries, setMasterySeries] = useState([config.bkt.initialKnowledge]);
  
  // Chat state
  const [chatHistory, setChatHistory] = useState([
    { 
      role: "ai", 
      content: `Welcome to ${pixelBot.name}! I'm your adaptive tutor. Let's start with an initial assessment to understand your current knowledge level.` 
    }
  ]);
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // System logs for debugging and transparency
  const [systemLogs, setSystemLogs] = useState([
    { 
      timestamp: new Date().toISOString(), 
      message: "Workspace initialized", 
      type: "info" 
    }
  ]);
  
  // Learning canvas mode
  const [canvasMode, setCanvasMode] = useState("assessment");
  
  // MCQ assessment state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [mcqReasoning, setMcqReasoning] = useState("");
  const [totalQuestions] = useState(5);
  
  /**
   * Get relevant MCQ questions based on PixelBot topic
   * 
   * Filters question bank to match current subject area.
   * Falls back to cycling through all questions if no exact matches.
   * 
   * Memoized to avoid recalculating on every render.
   */
  const relevantMCQs = useMemo(() => {
    const filtered = mockMCQQuestions.filter(q => 
      q.subject === pixelBot.name || q.subject === pixelBot.topic
    );
    return filtered.length > 0 
      ? filtered.slice(0, totalQuestions)
      : mockMCQQuestions.slice(0, totalQuestions);
  }, [pixelBot, totalQuestions]);
  
  /**
   * Current MCQ question being displayed
   */
  const currentMCQ = relevantMCQs[currentQuestionIndex] || 
    mockMCQQuestions[currentQuestionIndex % mockMCQQuestions.length];
  
  /**
   * Submits MCQ answer and updates mastery
   * 
   * Process:
   * 1. Validate answer selection
   * 2. Add answer to chat history
   * 3. Check correctness
   * 4. Generate AI feedback
   * 5. Update mastery using BKT
   * 6. Reset for next question
   * 
   * @returns {boolean} Whether answer was correct
   */
  const submitMCQAnswer = useCallback(() => {
    if (!selectedAnswer) {
      return false;
    }
    
    // Add user's answer to chat
    setChatHistory(prev => [...prev, { 
      role: "user", 
      content: `MCQ Answer: ${selectedAnswer}${mcqReasoning ? `\nReasoning: ${mcqReasoning}` : ''}` 
    }]);
    
    // Check correctness
    const isCorrect = selectedAnswer === currentMCQ.correctAnswer;
    
    // Generate feedback
    const feedback = isCorrect 
      ? "✅ Excellent! Your answer is correct and your reasoning shows good understanding." 
      : `❌ Not quite. The correct answer is ${currentMCQ.correctAnswer}. Let's review why...`;
    
    setChatHistory(prev => [...prev, { 
      role: "ai", 
      content: feedback
    }]);
    
    // Update mastery with BKT
    const nextMastery = updateKnowledge({ prior: mastery, correct: isCorrect });
    setMastery(nextMastery);
    setMasterySeries(prev => [...prev, nextMastery]);
    
    // Add system log
    setSystemLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      message: `MCQ ${isCorrect ? 'correct' : 'incorrect'}: Mastery ${(mastery * 100).toFixed(1)}% → ${(nextMastery * 100).toFixed(1)}%`,
      type: isCorrect ? "success" : "info"
    }]);
    
    // Reset for next question
    setSelectedAnswer("");
    setMcqReasoning("");
    
    return isCorrect;
  }, [selectedAnswer, mcqReasoning, currentMCQ, mastery]);
  
  /**
   * Navigate to next question
   */
  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }, [currentQuestionIndex, totalQuestions]);
  
  /**
   * Navigate to previous question
   */
  const previousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  }, [currentQuestionIndex]);
  
  /**
   * Processes and sends message through LLM Council
   * 
   * Main interaction pipeline:
   * 1. Validate input
   * 2. Add message to chat history
   * 3. Simulate correctness based on reasoning quality
   * 4. Query Multi-LLM Council for evaluation
   * 5. Update mastery with BKT
   * 6. Generate AI response
   * 7. Log system events
   * 8. Persist to backend
   * 
   * @returns {Promise<boolean>} Whether processing succeeded
   */
  const sendMessage = useCallback(async () => {
    if (!command.trim()) {
      return false;
    }

    setIsLoading(true);
    
    try {
      // Add user message to chat
      setChatHistory(prev => [...prev, { role: "user", content: command }]);
      
      // Simulate correctness based on reasoning quality
      // In production, LLM would actually evaluate the reasoning
      const hasMinimumLength = command.length >= config.simulation.minReasoningLength;
      const hasReasoningKeyword = config.simulation.reasoningKeywords.some(
        keyword => command.toLowerCase().includes(keyword)
      );
      const simulatedCorrect = hasMinimumLength && hasReasoningKeyword;
      
      // Multi-LLM Council evaluation (parallel queries)
      const [geminiResp, chatgptResp, claudeResp] = await Promise.all([
        sendToGemini({ command, correct: simulatedCorrect, mastery }),
        sendToChatGPT({ command, correct: simulatedCorrect, mastery }),
        sendToClaude({ command, correct: simulatedCorrect, mastery })
      ]);
      
      // Synthesize council responses
      const councilResponse = await synthesizeCouncilResponse([
        geminiResp, 
        chatgptResp, 
        claudeResp
      ]);
      
      // Update mastery with BKT
      const nextMastery = updateKnowledge({ prior: mastery, correct: simulatedCorrect });
      setMastery(nextMastery);
      setMasterySeries(prev => [...prev, nextMastery]);
      
      // Add AI response to chat
      setChatHistory(prev => [...prev, { 
        role: "ai", 
        content: councilResponse.synthesizedFeedback + "\n\n" + geminiResp.feedback 
      }]);
      
      // Add system log
      setSystemLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        message: `Mastery updated: ${(mastery * 100).toFixed(2)}% → ${(nextMastery * 100).toFixed(2)}%`,
        type: "update"
      }]);
      
      // Persist to backend
      await saveToFirebase({
        user: user.email,
        pixelBot: pixelBot.name,
        interaction: command,
        mastery: nextMastery,
        councilResponse
      });
      
      // Clear input
      setCommand("");
      
      return true;
      
    } catch (error) {
      console.error("Error processing message:", error);
      setSystemLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        message: "Error processing interaction",
        type: "error"
      }]);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [command, mastery, pixelBot, user]);
  
  // Return workspace state and methods
  return {
    // Chat state
    chatHistory,
    command,
    setCommand,
    sendMessage,
    isLoading,
    
    // Canvas state
    canvasMode,
    setCanvasMode,
    
    // MCQ state
    mcqState: {
      currentQuestion: currentMCQ,
      currentIndex: currentQuestionIndex,
      totalQuestions,
      selectedAnswer,
      reasoning: mcqReasoning,
      setSelectedAnswer,
      setReasoning: setMcqReasoning
    },
    submitMCQAnswer,
    nextQuestion,
    previousQuestion,
    
    // BKT state
    mastery,
    masterySeries,
    
    // System state
    systemLogs
  };
}

