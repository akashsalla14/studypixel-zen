const DB_NAME = 'studypixel-zen-db';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const STORAGE_KEY = 'studypixel-zen-state-v2';
const SCHEMA_VERSION = 2;

const defaultState = {
  schemaVersion: SCHEMA_VERSION,
  profile: {
    name: 'Learner',
    topic: 'general study',
    createdAt: null,
  },
  settings: {
    model: 'qwen2.5:0.5b',
    modelTier: 'ultra-low',
    heavyWidgetsEnabled: true,
  },
  sessions: [],
  sessionArchive: [],
  reviewQueue: [],
  mastery: {},
  history: [],
  summaries: [],
  widgetSubmissions: [],
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function sanitizeState(candidate) {
  const parsed = candidate && typeof candidate === 'object' ? candidate : {};
  return {
    ...cloneDefaultState(),
    ...parsed,
    schemaVersion: SCHEMA_VERSION,
    profile: { ...defaultState.profile, ...(parsed.profile || {}) },
    settings: { ...defaultState.settings, ...(parsed.settings || {}) },
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    sessionArchive: Array.isArray(parsed.sessionArchive) ? parsed.sessionArchive : [],
    reviewQueue: Array.isArray(parsed.reviewQueue) ? parsed.reviewQueue : [],
    summaries: Array.isArray(parsed.summaries) ? parsed.summaries : [],
    widgetSubmissions: Array.isArray(parsed.widgetSubmissions) ? parsed.widgetSubmissions : [],
    mastery: parsed.mastery && typeof parsed.mastery === 'object' ? parsed.mastery : {},
    history: Array.isArray(parsed.history) ? parsed.history : [],
  };
}

function localGet() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function localSet(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeState(state)));
  } catch {
    // ignore local cache write failures
  }
}

function openDb() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => resolve(null);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function dbGetState() {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('main');
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      try {
        resolve(sanitizeState(request.result));
      } catch {
        resolve(null);
      }
    };
  });
}

async function dbSetState(state) {
  const db = await openDb();
  if (!db) return;

  await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(sanitizeState(state), 'main');
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export function getDefaultState() {
  return cloneDefaultState();
}

export function loadZenStateSnapshot() {
  return localGet() || cloneDefaultState();
}

export async function hydrateZenState() {
  const indexed = await dbGetState();
  if (indexed) {
    localSet(indexed);
    return indexed;
  }

  const cached = localGet();
  if (cached) {
    await dbSetState(cached);
    return cached;
  }

  return cloneDefaultState();
}

export async function persistZenState(state) {
  const safe = sanitizeState(state);
  localSet(safe);
  await dbSetState(safe);
}

export function exportZenBackup(state) {
  return JSON.stringify(sanitizeState(state), null, 2);
}

export function importZenBackup(text) {
  return sanitizeState(JSON.parse(text));
}

export async function resetZenState() {
  const next = cloneDefaultState();
  localSet(next);
  await dbSetState(next);
  return next;
}
