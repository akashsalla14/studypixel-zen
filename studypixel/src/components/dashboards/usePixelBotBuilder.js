/**
 * @fileoverview Custom hook for managing the conversational PixelBot builder state.
 *
 * What: Encapsulates the logic for the multi-step conversational form used to create PixelBots.
 *
 * Why: This logic was duplicated in both TeacherDashboard and StudentDashboard. Extracting it
 *      to a hook follows the DRY (Don't Repeat Yourself) principle, centralizes the builder's
 *      functionality, and makes it independently testable.
 *
 * How: It manages the chat messages, input, and step counter for the builder conversation.
 *      It returns the state and handler functions for the UI components to use.
 */

"use strict";

import { useState } from 'react';
import { createPixelBot } from '@/lib/dataService';

export function usePixelBotBuilder(user, builderQuestions, onCreationSuccess) {
  const [messages, setMessages] = useState([
    { role: "ai", text: builderQuestions[0] }
  ]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    let currentInput = input.trim();
    if (!currentInput) return;

    // [NEW] Input Validation & Normalization
    // Maps step index (0-based) to valid options
    const optionMap = {
      1: ["Beginner", "Intermediate", "Advanced"],
      2: ["Visual", "Auditory", "Kinesthetic", "Mixed"],
      3: ["Lenient", "Moderate", "Strict"],
      4: ["Rarely", "Sometimes", "Often"]
    };

    if (optionMap[step]) {
      const validOption = optionMap[step].find(opt => opt.toLowerCase() === currentInput.toLowerCase());
      if (!validOption) {
        // For now, we just don't advance. In a real UI, show a toast/error.
        return; 
      }
      currentInput = validOption; // Use the canonical casing
    }

    const newMessages = [...messages, { role: "user", text: currentInput }];
    const nextStep = step + 1;

    if (nextStep < builderQuestions.length) {
      newMessages.push({ role: "ai", text: builderQuestions[nextStep] });
      setStep(nextStep);
    } else {
      newMessages.push({ role: "ai", text: "Perfect! I have all the information needed. Click the 'Generate' button when you're ready!" });
      setIsComplete(true);
    }

    setMessages(newMessages);
    setInput("");
  };

  const handleGenerate = async (getPixelBotData) => {
    if (!isComplete) return;

    setIsGenerating(true);
    setError('');

    try {
      const userResponses = messages.filter(msg => msg.role === 'user').map(msg => msg.text);
      const pixelbotData = getPixelBotData(userResponses, user);
      
      await createPixelBot(pixelbotData);

      // Reset state and notify parent
      setMessages([{ role: "ai", text: builderQuestions[0] }]);
      setInput("");
      setStep(0);
      setIsComplete(false);
      if (onCreationSuccess) {
        onCreationSuccess();
      }
    } catch (err) {
      setError('Failed to create PixelBot. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setMessages([{ role: "ai", text: builderQuestions[0] }]);
    setInput("");
    setStep(0);
    setIsComplete(false);
    setIsGenerating(false);
    setError('');
  };

  return {
    builderState: { messages, input, isComplete, isGenerating, error },
    setInput,
    handleSubmit,
    handleGenerate,
    reset,
  };
}