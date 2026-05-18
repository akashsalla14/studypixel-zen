export function buildTelemetry({
  widgetId,
  version = 'v1',
  isCorrect = false,
  usedHint = false,
  answerData = {},
  executionMode = 'REAL_STUDENT',
}) {
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
