import { NextResponse } from 'next/server';
import { normalizeTutorResponse, parseLlmJson, buildTutorPrompt } from '../../../lib/tutor';

const OLLAMA_URL = 'http://localhost:11434/v1/chat/completions';

async function callOllama(messages, model) {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature: 0.3,
      max_tokens: 384,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Ollama returned ${response.status}`);
  }

  const payload = await response.json();
  return payload.choices?.[0]?.message?.content || '';
}

async function repairResponse(message, context) {
  const repairPrompt = buildTutorPrompt({
    mode: 'repair',
    message,
    context,
  });

  const raw = await callOllama([
    { role: 'system', content: 'Return only strict JSON.' },
    { role: 'user', content: repairPrompt },
  ], context.model || 'qwen2.5:0.5b');

  return parseLlmJson(raw);
}

export async function GET() {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      return NextResponse.json({ running: false, models: [] }, { status: 200 });
    }

    const payload = await response.json();
    return NextResponse.json({
      running: true,
      models: Array.isArray(payload.models) ? payload.models : [],
    });
  } catch {
    return NextResponse.json({ running: false, models: [] }, { status: 200 });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  if (body.type === 'health') {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const models = response.ok ? await response.json() : { models: [] };
      return NextResponse.json({
        running: response.ok,
        models: Array.isArray(models.models) ? models.models : [],
      });
    } catch {
      return NextResponse.json({ running: false, models: [] }, { status: 200 });
    }
  }

  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const context = {
    profile: body.profile || {},
    topic: body.topic || 'general study',
    model: body.model || 'qwen2.5:0.5b',
    sessionSummary: body.sessionSummary || '',
  };

  const prompt = buildTutorPrompt({
    mode: 'turn',
    message: body.message || '',
    context,
  });

  try {
    const raw = await callOllama([
      { role: 'system', content: 'Return compact JSON only. Use SPEAK unless a widget is clearly appropriate.' },
      ...history.map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content })),
      { role: 'user', content: prompt },
    ], context.model);

    const parsed = parseLlmJson(raw) || await repairResponse(raw, context).catch(() => null);
    return NextResponse.json({
      ok: true,
      output: normalizeTutorResponse(parsed, raw),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      output: normalizeTutorResponse(null, error?.message || ''),
      error: 'Ollama unavailable or model request failed.',
    });
  }
}
