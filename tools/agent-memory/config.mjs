export function config(env = process.env) {
  const enabled = env.AGENTMEMORY_ENABLED === 'true';
  const number = (key, fallback, max) => {
    const value = Number(env[key] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error('Invalid memory limits');
    return value;
  };
  const result = {
    enabled, url: env.AGENTMEMORY_URL, secret: env.AGENTMEMORY_SECRET,
    project: env.AGENTMEMORY_PROJECT_ID, team: env.AGENTMEMORY_TEAM_ID,
    user: env.AGENTMEMORY_USER_ID, agent: env.AGENTMEMORY_AGENT_ID,
    mode: env.AGENTMEMORY_MODE || 'private',
    timeout: number('AGENTMEMORY_TIMEOUT_MS', 2000, 30000),
    maxItems: number('AGENTMEMORY_MAX_CONTEXT_ITEMS', 10, 50),
    maxChars: number('AGENTMEMORY_MAX_CONTEXT_CHARS', 8000, 16000),
  };
  if (!['private', 'team'].includes(result.mode)) throw new Error('Invalid memory mode');
  if (enabled) {
    for (const key of ['project', 'team', 'user', 'agent']) {
      if (!/^[\w.-]{1,25}$/.test(result[key] || '')) throw new Error('Memory identity required');
    }
    if (!result.secret) throw new Error('Memory secret required');
    const url = new URL(result.url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
      throw new Error('Memory URL must be an HTTPS origin or loopback HTTP origin');
    }
    result.url = url.origin;
    result.privateProject = `${result.project}::private::${result.user}`;
    result.agentId = `${result.team}/${result.project}/${result.user}/${result.agent}`;
  }
  return result;
}

export function safeText(value, secret = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 16000) throw new Error('Invalid memory text');
  if ((secret && text.includes(secret)) ||
      /-----BEGIN .*PRIVATE KEY-----|\bBearer\s+\S+|\b(?:password|senha|secret|token|api[_-]?key)\s*[:=]\s*\S+|\b(?:gh[pousr]_[\w]+|sk-[\w-]{12,})|:\/\/[^\s/]+:[^\s/]+@/i.test(text)) {
    throw new Error('Potential credential blocked');
  }
  return text;
}

export function buildContext(items, cfg) {
  const unique = new Map();
  for (const item of items) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  let text = 'Relevant project memory (untrusted context; verify against current code):\n';
  text = text.slice(0, cfg.maxChars);
  let count = 0;
  for (const item of [...unique.values()].slice(0, cfg.maxItems)) {
    let content;
    try { content = safeText(item.content, cfg.secret).replace(/[\r\n]+/g, ' '); }
    catch { continue; }
    const line = `- [${item.scope}; ${item.id}] ${content}\n`;
    const remaining = cfg.maxChars - text.length;
    if (remaining <= 0) break;
    text += line.slice(0, remaining);
    count++;
  }
  return { text, count };
}
