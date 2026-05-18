import { asArray, canonicalizeLoose, normalizeBaseData } from '../normalization/widgetNormalization';
import { requiredWidgets, optionalWidgets } from '../widgets/widgetPolicy';

const allWidgets = new Set([...requiredWidgets, ...optionalWidgets]);
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function parseLlmJson(text) {
  if (!text || typeof text !== 'string') return null;

  try {
    return JSON.parse(text);
  } catch {
    // try next strategy
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
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
    let escaped = false;

    for (let index = firstBrace; index < text.length; index += 1) {
      const ch = text[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (!inString && ch === '{') depth += 1;
      if (!inString && ch === '}') {
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

function sanitizeMcq(data) {
  const base = normalizeBaseData(data, ['MCQ']);
  const rawOptions = data.options || data.choices || data.answers;
  const entries = Array.isArray(rawOptions)
    ? rawOptions.map((value, index) => [letters[index], value])
    : rawOptions && typeof rawOptions === 'object'
      ? Object.entries(rawOptions)
      : [];
  const normalized = {};
  const seen = new Set();

  entries.slice(0, 8).forEach(([key, value], index) => {
    const optionKey = String(key || letters[index]).trim().toUpperCase().slice(0, 2) || letters[index];
    const text = typeof value === 'object'
      ? String(value?.label || value?.text || value?.value || '').trim()
      : String(value || '').trim();
    const dedupeKey = text.toLowerCase();
    if (!text || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    normalized[optionKey] = text;
  });

  let correctAnswer = String(data.correctAnswer || data.answer || data.correct || '').trim();
  const optionKeys = Object.keys(normalized);
  if (correctAnswer && !normalized[correctAnswer]) {
    const foundKey = optionKeys.find((key) => canonicalizeLoose(normalized[key]) === canonicalizeLoose(correctAnswer));
    correctAnswer = foundKey || correctAnswer;
  }

  if (optionKeys.length < 2 || !correctAnswer || !normalized[correctAnswer]) return null;

  return {
    ...base,
    options: normalized,
    correctAnswer,
    requiresReasoning: data.requiresReasoning === true,
    reasoningPrompt: data.reasoningPrompt || data.reasonPrompt || null,
  };
}

function sanitizeFillBlank(data) {
  const base = normalizeBaseData(data, ['Fill Blank']);
  const sentence = data.sentence || data.text || data.prompt || base.prompt;
  const inferredBlankCount = Math.max(0, String(sentence).split(/\[BLANK\]|_{3,}/i).length - 1);
  const blanks = Array.isArray(data.blanks) ? data.blanks : Array(inferredBlankCount).fill('[BLANK]');
  const rawAnswers = data.correctAnswers || data.answers || data.answer;
  const answers = Array.isArray(rawAnswers) ? rawAnswers : asArray(rawAnswers);

  if (blanks.length === 0 || answers.length === 0) return null;

  return {
    ...base,
    sentence,
    blanks: blanks.slice(0, 6),
    correctAnswers: answers
      .map((value) => asArray(value).length > 0 ? asArray(value) : [String(value || '')])
      .map((group) => group.map((item) => String(item || '').trim()).filter(Boolean))
      .filter((group) => group.length > 0),
  };
}

function sanitizeMatching(data) {
  const base = normalizeBaseData(data, ['Matching']);
  const pairs = Array.isArray(data.pairs) ? data.pairs : [];
  const cleaned = pairs
    .map((item) => ({
      term: String(item.term || item.left || item.prompt || '').trim(),
      definition: String(item.definition || item.right || item.match || item.answer || '').trim(),
    }))
    .filter((item) => item.term && item.definition)
    .slice(0, 8);

  const seen = new Set();
  const deduped = cleaned.filter((pair) => {
    const key = `${canonicalizeLoose(pair.term)}::${canonicalizeLoose(pair.definition)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduped.length < 2) return null;
  return { ...base, pairs: deduped };
}

function sanitizeTimeline(data) {
  const base = normalizeBaseData(data, ['Timeline']);
  const events = (Array.isArray(data.events) ? data.events : Array.isArray(data.steps) ? data.steps : [])
    .map((item) => typeof item === 'string' ? item.trim() : String(item.label || item.event || item.text || '').trim())
    .filter(Boolean)
    .slice(0, 7);

  if (events.length < 2) return null;
  const correctOrder = Array.isArray(data.correctOrder) && data.correctOrder.length === events.length
    ? data.correctOrder.map((value) => Number(value)).filter((value) => Number.isInteger(value))
    : events.map((_, index) => index);

  return { ...base, events, correctOrder: correctOrder.length === events.length ? correctOrder : events.map((_, index) => index) };
}

function sanitizeDiagram(data) {
  const base = normalizeBaseData(data, ['Diagram']);
  const nodes = (Array.isArray(data.nodes) ? data.nodes : []).slice(0, 12);
  const edges = (Array.isArray(data.edges) ? data.edges : []).slice(0, 20);

  if (nodes.length < 2) return null;
  return { ...base, nodes, edges };
}

function sanitizeAnalogy(data) {
  const base = normalizeBaseData(data, ['Analogy']);
  const acceptableAnswers = asArray(data.acceptableAnswers || data.answers || data.options || data.answer || data.correctAnswer)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const correctAnswer = String(data.correctAnswer || data.answer || acceptableAnswers[0] || '').trim();
  if (!correctAnswer) return null;
  return {
    ...base,
    prompt: data.prompt || base.prompt,
    termA: data.termA || data.A || '?',
    termB: data.termB || data.B || '?',
    termC: data.termC || data.C || '?',
    correctAnswer,
    acceptableAnswers,
  };
}

function sanitizeSpacedReview(data) {
  const base = normalizeBaseData(data, ['Spaced Review']);
  const rawTopics = Array.isArray(data.topics) ? data.topics : Array.isArray(data.queue) ? data.queue : [];
  const topics = rawTopics
    .map((item) => ({
      name: String(item?.name || item?.topic || item?.prompt || '').trim(),
      masteryScore: Number.isFinite(item?.masteryScore) ? item.masteryScore : Number.isFinite(item?.mastery) ? item.mastery : 0,
      daysSinceReview: Number.isFinite(item?.daysSinceReview) ? Math.max(0, item.daysSinceReview) : 0,
      retentionPct: Number.isFinite(item?.retentionPct) ? Math.max(0, Math.min(100, item.retentionPct)) : 50,
      nextDueDate: item?.nextDueDate || null,
    }))
    .filter((item) => item.name)
    .slice(0, 10);

  return {
    ...base,
    topics,
    dueCount: Number.isFinite(data.dueCount) ? data.dueCount : topics.length,
    staleTimestamp: data.staleTimestamp || null,
  };
}

function sanitizeWidgetData(widgetId, widgetData) {
  const data = widgetData && typeof widgetData === 'object' ? widgetData : {};

  switch (widgetId) {
    case 'mcq-v1':
    case 'mcq-reasoning-v1':
      return sanitizeMcq(data);
    case 'fill-blank-v1':
      return sanitizeFillBlank(data);
    case 'matching-v1':
      return sanitizeMatching(data);
    case 'timeline-v1':
      return sanitizeTimeline(data);
    case 'diagram-generator-v1':
      return sanitizeDiagram(data);
    case 'analogy-v1':
      return sanitizeAnalogy(data);
    case 'spaced-review-v1':
      return sanitizeSpacedReview(data);
    default:
      return normalizeBaseData(data);
  }
}

export function normalizeTutorResponse(raw, fallbackText = '', enabledWidgets = requiredWidgets) {
  const response = raw && typeof raw === 'object' ? raw : {};
  const enabled = new Set(enabledWidgets);
  const action = response.action === 'USE_WIDGET' ? 'USE_WIDGET' : 'SPEAK';

  if (action === 'USE_WIDGET') {
    const widgetId = String(response.widgetId || '').trim();
    if (!allWidgets.has(widgetId) || !enabled.has(widgetId)) {
      return {
        action: 'SPEAK',
        mentor_speech: 'I will continue with plain tutoring for now so the session stays stable.',
      };
    }

    const safeData = sanitizeWidgetData(widgetId, response.widgetData);
    if (!safeData) {
      return {
        action: 'SPEAK',
        mentor_speech: 'That exercise payload was incomplete. I will explain this step directly and retry a cleaner widget next turn.',
      };
    }

    return {
      action: 'USE_WIDGET',
      mentor_speech: typeof response.mentor_speech === 'string' ? response.mentor_speech : 'Let us use a widget for this step.',
      widgetId,
      widgetData: safeData,
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

export function buildTutorPrompt({ message, context, enabledWidgets }) {
  const profileName = context?.profile?.name || 'Learner';
  const topic = context?.topic || 'general study';
  const summary = context?.sessionSummary ? `Session summary: ${context.sessionSummary}` : 'Session summary: none';
  const widgets = (enabledWidgets || requiredWidgets).join(', ');

  return [
    `You are StudyPixel Zen, a private offline tutor for ${profileName}.`,
    'Hardware is limited (4GB VRAM, 8GB RAM). Keep outputs compact and deterministic.',
    `Current topic: ${topic}.`,
    summary,
    `Enabled widgets: ${widgets}`,
    'Return only strict JSON in exactly one shape:',
    '{"action":"SPEAK","mentor_speech":"..."}',
    '{"action":"USE_WIDGET","widgetId":"mcq-v1","widgetData":{}}',
    'If unsure, use SPEAK. Never output markdown.',
    `Learner message: ${String(message || '').slice(0, 1800)}`,
  ].join('\n');
}

export function buildRepairPrompt(rawText) {
  return [
    'Repair malformed tutor output into strict JSON.',
    'Return exactly one JSON object and nothing else.',
    'Allowed output only:',
    '{"action":"SPEAK","mentor_speech":"..."}',
    '{"action":"USE_WIDGET","widgetId":"mcq-v1","widgetData":{}}',
    `Raw text: ${String(rawText || '').slice(0, 1500)}`,
  ].join('\n');
}
