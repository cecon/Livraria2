import { config, safeText, buildContext } from './config.mjs';

export class NoopMemoryProvider {
  async health() { return { status: 'disabled' }; }
  async recall() { return { text: '', count: 0, status: 'disabled' }; }
  async remember() { return { status: 'disabled' }; }
  async share() { return { status: 'disabled' }; }
  async forget() { return { status: 'disabled' }; }
}

export class AgentMemoryProvider {
  constructor(cfg, fetcher = fetch, log = event => console.error(JSON.stringify(event))) {
    this.cfg = cfg;
    this.fetcher = fetcher;
    this.log = log;
  }

  async request(path, body, method = body ? 'POST' : 'GET') {
    const start = Date.now();
    try {
      const response = await this.fetcher(`${this.cfg.url}/agentmemory/${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(this.cfg.timeout),
        headers: { Authorization: `Bearer ${this.cfg.secret}`, 'Content-Type': 'application/json' },
        ...(body && { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'authentication' : 'unavailable');
      const result = await response.json();
      if (result.error || result.success === false) throw new Error('rejected');
      this.log({ operation: path, status: 'success', durationMs: Date.now() - start });
      return result;
    } catch (error) {
      const reason = ['authentication', 'rejected'].includes(error.message) ? error.message : 'unavailable';
      this.log({ operation: path, status: reason, durationMs: Date.now() - start });
      return { failure: reason };
    }
  }

  async health() {
    const result = await this.request('health');
    return { status: result.failure ? 'unavailable' : 'healthy', ...(result.failure && { reason: result.failure }) };
  }

  async recall(query) {
    query = safeText(query, this.cfg.secret);
    // No read or write retries: a lost write response is explicitly indeterminate.
    const team = await this.request(`team/feed?limit=${this.cfg.maxItems}`);
    const personal = this.cfg.mode === 'team' ? { results: [] } : await this.request('search', {
      query, project: this.cfg.privateProject, agentId: this.cfg.agentId,
      format: 'full', token_budget: Math.ceil(this.cfg.maxChars / 3), limit: this.cfg.maxItems,
    });
    const words = query.toLowerCase().split(/\W+/).filter(word => word.length > 2);
    const shared = (team.items || []).filter(item => item.project === this.cfg.project)
      .map(item => ({ id: item.id, scope: 'team', content: item.content?.content || '',
        relevance: words.filter(word => item.content?.content?.toLowerCase().includes(word)).length }))
      .filter(item => item.relevance > 0).sort((a, b) => b.relevance - a.relevance);
    const privateItems = (personal.results || []).filter(item =>
      item.observation?.agentId === this.cfg.agentId).map(item => ({
      id: item.observation.id, scope: 'private', content: item.observation.narrative || item.observation.title,
    }));
    return { ...buildContext([...shared, ...privateItems], this.cfg),
      status: team.failure || personal.failure ? 'partial' : 'success' };
  }

  async remember(input) {
    if (!input || typeof input !== 'object') throw new Error('Memory input required');
    if (!['pattern', 'preference', 'architecture', 'bug', 'workflow', 'fact'].includes(input.type || 'fact')) {
      throw new Error('Unsupported official memory type');
    }
    const content = safeText(input.content, this.cfg.secret);
    const source = safeText(input.source, this.cfg.secret);
    const evidence = input.evidence || 'hypothesis';
    if (!['hypothesis', 'observation', 'confirmed'].includes(evidence)) throw new Error('Invalid evidence');
    const files = input.files || [];
    if (!Array.isArray(files) || files.length > 20 || files.some(file =>
      typeof file !== 'string' || /(^|[\/\\])\.env|\.pem$|\.pfx$|\.key$/i.test(file))) {
      throw new Error('Unsafe memory file references');
    }
    files.forEach(file => safeText(file, this.cfg.secret));
    // AgentMemory has no arbitrary metadata/confidence on remember; use official concepts.
    const result = await this.request('remember', {
      content, type: input.type || 'fact', files, project: this.cfg.privateProject,
      agentId: this.cfg.agentId, concepts: [`source:${source}`, `evidence:${evidence}`, `team:${this.cfg.team}`],
    });
    return result.failure ? { status: 'indeterminate', reason: result.failure } : result;
  }

  async owned(id, query) {
    if (!/^mem_[\w-]+$/.test(id || '')) throw new Error('Invalid memory ID');
    // Official expandIds cannot expand Memory records. A bounded full search verifies ownership.
    const result = await this.request('search', {
      query: safeText(query, this.cfg.secret), project: this.cfg.privateProject,
      agentId: this.cfg.agentId, format: 'full', limit: 20,
    });
    const item = (result.results || []).find(item => (item.observation || item).id === id);
    if (!item || (item.observation || item).agentId !== this.cfg.agentId || result.failure) {
      throw new Error('Memory ownership could not be verified');
    }
    return item.observation || item;
  }

  async share(id, validated = false, query) {
    if (validated !== true) throw new Error('Explicit validation required before sharing');
    const item = await this.owned(id, query);
    safeText(item.narrative || item.title, this.cfg.secret);
    return this.request('team/share', { itemId: id, itemType: 'memory', project: this.cfg.project });
  }

  async forget(id, reason, query) {
    await this.owned(id, query);
    return this.request('governance/memories', {
      memoryIds: [id], reason: safeText(reason, this.cfg.secret),
    }, 'DELETE');
  }
}

export function createProvider(env = process.env, fetcher, log) {
  const cfg = config(env);
  return cfg.enabled ? new AgentMemoryProvider(cfg, fetcher, log) : new NoopMemoryProvider();
}
