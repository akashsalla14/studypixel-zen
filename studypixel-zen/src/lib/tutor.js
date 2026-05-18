const allowedWidgets = new Set([
  'mcq-v1',
  'mcq-reasoning-v1',
  'flashcard-v1',
  'fill-blank-v1',
  'matching-v1',
  'timeline-v1',
  'analogy-v1',
  'spaced-review-v1',
  'diagram-generator-v1',
  'signal-comparison-v1',
]);

export function parseLlmJson(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continue
    }
  }

  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let index = firstBrace; index < text.length; index += 1) {
      const character = text[index];
      if (escape) {
        escape = false;
        continue;
      }
      if (character === '\\' && inString) {
        escape = true;
        continue;
      }
      if (character === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (character === '{') depth += 1;
      if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(firstBrace, index + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }

  return null;
}

export function normalizeBaseData(data = {}, defaultTags = ['Practice']) {
  return {
    prompt: data.prompt || data.title || data.question || data.task || 'Please complete the exercise below.',
    hint: data.hint || data.clue || null,
    explanation: data.explanation || data.reasoning || data.feedback || null,
    difficulty: data.difficulty || data.level || 'Medium',
    tags: Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : defaultTags,
    executionMode: data.executionMode || 'REAL_STUDENT',
    isHistorical: data.isHistorical === true || data.readOnly === true,
    studentAnswer: data.studentAnswer || data.studentCode || data.studentMatches || data.studentOrder || data.answers || null,
    wasCorrect: data.wasCorrect ?? null,
  };
}

export function canonicalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function buildTelemetry({ widgetId, version, isCorrect, usedHint, answerData = {}, executionMode = 'REAL_STUDENT' }) {
  return {
    widgetId,
    widgetVersion: version,
    timestamp: Date.now(),
    isCorrect: !!isCorrect,
    usedHint: !!usedHint,
    interactionSource: executionMode,
    metrics: answerData,
  };
}

export function normalizeTutorResponse(raw, fallbackText = '') {
  const response = raw && typeof raw === 'object' ? raw : {};
  const action = response.action === 'USE_WIDGET' && allowedWidgets.has(response.widgetId) ? 'USE_WIDGET' : 'SPEAK';

  if (action === 'USE_WIDGET') {
    return {
      action,
      mentor_speech: typeof response.mentor_speech === 'string' ? response.mentor_speech : 'Let us use a widget for this step.',
      widgetId: response.widgetId,
      widgetData: response.widgetData && typeof response.widgetData === 'object' ? response.widgetData : {},
    };
  }

  return {
    action: 'SPEAK',
    mentor_speech: typeof response.mentor_speech === 'string'
      ? response.mentor_speech
      : typeof response.message === 'string'
        ? response.message
        : fallbackText || 'I am ready when you are.',
  };
}

export function buildTutorPrompt({ mode, message, context }) {
  const profileName = context?.profile?.name || 'Learner';
  const topic = context?.topic || 'general study';
  const summary = context?.sessionSummary ? `Session summary: ${context.sessionSummary}\n` : '';

  if (mode === 'repair') {
    return [
      'Repair malformed tutor JSON.',
      'Return exactly one JSON object.',
      'Allowed shapes:',
      '{"action":"SPEAK","mentor_speech":"..."}',
      '{"action":"USE_WIDGET","widgetId":"mcq-v1","widgetData":{}}',
      `Raw text: ${String(message || '').slice(0, 1200)}`,
    ].join('\n');
  }

  return [
    `You are StudyPixel Zen, a compact offline tutor for ${profileName}.`,
    `Topic: ${topic}.`,
    'Prefer one active model, sequential reasoning, and short outputs.',
    'Use widgets only when they materially help learning.',
    'Return strict JSON with one of these shapes only:',
    '{"action":"SPEAK","mentor_speech":"..."}',
    '{"action":"USE_WIDGET","widgetId":"mcq-v1","widgetData":{}}',
    'Unknown actions must become SPEAK.',
    summary,
    `Learner message: ${String(message || '').slice(0, 2000)}`,
  ].filter(Boolean).join('\n');
}
