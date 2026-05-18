const OLLAMA_COMPLETION_URL = 'http://localhost:11434/v1/chat/completions';
const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags';

export async function listLocalModels() {
  try {
    const response = await fetch(OLLAMA_TAGS_URL);
    if (!response.ok) return { running: false, models: [], error: `Ollama returned ${response.status}` };
    const payload = await response.json();
    const models = Array.isArray(payload.models) ? payload.models : [];
    return { running: true, models, error: '' };
  } catch (error) {
    return { running: false, models: [], error: error?.message || 'Ollama not reachable' };
  }
}

export async function callOllama(messages, model, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 45000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Inference timeout')), timeoutMs);

  let response;
  try {
    response = await fetch(OLLAMA_COMPLETION_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: Number.isFinite(options.temperature) ? options.temperature : 0.25,
        max_tokens: Number.isFinite(options.maxTokens) ? options.maxTokens : 420,
      }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Inference timeout');
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Ollama returned ${response.status}`);
  }

  const payload = await response.json();
  return payload?.choices?.[0]?.message?.content || '';
}

export function classifyModelFailure(errorMessage = '') {
  const text = String(errorMessage).toLowerCase();

  if (!text) return 'Error';
  if (text.includes('econnrefused') || text.includes('not reachable')) return 'Ollama not running';
  if (text.includes('model') && text.includes('not found')) return 'Model Missing';
  if (text.includes('timed out') || text.includes('timeout')) return 'Inference timeout';
  if (text.includes('context') && text.includes('length')) return 'Context overflow';
  if (text.includes('out of memory') || text.includes('cuda') || text.includes('vram')) return 'VRAM exhaustion';
  return 'Error';
}
