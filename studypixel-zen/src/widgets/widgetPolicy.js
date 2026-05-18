export const requiredWidgets = [
  'mcq-v1',
  'mcq-reasoning-v1',
  'flashcard-v1',
  'fill-blank-v1',
  'matching-v1',
  'timeline-v1',
  'analogy-v1',
  'spaced-review-v1',
];

export const optionalWidgets = [
  'diagram-generator-v1',
  'signal-comparison-v1',
];

export const disabledInitially = [
  'tactical-sandbox-v1',
  'image-analysis-v1',
];

export function getEnabledWidgets({ heavyWidgetsEnabled = true, memoryPressure = 'Low' } = {}) {
  const enabled = requiredWidgets.filter((widgetId) => !disabledInitially.includes(widgetId));

  if (heavyWidgetsEnabled && memoryPressure !== 'High') {
    enabled.push(...optionalWidgets);
  }

  return enabled;
}
