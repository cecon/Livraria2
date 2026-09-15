import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProvider } from './provider.mjs';
import { config, buildContext } from './config.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const env = { AGENTMEMORY_ENABLED: 'true', AGENTMEMORY_URL: 'http://127.0.0.1:3131',
  AGENTMEMORY_SECRET: 'test-only-secret', AGENTMEMORY_PROJECT_ID: 'test-project',
  AGENTMEMORY_TEAM_ID: 'test-team', AGENTMEMORY_USER_ID: 'alice', AGENTMEMORY_AGENT_ID: 'reviewer' };
const reply = body => ({ ok: true, json: async () => body });
const silent = () => {};
const entry = { content: 'ACK duplicates require idempotent consumers.', source: 'ADR:test', evidence: 'confirmed' };

test('disabled provider does not access network', async () => {
  const provider = createProvider({}, () => assert.fail('network called'), silent);
  assert.equal((await provider.health()).status, 'disabled');
  assert.equal((await provider.recall('ACK')).count, 0);
  assert.equal((await provider.remember(entry)).status, 'disabled');
});

test('unavailable service falls back without throwing or leaking errors', async () => {
  const logs = [];
  const provider = createProvider(env, async () => { throw new Error(env.AGENTMEMORY_SECRET); }, event => logs.push(event));
  assert.equal((await provider.health()).status, 'unavailable');
  assert.equal((await provider.recall('ACK')).status, 'partial');
  assert.equal((await provider.remember(entry)).status, 'indeterminate');
  assert.ok(!JSON.stringify(logs).includes(env.AGENTMEMORY_SECRET));
});

test('successful recall prioritizes relevant team memories and retrieves full private content', async () => {
  const cfg = config(env);
  const provider = createProvider(env, async (url, options) => {
    const body = options.body && JSON.parse(options.body);
    if (url.includes('team/feed')) return reply({ items: [
      { id: 'team_other', project: 'other', content: { content: 'ACK secret project' } },
      { id: 'team_ack', project: cfg.project, content: entry },
    ] });
    assert.equal(body.agentId, cfg.agentId);
    return reply({ results: [
      { obsId: 'mem_private', observation: { id: 'mem_private', agentId: cfg.agentId, narrative: 'ACK investigation private' } },
      { obsId: 'mem_foreign', observation: { agentId: 'someone-else', narrative: 'ACK foreign' } },
    ] });
  }, silent);
  const result = await provider.recall('ACK duplicates');
  assert.equal(result.count, 2);
  assert.ok(result.text.indexOf('team_ack') < result.text.indexOf('mem_private'));
  assert.ok(!result.text.includes('foreign'));
  assert.ok(!result.text.includes('secret project'));
});

test('remember uses official contract and never auto-shares, including team mode', async () => {
  const calls = [];
  const provider = createProvider({ ...env, AGENTMEMORY_MODE: 'team' }, async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return reply({ success: true, memory: { id: 'mem_test' } });
  }, silent);
  await provider.remember(entry);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/remember'));
  assert.equal(calls[0].body.project, 'test-project::private::alice');
  assert.equal(calls[0].body.agentId, 'test-team/test-project/alice/reviewer');
  assert.ok(calls[0].body.concepts.includes('source:ADR:test'));
});

test('authentication error is distinguishable', async () => {
  const provider = createProvider(env, async () => ({ ok: false, status: 401 }), silent);
  assert.equal((await provider.health()).reason, 'authentication');
});

test('timeout bounds the operation without retries', async () => {
  let calls = 0;
  const provider = createProvider({ ...env, AGENTMEMORY_TIMEOUT_MS: '20' }, async (url, options) => {
    calls++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(reply({})), 1000);
      options.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('timeout')); });
    });
  }, silent);
  assert.equal((await provider.remember(entry)).status, 'indeterminate');
  assert.equal(calls, 1);
});

