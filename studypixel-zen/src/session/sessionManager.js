export function compactHistory(messages, limit = 8) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-limit);
}

export function summarizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'Session summarized for compact memory usage.';
  }

  const recentUser = messages
    .filter((message) => message.role === 'user')
    .slice(-4)
    .map((item) => item.content)
    .join(' | ');

  return recentUser || 'Session summarized for compact memory usage.';
}

export function trimMessagesWithSummary(messages, keep = 8) {
  if (!Array.isArray(messages) || messages.length <= keep + 1) {
    return {
      messages: Array.isArray(messages) ? messages : [],
      summary: '',
      trimmed: false,
    };
  }

  const summary = summarizeMessages(messages.slice(0, -keep));
  return {
    summary,
    trimmed: true,
    messages: [
      {
        role: 'assistant',
        content: `Older turns summarized: ${summary}`,
        timestamp: new Date().toISOString(),
      },
      ...messages.slice(-keep),
    ],
  };
}

export function inferMemoryPressure(messages = []) {
  const size = Array.isArray(messages) ? messages.length : 0;
  if (size > 28) return 'High';
  if (size > 14) return 'Medium';
  return 'Low';
}

export function rollupArchivedSessions(sessions = [], maxActiveSessions = 20) {
  if (!Array.isArray(sessions) || sessions.length <= maxActiveSessions) {
    return { active: Array.isArray(sessions) ? sessions : [], archived: [] };
  }

  return {
    active: sessions.slice(0, maxActiveSessions),
    archived: sessions.slice(maxActiveSessions),
  };
}
