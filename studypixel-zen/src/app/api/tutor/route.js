import { NextResponse } from 'next/server';
import { callOllama, classifyModelFailure, listLocalModels } from '../../../model/ollamaClient';
import { compactHistory } from '../../../session/sessionManager';
import { buildRepairPrompt, buildTutorPrompt, normalizeTutorResponse, parseLlmJson } from '../../../tutor/contract';
import { getEnabledWidgets } from '../../../widgets/widgetPolicy';

let tutorQueue = Promise.resolve();

function runSequentially(task) {
  const run = tutorQueue.then(task, task);
  tutorQueue = run.catch(() => {});
  return run;
}

async function repairResponse(rawText, model) {
  const repaired = await callOllama([
    { role: 'system', content: 'Return only strict JSON. Never add markdown.' },
    { role: 'user', content: buildRepairPrompt(rawText) },
  ], model, { temperature: 0.1, maxTokens: 320, timeoutMs: 25000 });

  return parseLlmJson(repaired);
}

export async function GET() {
  const health = await listLocalModels();
  return NextResponse.json(health, { status: 200 });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  if (body.type === 'health') {
    const health = await listLocalModels();
    return NextResponse.json(health, { status: 200 });
  }

  const history = compactHistory(Array.isArray(body.history) ? body.history : [], 6);
  const context = {
    profile: body.profile || {},
    topic: body.topic || 'general study',
    model: body.model || 'qwen2.5:0.5b',
    sessionSummary: body.sessionSummary || '',
  };
  const enabledWidgets = getEnabledWidgets({
    heavyWidgetsEnabled: body?.settings?.heavyWidgetsEnabled,
    memoryPressure: body?.memoryPressure || 'Low',
  });

  const prompt = buildTutorPrompt({ message: body.message || '', context, enabledWidgets });

  try {
    const { raw, parsed } = await runSequentially(async () => {
      const rawText = await callOllama([
        { role: 'system', content: 'Return compact strict JSON only. Unknown action must be SPEAK.' },
        ...history.map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content })),
        { role: 'user', content: prompt },
      ], context.model, { temperature: 0.25, maxTokens: 420, timeoutMs: 45000 });

      const parsedResponse = parseLlmJson(rawText) || await repairResponse(rawText, context.model).catch(() => null);
      return { raw: rawText, parsed: parsedResponse };
    });

    const normalized = normalizeTutorResponse(parsed, raw, enabledWidgets);

    return NextResponse.json({
      ok: true,
      output: normalized,
      runtime: {
        model: context.model,
        enabledWidgets,
      },
    });
  } catch (error) {
    const failureState = classifyModelFailure(error?.message || '');
    return NextResponse.json({
      ok: false,
      output: normalizeTutorResponse(null, 'The local tutor is unavailable right now.', enabledWidgets),
      error: 'Ollama unavailable or model request failed.',
      failureState,
    });
  }
}
