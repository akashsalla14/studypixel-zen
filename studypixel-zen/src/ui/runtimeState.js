export const RuntimeStates = {
  STARTING: 'Starting',
  READY: 'Ready',
  LOADING_MODEL: 'Loading Model',
  MODEL_MISSING: 'Model Missing',
  OFFLINE_FALLBACK: 'Offline Fallback',
  ERROR: 'Error',
  RECOVERING: 'Recovering',
};

export function deriveRuntimeState({ running, models, selectedModel, error, recovering, loading }) {
  if (recovering) return RuntimeStates.RECOVERING;
  if (error) return RuntimeStates.ERROR;
  if (!running) return RuntimeStates.OFFLINE_FALLBACK;
  if (loading) return RuntimeStates.LOADING_MODEL;

  const names = Array.isArray(models) ? models.map((item) => item.name || item.model || '').filter(Boolean) : [];
  if (!selectedModel) return RuntimeStates.MODEL_MISSING;
  if (names.length > 0 && !names.includes(selectedModel)) return RuntimeStates.MODEL_MISSING;

  return RuntimeStates.READY;
}
