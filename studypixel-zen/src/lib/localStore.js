const STORAGE_KEY = 'studypixel-zen-state-v1';

const defaultState = {
  profile: {
    name: 'Learner',
    topic: 'general study',
  },
  settings: {
    model: 'qwen2.5:0.5b',
    modelTier: 'ultra-low',
    heavyWidgetsEnabled: false,
  },
  sessions: [],
  reviewQueue: [],
  mastery: {},
  summaries: [],
};

export function loadZenState() {
  if (typeof window === 'undefined') {
    return structuredClone(defaultState);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      profile: { ...defaultState.profile, ...(parsed.profile || {}) },
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      mastery: parsed.mastery || {},
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      reviewQueue: Array.isArray(parsed.reviewQueue) ? parsed.reviewQueue : [],
      summaries: Array.isArray(parsed.summaries) ? parsed.summaries : [],
    };
  } catch {
    return structuredClone(defaultState);
  }
}

export function saveZenState(state) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportZenBackup(state) {
  return JSON.stringify(state, null, 2);
}

export function importZenBackup(text) {
  const parsed = JSON.parse(text);
  return {
    ...structuredClone(defaultState),
    ...parsed,
    profile: { ...defaultState.profile, ...(parsed.profile || {}) },
    settings: { ...defaultState.settings, ...(parsed.settings || {}) },
  };
}

export function resetZenState() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return structuredClone(defaultState);
}
