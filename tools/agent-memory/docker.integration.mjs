// Optional isolated contract test. Never reads another container's volume or credentials.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createProvider } from './provider.mjs';

if (!process.env.AGENTMEMORY_TEST_IMAGE) throw new Error('Set externally verified AGENTMEMORY_TEST_IMAGE');
const env = { ...process.env, AGENTMEMORY_IMAGE: process.env.AGENTMEMORY_TEST_IMAGE,
  AGENTMEMORY_ENABLED: 'true', AGENTMEMORY_SECRET: randomBytes(32).toString('hex'),
  AGENTMEMORY_PROJECT_ID: 'memory-contract-test', AGENTMEMORY_TEAM_ID: 'memory-contract-test',
  AGENTMEMORY_USER_ID: 'test-user', AGENTMEMORY_AGENT_ID: 'test-agent',
  AGENTMEMORY_PORT: '3139', AGENTMEMORY_URL: 'http://127.0.0.1:3139', AGENTMEMORY_TIMEOUT_MS: '2000' };
const project = `livraria-memory-test-${randomBytes(4).toString('hex')}`;
const compose = args => execFileSync('docker', ['compose', '-p', project, '-f', 'docker-compose.agentmemory.yml', ...args],
  { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const provider = createProvider(env, undefined, event => {
  if (process.env.AGENTMEMORY_TEST_DEBUG === 'true') console.error(JSON.stringify(event));
});
let stage = 'start';
try {
  compose(['up', '-d']);
  for (let attempt = 0; attempt < 60; attempt++) {
    if ((await provider.health()).status === 'healthy') break;
    await sleep(1000);
  }
  stage = 'health';
  assert.equal((await provider.health()).status, 'healthy');
  stage = 'remember';
  const written = await provider.remember({ content: 'ACK duplicates require idempotent consumers.',
    source: 'test:isolated-contract', evidence: 'confirmed', type: 'fact' });
  assert.ok(written.memory?.id, 'Official remember response must include memory.id');
  assert.equal(written.memory.agentId, provider.cfg.agentId, 'Server must preserve request agent identity');
  stage = 'private recall';
  let recalled;
  for (let attempt = 0; attempt < 20; attempt++) {
    recalled = await provider.recall('ACK duplicates');
    if (process.env.AGENTMEMORY_TEST_DEBUG === 'true') console.error(JSON.stringify({ recallCount: recalled.count, status: recalled.status }));
    if (recalled.count) break;
    await sleep(500);
  }
  assert.ok(recalled.text.includes('idempotent'), 'Private memory must be searchable');
  stage = 'private identity';
  const foreign = createProvider({ ...env, AGENTMEMORY_USER_ID: 'other-user' }, undefined, () => {});
  assert.equal((await foreign.recall('ACK duplicates')).count, 0, 'Private memory must not enter foreign context');
  stage = 'share';
  assert.equal((await provider.share(written.memory.id, true, 'ACK duplicates')).success, true);
  assert.ok((await foreign.recall('ACK duplicates')).text.includes('idempotent'), 'Explicit team share must be visible');
  // The official file-backed engine flushes every 5000 ms, not on each acknowledged write.
  await sleep(6500);
  stage = 'restart';
  compose(['restart']);
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(1000);
    if (process.env.AGENTMEMORY_TEST_DEBUG === 'true') {
      const feed = await provider.request('team/feed?limit=10');
      console.error(JSON.stringify({ restartFeedCount: feed.items?.length, failure: feed.failure }));
    }
    if ((await provider.health()).status === 'healthy' &&
        (await foreign.recall('ACK duplicates')).text.includes('idempotent')) break;
  }
  assert.ok((await foreign.recall('ACK duplicates')).text.includes('idempotent'), 'Memory must survive restart');
  console.log('PASS: external HTTP, private identity, explicit team sharing and persistence across restart.');
} catch {
  console.error(`External contract test failed at ${stage}; no service output or credentials printed.`);
  process.exitCode = 1;
} finally {
  // Only this randomly named, isolated test project is removed, including its test-only data.
  compose(['down', '-v']);
}
