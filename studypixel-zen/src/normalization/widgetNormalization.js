export function normalizeBaseData(data = {}, defaultTags = ['Practice']) {
  return {
    prompt: data.prompt || data.title || data.question || data.task || 'Please complete the exercise below.',
    hint: data.hint || data.clue || null,
    explanation: data.explanation || data.reasoning || data.feedback || null,
    difficulty: data.difficulty || data.level || 'Medium',
    tags: Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : defaultTags,
    executionMode: data.executionMode || 'REAL_STUDENT',
    isHistorical: data.isHistorical === true || data.readOnly === true,
  };
}

export function canonicalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export function canonicalizeLoose(value) {
  return canonicalize(value)
    .replace(/\b(a|an|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}