test('identities are independent and external insecure URLs are rejected', () => {
  assert.notEqual(config(env).agentId, config({ ...env, AGENTMEMORY_USER_ID: 'bob' }).agentId);
  assert.notEqual(config(env).agentId, config({ ...env, AGENTMEMORY_PROJECT_ID: 'other' }).agentId);
  assert.throws(() => config({ ...env, AGENTMEMORY_URL: 'http://example.com' }));
  assert.throws(() => config({ ...env, AGENTMEMORY_SECRET: '' }));
});

test('context is bounded, deduplicated and strips credential-looking results', () => {
  const cfg = { ...config(env), maxItems: 2, maxChars: 150 };
  const result = buildContext([
    { id: '1', scope: 'team', content: 'ACK '.repeat(30) },
    { id: '1', scope: 'team', content: 'duplicate' },
    { id: '2', scope: 'private', content: 'token=not-safe' },
  ], cfg);
  assert.ok(result.text.length <= 150);
  assert.ok(result.count <= 2);
  assert.ok(!result.text.includes('not-safe'));
});

test('credential filter rejects writing secrets and env references', async () => {
  const provider = createProvider(env, () => assert.fail('network called'), silent);
  await assert.rejects(provider.remember({ ...entry, content: 'password=super-secret' }));
  await assert.rejects(provider.remember({ ...entry, files: ['.env'] }));
  await assert.rejects(provider.remember({ ...entry, source: env.AGENTMEMORY_SECRET }));
});

test('sharing requires explicit validation and verified ownership', async () => {
  let shared = false;
  const provider = createProvider(env, async (url) => {
    if (url.endsWith('/team/share')) { shared = true; return reply({ success: true }); }
    return reply({ results: [{ observation: { id: 'mem_test', agentId: config(env).agentId, narrative: entry.content } }] });
  }, silent);
  await assert.rejects(provider.share('mem_test'));
  assert.equal(shared, false);
  assert.equal((await provider.share('mem_test', true, 'ACK')).success, true);
  const foreign = createProvider(env, async () => reply({ results: [
    { observation: { id: 'mem_test', agentId: 'other', narrative: entry.content } },
  ] }), silent);
  await assert.rejects(foreign.share('mem_test', true, 'ACK'));
});

test('SDK MCP client can initialize, list and call tools while disabled', async () => {
  const transport = new StdioClientTransport({ command: process.execPath,
    args: ['tools/agent-memory/mcp.mjs'], env: { AGENTMEMORY_ENABLED: 'false' }, stderr: 'pipe' });
  const client = new Client({ name: 'test', version: '1.0.0' });
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 5);
    const result = await client.callTool({ name: 'memory_health', arguments: {} });
    assert.equal(JSON.parse(result.content[0].text).status, 'disabled');
  } finally { await client.close(); }
});

test('forget validates ownership and uses official audited deletion', async () => {
  const calls = [];
  const provider = createProvider(env, async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'DELETE') return reply({ success: true });
    return reply({ results: [{ observation: {
      id: 'mem_owned', agentId: config(env).agentId, narrative: entry.content,
    } }] });
  }, silent);
  assert.equal((await provider.forget('mem_owned', 'Refuted by current test', 'ACK')).success, true);
  assert.ok(calls[1].url.endsWith('/governance/memories'));
  assert.deepEqual(JSON.parse(calls[1].options.body).memoryIds, ['mem_owned']);
});

test('team mode never retrieves private memory', async () => {
  const provider = createProvider({ ...env, AGENTMEMORY_MODE: 'team' }, async url => {
    assert.ok(url.includes('team/feed'));
    return reply({ items: [] });
  }, silent);
  assert.equal((await provider.recall('ACK')).count, 0);
});

test('valid shared context remains available when private search fails', async () => {
  const provider = createProvider(env, async url => {
    if (!url.includes('team/feed')) throw new Error('offline');
    return reply({ items: [{ id: 'team_valid', project: config(env).project, content: entry }] });
  }, silent);
  const result = await provider.recall('ACK');
  assert.equal(result.status, 'partial');
  assert.equal(result.count, 1);
});
